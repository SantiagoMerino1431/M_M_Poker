import { describe, it, expect } from "vitest"
import { kellyStake } from "../kelly/sizing"

describe("kellyStake overrides", () => {
  it("usa kellyFraction custom cuando se pasa", () => {
    // p=0.55, odds=2.0 -> rawKelly = (0.55*1 - 0.45)/1 = 0.10
    // with fraction 0.25 and conf 80 (mult 1.0) -> 0.10 * 0.25 * 1.0 = 0.025
    const r = kellyStake({ probability: 0.55, odds: 2.0, bankroll: 100000, confidence: 80, kellyFraction: 0.25 })
    expect(r.fraction).toBeCloseTo(0.025, 4)
    expect(r.amount).toBe(2500)
  })
  it("respeta maxStakeFraction custom como tope", () => {
    const r = kellyStake({ probability: 0.9, odds: 2.0, bankroll: 100000, confidence: 80, maxStakeFraction: 0.03 })
    expect(r.fraction).toBeCloseTo(0.03, 4)
    expect(r.amount).toBe(3000)
  })
  it("sin overrides mantiene el comportamiento por defecto (0.5, tope 0.08)", () => {
    const r = kellyStake({ probability: 0.55, odds: 2.0, bankroll: 100000, confidence: 80 })
    expect(r.fraction).toBeCloseTo(0.05, 4)
  })
})
