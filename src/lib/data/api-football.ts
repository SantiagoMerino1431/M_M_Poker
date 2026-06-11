import type { TeamStrength, H2HRecord, FormRecord, Injury, Player, RefereeStats } from "../types"

const BASE = "https://v3.football.api-sports.io"
const WC_2026_LEAGUE_ID = 1
const WC_2026_SEASON = 2026

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "x-rapidapi-key": process.env.RAPIDAPI_KEY!,
      "x-rapidapi-host": "v3.football.api-sports.io",
    },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${path}`)
  const data = await res.json()
  return data
}

export async function fetchTodayFixtures(): Promise<{
  id: number; date: string; stadium: string; city: string;
  homeTeamId: number; awayTeamId: number; stage: string;
  homeTeamName: string; awayTeamName: string;
}[]> {
  const today = new Date().toISOString().split("T")[0]
  const data = await apiFetch<any>(
    `/fixtures?league=${WC_2026_LEAGUE_ID}&season=${WC_2026_SEASON}&date=${today}`
  )
  return (data.response ?? []).map((f: any) => ({
    id: f.fixture.id,
    date: f.fixture.date,
    stadium: f.fixture.venue?.name ?? "Unknown",
    city: f.fixture.venue?.city ?? "Unknown",
    homeTeamId: f.teams.home.id,
    awayTeamId: f.teams.away.id,
    homeTeamName: f.teams.home.name ?? `Team ${f.teams.home.id}`,
    awayTeamName: f.teams.away.name ?? `Team ${f.teams.away.id}`,
    stage: f.league.round ?? "Group Stage",
  }))
}

export async function fetchTeamStats(teamId: number): Promise<Partial<TeamStrength>> {
  const data = await apiFetch<any>(
    `/teams/statistics?league=${WC_2026_LEAGUE_ID}&team=${teamId}&season=${WC_2026_SEASON}`
  )
  const stats = data.response
  if (!stats) return {}
  const played = stats.fixtures?.played?.total ?? 1
  const goalsFor = stats.goals?.for?.total?.total ?? played * 1.4
  const goalsAgainst = stats.goals?.against?.total?.total ?? played * 1.2
  return {
    attackStrength: goalsFor / played / 1.4,
    defenseStrength: 1.4 / (goalsAgainst / played),
  }
}

export async function fetchH2H(homeTeamId: number, awayTeamId: number): Promise<H2HRecord[]> {
  const data = await apiFetch<any>(`/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&last=10`)
  return (data.response ?? []).map((f: any) => ({
    date: f.fixture.date,
    homeTeamId: f.teams.home.id,
    awayTeamId: f.teams.away.id,
    homeGoals: f.goals.home ?? 0,
    awayGoals: f.goals.away ?? 0,
    competition: mapCompetition(f.league.name),
  }))
}

function mapCompetition(name: string): H2HRecord["competition"] {
  const n = name.toLowerCase()
  if (n.includes("world cup")) return "world_cup"
  if (n.includes("euro") || n.includes("copa") || n.includes("nations")) return "continental"
  if (n.includes("qualif")) return "qualifier"
  return "friendly"
}

export async function fetchRecentForm(teamId: number): Promise<FormRecord[]> {
  const data = await apiFetch<any>(
    `/fixtures?team=${teamId}&last=5&league=${WC_2026_LEAGUE_ID}&season=${WC_2026_SEASON}`
  )
  return (data.response ?? []).map((f: any) => {
    const isHome = f.teams.home.id === teamId
    return {
      date: f.fixture.date,
      opponentRanking: 50,
      goalsFor: isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0),
      goalsAgainst: isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0),
      isHome,
    }
  })
}

export async function fetchInjuries(fixtureId: number): Promise<{ home: Injury[]; away: Injury[] }> {
  const data = await apiFetch<any>(`/injuries?fixture=${fixtureId}`)
  const home: Injury[] = []
  const away: Injury[] = []
  for (const inj of data.response ?? []) {
    const injury: Injury = {
      playerId: inj.player.id,
      playerName: inj.player.name,
      position: inj.player.type ?? "Unknown",
      reason: inj.player.reason ?? "Unknown",
      status: inj.player.reason?.toLowerCase().includes("out") ? "out" : "doubtful",
    }
    if (inj.team.id === inj.fixture?.teams?.home?.id) home.push(injury)
    else away.push(injury)
  }
  return { home, away }
}

export async function fetchLineups(fixtureId: number): Promise<{ home: Player[] | null; away: Player[] | null }> {
  const data = await apiFetch<any>(`/fixtures/lineups?fixture=${fixtureId}`)
  const teams = data.response ?? []
  if (teams.length < 2) return { home: null, away: null }
  const mapPlayers = (team: any): Player[] =>
    [...(team.startXI ?? []), ...(team.substitutes ?? [])].map((p: any) => ({
      id: p.player.id,
      name: p.player.name,
      position: p.player.pos ?? "MID",
      goals_per_90: 0.1,
      shots_per_90: 0.5,
      isStarter: team.startXI?.some((s: any) => s.player.id === p.player.id) ?? false,
    }))
  return { home: mapPlayers(teams[0]), away: mapPlayers(teams[1]) }
}

export async function fetchReferee(fixtureId: number): Promise<RefereeStats | null> {
  const data = await apiFetch<any>(`/fixtures?id=${fixtureId}`)
  const fixture = data.response?.[0]
  if (!fixture?.fixture?.referee) return null
  return {
    id: 0,
    name: fixture.fixture.referee,
    avgYellowsPerGame: 3.8,
    avgRedsPerGame: 0.10,
    totalGames: 0,
  }
}
