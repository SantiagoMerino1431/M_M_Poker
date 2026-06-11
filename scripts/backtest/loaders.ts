import fs from "fs"
import path from "path"
import type { FormRecord, H2HRecord } from "../../src/lib/types"
import { TEAM_NAME_MAP, TEAM_IDS, WC2022_TEAMS, QATAR_START, WC_AVG_GOALS } from "./constants"

// CSV helpers

function readCSV(dataDir: string, filename: string): Record<string, string>[] {
  const content = fs.readFileSync(path.join(dataDir, filename), "utf-8")
  const lines = content.split(/\r?\n/).filter(Boolean)
  const headers = lines[0].split(",").map(h => h.trim())
  return lines.slice(1).map(line => {
    const cols: string[] = []
    let current = ""
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === "," && !inQuotes) { cols.push(current.trim()); current = ""; continue }
      current += ch
    }
    cols.push(current.trim())
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ""]))
  })
}

export function normalizeTeamName(name: string): string {
  return TEAM_NAME_MAP[name] ?? name
}

// Rankings

export function loadRankings(dataDir: string): Map<string, number> {
  const rows = readCSV(dataDir, "fifa_ranking_2022-10-06.csv")
  const map = new Map<string, number>()
  for (const row of rows) {
    const name = normalizeTeamName(row.team?.trim() ?? "")
    const rank = Math.min(210, parseInt(row.rank, 10))
    if (name && !isNaN(rank)) map.set(name, rank)
  }
  return map
}

// Team Strengths

export function loadTeamStrengths(dataDir: string): Map<string, { attack: number; defense: number }> {
  const rows = readCSV(dataDir, "results.csv")
  const preWC = rows.filter(r => r.date < QATAR_START)

  const scored = new Map<string, number[]>()
  const conceded = new Map<string, number[]>()

  for (const row of preWC) {
    const home = normalizeTeamName(row.home_team)
    const away = normalizeTeamName(row.away_team)
    const hs = parseInt(row.home_score, 10)
    const as_ = parseInt(row.away_score, 10)
    if (isNaN(hs) || isNaN(as_)) continue

    if (!scored.has(home)) scored.set(home, [])
    if (!scored.has(away)) scored.set(away, [])
    if (!conceded.has(home)) conceded.set(home, [])
    if (!conceded.has(away)) conceded.set(away, [])

    scored.get(home)!.push(hs)
    scored.get(away)!.push(as_)
    conceded.get(home)!.push(as_)
    conceded.get(away)!.push(hs)
  }

  const clamp = (v: number) => Math.max(0.5, Math.min(2.0, v))

  const map = new Map<string, { attack: number; defense: number }>()
  for (const team of WC2022_TEAMS) {
    const sc = (scored.get(team) ?? []).slice(-20)
    const co = (conceded.get(team) ?? []).slice(-20)
    const avgScored   = sc.length > 0 ? sc.reduce((a, b) => a + b, 0) / sc.length : WC_AVG_GOALS
    const avgConceded = co.length > 0 ? co.reduce((a, b) => a + b, 0) / co.length : WC_AVG_GOALS
    map.set(team, {
      attack:  clamp(avgScored   / WC_AVG_GOALS),
      defense: clamp(avgConceded / WC_AVG_GOALS),
    })
  }
  return map
}

// Former names

export function loadFormerNames(dataDir: string): Map<string, string> {
  const rows = readCSV(dataDir, "former_names.csv")
  const map = new Map<string, string>()
  for (const row of rows) {
    if (row.former && row.current) map.set(row.former.trim(), row.current.trim())
  }
  // Well-known historical names absent from the CSV
  if (!map.has("West Germany")) map.set("West Germany", "Germany")
  return map
}

// Results / Form

function classifyTournament(tournament: string): H2HRecord["competition"] {
  const t = tournament.toLowerCase()
  if (t.includes("fifa world cup") && !t.includes("qualif")) return "world_cup"
  if (
    t.includes("uefa euro") ||
    t.includes("copa am") ||
    t.includes("asian cup") ||
    t.includes("african cup") ||
    t.includes("afcon")
  ) return "continental"
  if (t.includes("qualif") || t.includes("qualification")) return "qualifier"
  return "friendly"
}

