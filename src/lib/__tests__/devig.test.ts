import { describe, it, expect } from "vitest"
import { devig, median, consensusOdds } from "../model/devig"

describe("devig", () => {
  it("las probabilidades de-viggeadas suman 1", () => {
    const probs = devig([1.85, 3.35, 4.40])
    const sum = probs.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 6)
  })

  it("elimina el overround proporcionalmente (favorito sigue siendo favorito)", () => {
    const probs = devig([1.85, 3.35, 4.40])
    expect(probs[0]).toBeGreaterThan(probs[1])
    expect(probs[1]).toBeGreaterThan(probs[2])
    // Sin vig, la prob del favorito es menor que la implícita cruda (1/1.85=0.54)
    expect(probs[0]).toBeLessThan(1 / 1.85)
  })
})

describe("median", () => {
  it("calcula la mediana de un set impar", () => {
    expect(median([2.0, 1.85, 1.9])).toBe(1.9)
  })
  it("calcula la mediana de un set par", () => {
    expect(median([1.8, 1.9, 2.0, 2.2])).toBeCloseTo(1.95, 6)
  })
})

describe("consensusOdds", () => {
  it("agrega cuotas de varios bookmakers por selección (mediana)", () => {
    const odds = [
      { market: "h2h", selection: "Canada", odds: 1.80, bookmaker: "a", updatedAt: "" },
      { market: "h2h", selection: "Canada", odds: 1.90, bookmaker: "b", updatedAt: "" },
      { market: "h2h", selection: "Canada", odds: 1.85, bookmaker: "c", updatedAt: "" },
    ]
    const c = consensusOdds(odds, "h2h", ["Canada"])
    expect(c.get("Canada")).toBe(1.85)
  })
})
