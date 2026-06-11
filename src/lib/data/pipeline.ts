import type { MatchData, TeamStrength } from "../types"
import { fetchTeamStats, fetchH2H, fetchRecentForm, fetchInjuries, fetchLineups, fetchReferee } from "./api-football"
import { fetchOdds } from "./odds-api"
import { fetchBDLOdds } from "./balldontlie"

const ALTITUDE_BY_CITY: Record<string, number> = {
  "Ciudad de México": 2240,
  "Mexico City": 2240,
  "Guadalajara": 1566,
  "Dallas": 180,
  "Miami": 2,
  "Los Angeles": 82,
  "New York": 5,
  "San Francisco": 16,
  "Seattle": 10,
  "Kansas City": 315,
  "Boston": 9,
  "Vancouver": 5,
  "Toronto": 76,
}

export async function buildMatchData(
  fixture: {
    id: number; date: string; stadium: string; city: string;
    altitudeM: number; homeTeamId: number; awayTeamId: number; stage: string
  },
  homeTeam: TeamStrength,
  awayTeam: TeamStrength
): Promise<MatchData> {
  const altitude = ALTITUDE_BY_CITY[fixture.city] ?? fixture.altitudeM ?? 0

  const [
    homeStatsUpdate,
    awayStatsUpdate,
    h2h,
    homeForm,
    awayForm,
    injuries,
    lineups,
    referee,
    apiOdds,
    bdlOdds,
  ] = await Promise.allSettled([
    fetchTeamStats(homeTeam.id),
    fetchTeamStats(awayTeam.id),
    fetchH2H(homeTeam.id, awayTeam.id),
    fetchRecentForm(homeTeam.id),
    fetchRecentForm(awayTeam.id),
    fetchInjuries(fixture.id),
    fetchLineups(fixture.id),
    fetchReferee(fixture.id),
    fetchOdds(homeTeam.name, awayTeam.name),
    fetchBDLOdds(homeTeam.name, awayTeam.name),
  ])

  const resolvedHome = homeStatsUpdate.status === "fulfilled" ? homeStatsUpdate.value : {}
  const resolvedAway = awayStatsUpdate.status === "fulfilled" ? awayStatsUpdate.value : {}

  const mergedHome: TeamStrength = { ...homeTeam, ...resolvedHome }
  const mergedAway: TeamStrength = { ...awayTeam, ...resolvedAway }

  const resolvedH2H = h2h.status === "fulfilled" ? h2h.value : []
  const resolvedHomeForm = homeForm.status === "fulfilled" ? homeForm.value : []
  const resolvedAwayForm = awayForm.status === "fulfilled" ? awayForm.value : []
  const resolvedInjuries = injuries.status === "fulfilled" ? injuries.value : { home: [], away: [] }
  const resolvedLineups = lineups.status === "fulfilled" ? lineups.value : { home: null, away: null }
  const resolvedReferee = referee.status === "fulfilled" ? referee.value : null
  const resolvedApiOdds = apiOdds.status === "fulfilled" ? apiOdds.value : []
  const resolvedBdlOdds = bdlOdds.status === "fulfilled" ? bdlOdds.value : []

  const allOdds = [...resolvedApiOdds, ...resolvedBdlOdds]
  const oddsStale = allOdds.length > 0 &&
    new Date().getTime() - new Date(allOdds[0].updatedAt).getTime() > 4 * 60 * 60 * 1000

  const dataQuality = calcDataQuality({
    hasH2H: resolvedH2H.length >= 3,
    hasForm: resolvedHomeForm.length >= 3 && resolvedAwayForm.length >= 3,
    hasLineup: resolvedLineups.home !== null,
    hasOdds: allOdds.length > 0 && !oddsStale,
    hasReferee: resolvedReferee !== null,
  })

  return {
    fixture: { ...fixture, altitudeM: altitude },
    teams: { home: mergedHome, away: mergedAway },
    h2h: resolvedH2H,
    homeForm: resolvedHomeForm,
    awayForm: resolvedAwayForm,
    injuries: resolvedInjuries,
    lineups: resolvedLineups,
    referee: resolvedReferee,
    weather: null,
    odds: allOdds,
    dataQuality,
    fetchedAt: new Date().toISOString(),
  }
}

function calcDataQuality(flags: {
  hasH2H: boolean; hasForm: boolean; hasLineup: boolean;
  hasOdds: boolean; hasReferee: boolean
}): number {
  let score = 40
  if (flags.hasH2H)    score += 15
  if (flags.hasForm)   score += 15
  if (flags.hasLineup) score += 15
  if (flags.hasOdds)   score += 10
  if (flags.hasReferee) score += 5
  return score
}