export function loadResults(dataDir: string): Map<string, FormRecord[]> {
  const rows = readCSV(dataDir, "results.csv")
  const rankings = loadRankings(dataDir)
  const formerNames = loadFormerNames(dataDir)

  const resolve = (name: string) => {
    const n = name.trim()
    return normalizeTeamName(formerNames.get(n) ?? n)
  }

  const map = new Map<string, FormRecord[]>()
  for (const team of WC2022_TEAMS) map.set(team, [])

  for (const row of rows) {
    if (!row.date || row.date >= QATAR_START) continue
    const hs = parseInt(row.home_score, 10)
    const as_ = parseInt(row.away_score, 10)
    if (isNaN(hs) || isNaN(as_)) continue

    const home = resolve(row.home_team)
    const away = resolve(row.away_team)

    if (map.has(home)) {
      map.get(home)!.push({
        date: row.date,
        opponentRanking: rankings.get(away) ?? 80,
        goalsFor: hs,
        goalsAgainst: as_,
        isHome: true,
      })
    }
    if (map.has(away)) {
      map.get(away)!.push({
        date: row.date,
        opponentRanking: rankings.get(home) ?? 80,
        goalsFor: as_,
        goalsAgainst: hs,
        isHome: false,
      })
    }
  }

  for (const [team, records] of map) {
    map.set(team, records.sort((a, b) => b.date.localeCompare(a.date)))
  }

  return map
}

// H2H

export function loadH2H(dataDir: string): Map<string, H2HRecord[]> {
  const rows = readCSV(dataDir, "results.csv")
  const formerNames = loadFormerNames(dataDir)

  const resolve = (name: string) => {
    const n = name.trim()
    return normalizeTeamName(formerNames.get(n) ?? n)
  }

  const map = new Map<string, H2HRecord[]>()

  for (const row of rows) {
    if (!row.date || row.date >= QATAR_START) continue
    const hs = parseInt(row.home_score, 10)
    const as_ = parseInt(row.away_score, 10)
    if (isNaN(hs) || isNaN(as_)) continue

    const home = resolve(row.home_team)
    const away = resolve(row.away_team)
    const homeId = TEAM_IDS[home]
    const awayId = TEAM_IDS[away]

    if (!homeId || !awayId) continue

    const key = [home, away].sort().join("||")
    if (!map.has(key)) map.set(key, [])

    map.get(key)!.push({
      date: row.date,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeGoals: hs,
      awayGoals: as_,
      competition: classifyTournament(row.tournament ?? ""),
    })
  }

  for (const [key, records] of map) {
    map.set(key, records.sort((a, b) => b.date.localeCompare(a.date)))
  }

  return map
}

// Types

export interface Qatar2022Match {
  fixtureId: number
  date: string
  home: string
  away: string
  homeScore: number
  awayScore: number
  venue: string
  referee: string
  stage: string
}

// Qatar 2022 matches

export function loadQatar2022Matches(dataDir: string): Qatar2022Match[] {
  const rows = readCSV(dataDir, "matches_1930_2022.csv")
  const wc2022 = rows
    .filter(r => r.Year === "2022")
    .sort((a, b) => a.Date.localeCompare(b.Date))

  const results: Qatar2022Match[] = []
  let index = 0
  for (const row of wc2022) {
    const homeScore = parseInt(row.home_score, 10)
    const awayScore = parseInt(row.away_score, 10)
    if (isNaN(homeScore) || isNaN(awayScore)) continue
    results.push({
      fixtureId: -(++index),
      date: row.Date,
      home: normalizeTeamName(row.home_team),
      away: normalizeTeamName(row.away_team),
      homeScore,
      awayScore,
      venue: row.Venue ?? "Qatar Stadium",
      referee: row.Referee ?? "",
      stage: row.Round ?? "Group Stage",
    })
  }
  return results
}

// Odds parser
// odds_2022.csv format: date,time,stage,home_team,away_team,odds_1,odds_x,odds_2

export function loadOdds(dataDir: string): Map<string, { h: number; d: number; a: number }> {
  const rows = readCSV(dataDir, "odds_2022.csv")
  const map = new Map<string, { h: number; d: number; a: number }>()

  for (const row of rows) {
    const home = normalizeTeamName(row.home_team?.trim() ?? "")
    const away = normalizeTeamName(row.away_team?.trim() ?? "")
    const h = parseFloat(row.odds_1)
    const d = parseFloat(row.odds_x)
    const a = parseFloat(row.odds_2)
    if (home && away && !isNaN(h) && !isNaN(d) && !isNaN(a)) {
      map.set(`${home}||${away}`, { h, d, a })
    }
  }

  return map
}
