import { describe, it, expect } from "vitest"
import { dataQualityFromData } from "../engine/analyzer"
import type { MatchData } from "../types"

function base(overrides: Partial<MatchData> = {}): MatchData {
  return {
    fixture: { id: 1, date: "", stadium: "", city: "", altitudeM: 0, homeTeamId: 1, awayTeamId: 2, stage: "group_A" },
    teams: { home: {} as any, away: {} as any },
    h2h: [], homeForm: [], awayForm: [],
    injuries: { home: [], away: [] },
    lineups: { home: null, away: null },
    referee: null, weather: null, odds: [], dataQuality: 0, fetchedAt: "",
    ...overrides,
  }
}

describe("dataQualityFromData", () => {
  it("tener lineup suma 15 sobre no tenerlo", () => {
    const sin = dataQualityFromData(base())
    const con = dataQualityFromData(base({ lineups: { home: [{} as any], away: [{} as any] } }))
    expect(con - sin).toBe(15)
  })
  it("lineup confirmado suma 5 extra sobre disponible", () => {
    const disp = dataQualityFromData(base({ lineups: { home: [{} as any], away: [{} as any] } }))
    const conf = dataQualityFromData(base({ lineups: { home: [{} as any], away: [{} as any] }, lineupConfirmed: true }))
    expect(conf - disp).toBe(5)
  })
})
