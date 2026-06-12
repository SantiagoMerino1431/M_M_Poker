import { describe, it, expect } from "vitest"
import { calcH2HFactor } from "../model/h2h"
import type { H2HRecord } from "../types"

function makeRecord(monthsAgo: number, homeId: number, awayId: number, homeGoals: number, awayGoals: number): H2HRecord {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  return {
    date: d.toISOString().split("T")[0],
    homeTeamId: homeId,
    awayTeamId: awayId,
    homeGoals,
    awayGoals,
    competition: "qualifier",
  }
}

describe("calcH2HFactor — temporal decay", () => {
  it("ignora el decaimiento si todos los partidos son recientes (mismo resultado que antes)", () => {
    // Equipo 1 ganó 4 de 5 partidos recientes => multiplier > 1
    const records: H2HRecord[] = [
      makeRecord(1, 1, 2, 2, 0),
      makeRecord(3, 1, 2, 1, 0),
      makeRecord(6, 1, 2, 2, 1),
      makeRecord(9, 1, 2, 1, 0),
      makeRecord(12, 2, 1, 0, 1),
    ]
    const { attackMultiplier } = calcH2HFactor(records, 1)
    expect(attackMultiplier).toBeGreaterThan(1.0)
  })

  it("partidos muy viejos pesan menos que partidos recientes", () => {
    // Caso A: reciente (1 mes) es una derrota, antiguo (36 meses) es una victoria
    const weightedTowardLoss: H2HRecord[] = [
      makeRecord(1, 2, 1, 2, 0),  // derrota reciente — peso alto
      makeRecord(36, 1, 2, 3, 0), // victoria lejana — peso bajo
    ]
    // Caso B: reciente (1 mes) es una victoria, antiguo (36 meses) es una derrota
    const weightedTowardWin: H2HRecord[] = [
      makeRecord(1, 1, 2, 2, 0),  // victoria reciente — peso alto
      makeRecord(36, 2, 1, 3, 0), // derrota lejana — peso bajo
    ]
    const { attackMultiplier: multLoss } = calcH2HFactor(weightedTowardLoss, 1)
    const { attackMultiplier: multWin } = calcH2HFactor(weightedTowardWin, 1)
    expect(multWin).toBeGreaterThan(multLoss)
  })

  it("sin registros devuelve multiplier 1.0", () => {
    const { attackMultiplier } = calcH2HFactor([], 1)
    expect(attackMultiplier).toBe(1.0)
  })

  it("multiplier nunca sale del rango [0.85, 1.15]", () => {
    const allWins: H2HRecord[] = Array.from({ length: 10 }, (_, i) =>
      makeRecord(i * 2 + 1, 1, 2, 5, 0)
    )
    const { attackMultiplier } = calcH2HFactor(allWins, 1)
    expect(attackMultiplier).toBeLessThanOrEqual(1.15)
    expect(attackMultiplier).toBeGreaterThanOrEqual(0.85)
  })
})
