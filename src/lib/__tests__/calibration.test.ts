import { describe, it, expect } from "vitest"
import { calibrationReport } from "../engine/calibration"
import type { Bet } from "../types"

function makeBet(overrides: Partial<Bet>): Bet {
  return {
    id: 1, fixtureId: 1, market: "1X2", selection: "home",
    ourProbability: 0.6, bookmakerProbability: 0.5,
    oddsUsed: 2.0, oddsClosing: null,
    amount: 10000, kellySuggested: 5000, EV: 0.1, edge: 0.1,
    result: "win", profitLoss: 10000, mode: "real",
    confidenceAtTime: 70, createdAt: "2026-06-15T10:00:00Z", settledAt: "2026-06-15T12:00:00Z",
    ...overrides,
  } as Bet
}

describe("calibrationReport", () => {
  it("empty bets returns zeroed report", () => {
    const r = calibrationReport([])
    expect(r.totalBets).toBe(0)
    expect(r.brierScore).toBe(null)
    expect(r.clvAvg).toBe(null)
  })

  it("computes win rate and profit correctly", () => {
    const bets = [
      makeBet({ result: "win", profitLoss: 10000 }),
      makeBet({ result: "loss", profitLoss: -10000 }),
    ]
    const r = calibrationReport(bets)
    expect(r.winRate).toBeCloseTo(0.5)
    expect(r.totalProfit).toBe(0)
  })

  it("Brier score: perfect predictor scores 0", () => {
    const bets = [
      makeBet({ ourProbability: 1.0, result: "win" }),
      makeBet({ ourProbability: 0.0, result: "loss" }),
    ]
    const r = calibrationReport(bets)
    expect(r.brierScore).toBeCloseTo(0)
  })

  it("CLV avg positive when closing odds better than our odds", () => {
    // oddsUsed=2.0, oddsClosing=1.8 means market moved against us (closing shorter = we got value)
    const bets = [makeBet({ oddsUsed: 2.0, oddsClosing: 1.8 })]
    const r = calibrationReport(bets)
    expect(r.clvAvg).toBeGreaterThan(0)
  })

  it("produces 10 calibration buckets", () => {
    const bets = Array.from({ length: 20 }, (_, i) =>
      makeBet({ ourProbability: (i + 1) / 20, result: i % 2 === 0 ? "win" : "loss" })
    )
    const r = calibrationReport(bets)
    expect(r.buckets.length).toBe(10)
  })
})
