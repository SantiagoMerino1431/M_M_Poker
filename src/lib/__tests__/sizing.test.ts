import { describe, it, expect } from "vitest"
import { kellyStake, KELLY_FRACTION, confidenceMultiplier } from "../kelly/sizing"

describe("kellyStake", () => {
  it("usa half-Kelly (0.5) y multiplicador de confianza", () => {
    // p=0.55, odds=2.0 -> rawKelly = (0.55*1 - 0.45)/1 = 0.10
    // half-Kelly 0.5, confianza 80 -> mult 1.0 -> fraction 0.05
    const r = kellyStake({ probability: 0.55, odds: 2.0, bankroll: 100000, confidence: 80 })
    expect(KELLY_FRACTION).toBe(0.5)
    expect(r.fraction).toBeCloseTo(0.05, 4)
    expect(r.amount).toBe(5000)
  })
  it("aplica tope de 8% por apuesta", () => {
    const r = kellyStake({ probability: 0.9, odds: 2.0, bankroll: 100000, confidence: 80 })
    expect(r.fraction).toBeCloseTo(0.08, 4)
    expect(r.amount).toBe(8000)
  })
  it("confianza <40 anula la apuesta", () => {
    expect(confidenceMultiplier(39)).toBe(0)
    const r = kellyStake({ probability: 0.6, odds: 2.0, bankroll: 100000, confidence: 39 })
    expect(r.fraction).toBe(0)
    expect(r.amount).toBe(0)
  })
  it("EV negativo da 0", () => {
    const r = kellyStake({ probability: 0.4, odds: 2.0, bankroll: 100000, confidence: 80 })
    expect(r.fraction).toBe(0)
  })
})
