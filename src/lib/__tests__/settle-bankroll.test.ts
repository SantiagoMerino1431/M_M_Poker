import { describe, it, expect } from "vitest"
import { nextBalanceAfterSettle } from "../kelly/bankroll"

describe("nextBalanceAfterSettle", () => {
  it("suma la ganancia neta en un win", () => {
    expect(nextBalanceAfterSettle(100000, "win", 5000, 1.9)).toBe(100000 + Math.round(5000 * 0.9))
  })
  it("resta el stake en un loss", () => {
    expect(nextBalanceAfterSettle(100000, "loss", 5000, 1.9)).toBe(95000)
  })
  it("no cambia en void", () => {
    expect(nextBalanceAfterSettle(100000, "void", 5000, 1.9)).toBe(100000)
  })
})
