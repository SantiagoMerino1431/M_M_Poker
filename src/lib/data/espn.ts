import type { Player } from "../types"

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world"

// Normalize for fuzzy matching: lowercase, strip accents + punctuation
function norm(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/\p{Mn}/gu, "")
    .replace(/[^a-z0-9]/g, "")
}

// DB Spanish names → normalized ESPN English names
const DB_TO_ESPN: Record<string, string> = {
  "sudafrica": "southafrica",
  "paisesbajos": "netherlands",
  "republicadecorea": "southkorea",
  "costademarfil": "ivorycoast",
  "rdcongo": "drcongo",
  "chequia": "czechia",
  "estadosunidos": "unitedstates",
  "arabiaesaudita": "saudiarabia",
  "emiratosarabesunidos": "uae",
  "nuevazelandia": "newzealand",
  "guineaecuatorial": "equatorialguinea",
}

// ESPN display name aliases → normalized key
const ESPN_ALIASES: Record<string, string> = {
  "usa": "unitedstates",
  "unitedstatesofamerica": "unitedstates",
  "drcongo": "drcongo",
  "democraticrepublicofthecongo": "drcongo",
  "ivorycoast": "cotedivoire",
  "southkorea": "southkorea",
  "republicofkorea": "southkorea",
}

function normalizeTeamName(name: string): string {
  const n = norm(name)
  return DB_TO_ESPN[n] ?? ESPN_ALIASES[n] ?? n
}

interface ESPNEvent {
  id: string
  name: string
  homeTeamName: string
  awayTeamName: string
}

async function fetchScoreboard(dateStr: string): Promise<ESPNEvent[]> {
  const yyyymmdd = dateStr.replace(/-/g, "").substring(0, 8)
  const url = `${ESPN_BASE}/scoreboard?dates=${yyyymmdd}&limit=20`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`ESPN scoreboard ${res.status}`)
  const data = await res.json()

  return (data.events ?? []).map((ev: any) => {
    const comp = ev.competitions?.[0]
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home")
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away")
    return {
      id: ev.id as string,
      name: ev.name as string,
      homeTeamName: home?.team?.displayName ?? "",
      awayTeamName: away?.team?.displayName ?? "",
    }
  })
}

function mapPosition(abbr: string | undefined): string {
  const a = (abbr ?? "").toUpperCase()
  if (a === "GK") return "GK"
  if (a === "CB" || a === "LB" || a === "RB" || a === "LWB" || a === "RWB" || a === "D") return "DEF"
  if (a === "CM" || a === "DM" || a === "LM" || a === "RM" || a === "CAM" || a === "CDM" || a === "M") return "MID"
  if (a === "LW" || a === "RW" || a === "SS" || a === "CF" || a === "ST" || a === "F" || a === "FW") return "FWD"
  return "MID"
}

async function fetchEventRosters(eventId: string): Promise<{ home: Player[]; away: Player[] } | null> {
  const url = `${ESPN_BASE}/summary?event=${eventId}`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return null
  const data = await res.json()

  const rosters: any[] = data.rosters ?? []
  if (rosters.length < 2) return null

  const mapRoster = (side: any): Player[] =>
    (side.roster ?? []).map((entry: any, i: number) => ({
      id: parseInt(entry.athlete?.id ?? `${i}`),
      name: entry.athlete?.displayName ?? "Unknown",
      position: mapPosition(entry.position?.abbreviation ?? entry.athlete?.position?.abbreviation),
      goals_per_90: 0.1,
      shots_per_90: 0.5,
      isStarter: Boolean(entry.starter),
    }))

  const homeRoster = rosters.find((r: any) => r.homeAway === "home")
  const awayRoster = rosters.find((r: any) => r.homeAway === "away")

  if (!homeRoster || !awayRoster) return null

  const home = mapRoster(homeRoster)
  const away = mapRoster(awayRoster)

  if (home.length === 0 || away.length === 0) return null

  return { home, away }
}

/**
 * Fetch lineups from ESPN's unofficial API.
 * Matches teams by name (fuzzy) against today's WC scoreboard.
 */
export async function fetchESPNLineups(
  homeTeamName: string,
  awayTeamName: string,
  matchDate?: string,
): Promise<{ home: Player[] | null; away: Player[] | null }> {
  const dateStr = matchDate ?? new Date().toISOString().split("T")[0]

  let events: ESPNEvent[]
  try {
    events = await fetchScoreboard(dateStr)
  } catch {
    return { home: null, away: null }
  }

  const normHome = normalizeTeamName(homeTeamName)
  const normAway = normalizeTeamName(awayTeamName)

  const match = events.find(ev => {
    const eHome = normalizeTeamName(ev.homeTeamName)
    const eAway = normalizeTeamName(ev.awayTeamName)
    return (
      (eHome.includes(normHome) || normHome.includes(eHome)) &&
      (eAway.includes(normAway) || normAway.includes(eAway))
    ) || (
      (eHome.includes(normAway) || normAway.includes(eHome)) &&
      (eAway.includes(normHome) || normHome.includes(eAway))
    )
  })

  if (!match) return { home: null, away: null }

  try {
    const rosters = await fetchEventRosters(match.id)
    if (!rosters) return { home: null, away: null }

    // Determine if ESPN event has home/away swapped relative to our fixture
    const eHome = normalizeTeamName(match.homeTeamName)
    const swapped = eHome.includes(normAway) || normAway.includes(eHome)

    return swapped
      ? { home: rosters.away, away: rosters.home }
      : { home: rosters.home, away: rosters.away }
  } catch {
    return { home: null, away: null }
  }
}

/**
 * Get live match status for today's WC games from ESPN.
 */
export async function fetchESPNLiveStatus(homeTeamName: string, awayTeamName: string): Promise<{
  state: "pre" | "in" | "post" | "unknown"
  clock?: string
  homeScore?: number
  awayScore?: number
} | null> {
  const dateStr = new Date().toISOString().split("T")[0]
  const normHome = normalizeTeamName(homeTeamName)
  const normAway = normalizeTeamName(awayTeamName)

  const yyyymmdd = dateStr.replace(/-/g, "")
  const url = `${ESPN_BASE}/scoreboard?dates=${yyyymmdd}&limit=20`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) return null
  const data = await res.json()

  for (const ev of (data.events ?? [])) {
    const comp = ev.competitions?.[0]
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home")
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away")
    if (!home || !away) continue

    const eHome = normalizeTeamName(home.team.displayName)
    const eAway = normalizeTeamName(away.team.displayName)
    const matches = (
      (eHome.includes(normHome) || normHome.includes(eHome)) &&
      (eAway.includes(normAway) || normAway.includes(eAway))
    ) || (
      (eHome.includes(normAway) || normAway.includes(eHome)) &&
      (eAway.includes(normHome) || normHome.includes(eAway))
    )
    if (!matches) continue

    const statusType = comp?.status?.type
    const state = (statusType?.state ?? "unknown") as "pre" | "in" | "post" | "unknown"
    return {
      state,
      clock: comp?.status?.displayClock,
      homeScore: parseInt(home.score ?? "0"),
      awayScore: parseInt(away.score ?? "0"),
    }
  }
  return null
}
