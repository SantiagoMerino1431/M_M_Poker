import type { MatchData, MarketResult } from "../../types"

export function makeMockMatchData(overrides: Partial<MatchData> = {}): MatchData {
  return {
    fixture: {
      id: 1,
      date: "2026-06-15T18:00:00Z",
      stadium: "MetLife Stadium",
      city: "East Rutherford",
      altitudeM: 5,
      homeTeamId: 29,
      awayTeamId: 37,
      stage: "Group H",
    },
    teams: {
      home: {
        id: 29, name: "España", country: "ESP", groupName: "H",
        fifaRanking: 1, attackStrength: 1.45, defenseStrength: 0.70,
      },
      away: {
        id: 37, name: "Argentina", country: "ARG", groupName: "J",
        fifaRanking: 2, attackStrength: 1.50, defenseStrength: 0.75,
      },
    },
    h2h: [],
    homeForm: [],
    awayForm: [],
    injuries: { home: [], away: [] },
    lineups: { home: null, away: null },
    referee: null,
    weather: { tempC: 24, humidity: 60 },
    odds: [
      { market: "h2h", selection: "España", odds: 2.10, bookmaker: "bet365", updatedAt: new Date().toISOString() },
      { market: "h2h", selection: "Draw", odds: 3.40, bookmaker: "bet365", updatedAt: new Date().toISOString() },
      { market: "h2h", selection: "Argentina", odds: 3.20, bookmaker: "bet365", updatedAt: new Date().toISOString() },
      { market: "totals", selection: "Over 2.5", odds: 1.90, bookmaker: "bet365", updatedAt: new Date().toISOString() },
      { market: "totals", selection: "Under 2.5", odds: 1.95, bookmaker: "bet365", updatedAt: new Date().toISOString() },
    ],
    dataQuality: 55,
    fetchedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makeMockMarketResult(overrides: Partial<MarketResult> = {}): MarketResult {
  return {
    name: "1X2",
    selection: "home",
    ourProbability: 0.48,
    bookmakerProbability: 0.42,
    odds: 2.10,
    bookmaker: "bet365",
    EV: 0.008,
    edge: 0.06,
    kellyFraction: 0.028,
    kellyAmount: 42,
    correlationGroup: "result",
    isRecommended: true,
    oddsStale: false,
    ...overrides,
  }
}
