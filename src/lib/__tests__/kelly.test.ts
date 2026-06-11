import { describe, it, expect } from "vitest"
import { calcKelly } from "../kelly/criterion"
import { applyDailyLimit, detectCorrelation } from "../kelly/portfolio"
import { calcMetrics } from "../kelly/metrics"
import type { Bet } from "../types"

describe("calcKelly", () => {
  it("retorna fraccion positiva cuando hay edge real", () => {
    const result = calcKelly({ probability: 0.55, odds: 2.10, bankroll: 1000, confidence: 80 })
    expect(result.fraction).toBeGreaterThan(0)
    expect(result.amount).toBeGreaterThan(0)
  })

  it("retorna fraccion 0 cuando EV es negativo", () => {
    const result = calcKelly({ probability: 0.30, odds: 2.10, bankroll: 1000, confidence: 80 })
    expect(result.fraction).toBe(0)
    expect(result.amount).toBe(0)
  })

  it("nunca supera el 8% del bankroll", () => {
    const result = calcKelly({ probability: 0.90, odds: 2.10, bankroll: 1000, confidence: 100 })
    expect(result.amount).toBeLessThanOrEqual(80)
  })

  it("confidence bajo reduce el monto", () => {
    const high = calcKelly({ probability: 0.55, odds: 2.10, bankroll: 1000, confidence: 80 })
    const low  = calcKelly({ probability: 0.55, odds: 2.10, bankroll: 1000, confidence: 50 })
    expect(low.amount).toBeLessThan(high.amount)
  })
})

describe("applyDailyLimit", () => {
  it("reduce montos si la exposicion total supera el 15%", () => {
    const bets = [
      { amount: 80, kellyFraction: 0.08 },
      { amount: 80, kellyFraction: 0.08 },
      { amount: 80, kellyFraction: 0.08 },
    ]
    const adjusted = applyDailyLimit(bets, 1000)
    const total = adjusted.reduce((s, b) => s + b.amount, 0)
    expect(total).toBeLessThanOrEqual(150)
  })

  it("no modifica si la exposicion es menor al 15%", () => {
    const bets = [{ amount: 30, kellyFraction: 0.03 }]
    const adjusted = applyDailyLimit(bets, 1000)
    expect(adjusted[0].amount).toBe(30)
  })
})

describe("detectCorrelation", () => {
  it("detecta correlacion alta entre 1X2 y exact_score del mismo partido", () => {
    const result = detectCorrelation("result", "exact_score", 1)
    expect(result).toBe("high")
  })

  it("detecta correlacion baja entre resultado y corners", () => {
    const result = detectCorrelation("result", "corners", 1)
    expect(result).toBe("low")
  })
})

describe("calcMetrics", () => {
  const bets: Bet[] = [
    { id: 1, fixtureId: 1, market: "1X2", selection: "home", ourProbability: 0.55, bookmakerProbability: 0.48, oddsUsed: 1.95, oddsClosing: 1.85, amount: 50, kellySuggested: 50, EV: 0.07, edge: 0.07, result: "win", profitLoss: 47.5, mode: "real", confidenceAtTime: 75, createdAt: "2026-06-11T20:00:00Z", settledAt: "2026-06-11T22:00:00Z" },
    { id: 2, fixtureId: 2, market: "Over/Under", selection: "over_2.5", ourProbability: 0.60, bookmakerProbability: 0.52, oddsUsed: 1.90, oddsClosing: 1.95, amount: 40, kellySuggested: 40, EV: 0.05, edge: 0.08, result: "loss", profitLoss: -40, mode: "real", confidenceAtTime: 70, createdAt: "2026-06-12T15:00:00Z", settledAt: "2026-06-12T17:00:00Z" },
  ]

  it("calcula ROI correctamente", () => {
    const metrics = calcMetrics(bets)
    expect(metrics.ROI).toBeCloseTo((47.5 - 40) / 90 * 100, 1)
  })

  it("calcula strike rate correctamente", () => {
    const metrics = calcMetrics(bets)
    expect(metrics.strikeRate).toBeCloseTo(0.5, 2)
  })

  it("CLV positivo cuando se apostó antes del movimiento de línea", () => {
    const metrics = calcMetrics(bets)
    expect(metrics.avgCLV).toBeGreaterThan(0)
  })
})
