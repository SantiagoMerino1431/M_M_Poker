import { describe, it, expect } from "vitest"
import { closingOddsForBet } from "../kelly/metrics"
import type { MarketOdds } from "../types"

const closing: MarketOdds[] = [
  { market: "h2h", selection: "Canada", odds: 1.75, bookmaker: "a", updatedAt: "" },
  { market: "h2h", selection: "Canada", odds: 1.80, bookmaker: "b", updatedAt: "" },
  { market: "totals", selection: "Over 2.5", odds: 2.05, bookmaker: "a", updatedAt: "" },
]

describe("closingOddsForBet", () => {
  it("devuelve la mediana de cierre para 1X2 home por nombre de equipo", () => {
    const o = closingOddsForBet(closing, "1X2", "home", "Canadá", "Bosnia y Herzegovina")
    expect(o).toBeCloseTo(1.775, 3)
  })
  it("devuelve la cuota de cierre para Over 2.5", () => {
    const o = closingOddsForBet(closing, "Over/Under", "over_2.5", "Canadá", "Bosnia y Herzegovina")
    expect(o).toBe(2.05)
  })
  it("null cuando no hay cuota de cierre para esa selección", () => {
    const o = closingOddsForBet(closing, "BTTS", "yes", "Canadá", "Bosnia y Herzegovina")
    expect(o).toBeNull()
  })
})
