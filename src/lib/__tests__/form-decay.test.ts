import { describe, it, expect } from "vitest"
import { calcFormFactor } from "../model/form"
import type { FormRecord } from "../types"

function makeRecord(monthsAgo: number, goalsFor: number, goalsAgainst: number, opponentRanking = 50): FormRecord {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  return {
    date: d.toISOString().split("T")[0],
    opponentRanking,
    goalsFor,
    goalsAgainst,
    isHome: true,
  }
}

describe("calcFormFactor — temporal decay", () => {
  it("sin registros devuelve factor 1.0", () => {
    expect(calcFormFactor([]).factor).toBe(1.0)
  })

  it("victoria reciente pesa más que victoria lejana", () => {
    // Team A: 1 victoria muy reciente + 1 derrota hace 36 meses
    const recentWin = [makeRecord(1, 2, 0), makeRecord(36, 0, 2)]
    // Team B: 1 derrota muy reciente + 1 victoria hace 36 meses
    const recentLoss = [makeRecord(1, 0, 2), makeRecord(36, 2, 0)]

    const { factor: factorWin } = calcFormFactor(recentWin)
    const { factor: factorLoss } = calcFormFactor(recentLoss)
    expect(factorWin).toBeGreaterThan(factorLoss)
  })

  it("serie de victorias recientes produce factor > 1.0", () => {
    const allWins = Array.from({ length: 5 }, (_, i) => makeRecord(i + 1, 2, 0))
    expect(calcFormFactor(allWins).factor).toBeGreaterThan(1.0)
  })

  it("serie de derrotas recientes produce factor < 1.0", () => {
    const allLosses = Array.from({ length: 5 }, (_, i) => makeRecord(i + 1, 0, 2))
    expect(calcFormFactor(allLosses).factor).toBeLessThan(1.0)
  })

  it("oponente fuerte (ranking 10) incrementa el peso de la victoria", () => {
    const vsStrong = [makeRecord(1, 2, 0, 10)]
    const vsWeak   = [makeRecord(1, 2, 0, 90)]
    expect(calcFormFactor(vsStrong).factor).toBeGreaterThanOrEqual(calcFormFactor(vsWeak).factor)
  })
})
