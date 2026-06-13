import { describe, it, expect } from "vitest"
import { selectionLabel, MARKET_GROUPS, marketGroupOf } from "../engine/market-labels"

describe("selectionLabel", () => {
  it("traduce 1X2 con nombres de equipo", () => {
    expect(selectionLabel("1X2", "home", "Brasil", "Croacia")).toBe("Brasil gana")
    expect(selectionLabel("1X2", "draw", "Brasil", "Croacia")).toBe("Empate")
    expect(selectionLabel("1X2", "away", "Brasil", "Croacia")).toBe("Croacia gana")
  })
  it("traduce Over/Under", () => {
    expect(selectionLabel("Over/Under", "over_2.5", "A", "B")).toBe("Más de 2.5")
    expect(selectionLabel("Over/Under", "under_1.5", "A", "B")).toBe("Menos de 1.5")
  })
  it("traduce BTTS y Doble Oportunidad", () => {
    expect(selectionLabel("BTTS", "yes", "A", "B")).toBe("Ambos anotan — Sí")
    expect(selectionLabel("Doble Oportunidad", "1X", "A", "B")).toBe("Local o Empate (1X)")
  })
  it("agrupa los nombres de mercado conocidos", () => {
    expect(marketGroupOf("1X2")).toBe("Resultado")
    expect(marketGroupOf("Over/Under")).toBe("Goles")
    expect(MARKET_GROUPS.map(g => g.key)).toContain("Resultado")
  })
})
