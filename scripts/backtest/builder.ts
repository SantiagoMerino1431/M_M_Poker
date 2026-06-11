import type { MatchData, TeamStrength, MarketOdds } from "../../src/lib/types"
import {
  loadRankings,
  loadTeamStrengths,
  loadResults,
  loadH2H,
  loadOdds,
  loadQatar2022Matches,
} from "./loaders"
import type { Qatar2022Match } from "./loaders"
import { TEAM_IDS, TEAM_GROUPS } from "./constants"

export interface BacktestLoaders {
  rankings:  Map<string, number>
  strengths: Map<string, { attack: number; defense: number }>
  results:   Map<string, import("../../src/lib/types").FormRecord[]>
  h2h:       Map<string, import("../../src/lib/types").H2HRecord[]>
  odds:      Map<string, { h: number; d: number; a: number }>
  matches:   Qatar2022Match[]
}

export function loadAll(dataDir: string): BacktestLoaders {
  return {
    rankings:  loadRankings(dataDir),
    strengths: loadTeamStrengths(dataDir),
    results:   loadResults(dataDir),
    h2h:       loadH2H(dataDir),
    odds:      loadOdds(dataDir),
    matches:   loadQatar2022Matches(dataDir),
  }
}

function calcDataQuality(h2hCount: number, formCount: number, hasOdds: boolean): number {
  let score = 40
  if (h2hCount >= 3) score += 15
  if (formCount >= 3) score += 15
  if (hasOdds)        score += 10
  return score
}

function makeTeam(name: string, loaders: BacktestLoaders): TeamStrength {
  const s = loaders.strengths.get(name) ?? { attack: 1.0, defense: 1.0 }
  return {
    id:              TEAM_IDS[name] ?? -99,
    name,
    country:         name,
    groupName:       TEAM_GROUPS[name] ?? "?",
    fifaRanking:     loaders.rankings.get(name) ?? 80,
    attackStrength:  s.attack,
    defenseStrength: s.defense,
  }
}

export function buildMatchData(
  home: string,
  away: string,
  matchDate: string,
  fixtureId: number,
  loaders: BacktestLoaders,
  stage = "Group Stage",
): MatchData {
  const homeForm = (loaders.results.get(home) ?? [])
    .filter(r => r.date < matchDate)
    .slice(0, 5)
  const awayForm = (loaders.results.get(away) ?? [])
    .filter(r => r.date < matchDate)
    .slice(0, 5)

  const h2hKey = [home, away].sort().join("||")
  const h2hRecords = loaders.h2h.get(h2hKey) ?? []

  const oddsEntry = loaders.odds.get(`${home}||${away}`)
  const now = new Date().toISOString()
  const odds: MarketOdds[] = oddsEntry
    ? [
        { market: "h2h", selection: home, odds: oddsEntry.h, bookmaker: "Best", updatedAt: now },
        { market: "h2h", selection: "Draw", odds: oddsEntry.d, bookmaker: "Best", updatedAt: now },
        { market: "h2h", selection: away, odds: oddsEntry.a, bookmaker: "Best", updatedAt: now },
      ]
    : []

  return {
    fixture: {
      id:         fixtureId,
      date:       matchDate,
      stadium:    "Qatar Stadium",
      city:       "Qatar",
      altitudeM:  10,
      homeTeamId: TEAM_IDS[home] ?? -99,
      awayTeamId: TEAM_IDS[away] ?? -99,
      stage,
    },
    teams: {
      home: makeTeam(home, loaders),
      away: makeTeam(away, loaders),
    },
    h2h:       h2hRecords,
    homeForm,
    awayForm,
    injuries:  { home: [], away: [] },
    lineups:   { home: null, away: null },
    referee:   null,
    weather:   { tempC: 25, humidity: 55 },
    odds,
    dataQuality: calcDataQuality(h2hRecords.length, homeForm.length, odds.length > 0),
    fetchedAt: now,
  }
}
