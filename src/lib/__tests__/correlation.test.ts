import { describe, it, expect } from "vitest"
import { correlationWarnings } from "../engine/correlation"

const bet = (market: string, selection: string, fixtureId = 1) => ({ fixtureId, market, selection } as any)

describe("correlationWarnings", () => {
  it("avisa Over + BTTS Sí en el mismo partido", () => {
    const w = correlationWarnings([bet("Over/Under", "over_2.5"), bet("BTTS", "yes")])
    expect(w.length).toBe(1)
    expect(w[0]).toMatch(/correlaci/i)
  })
  it("no avisa entre partidos distintos", () => {
    const w = correlationWarnings([bet("Over/Under", "over_2.5", 1), bet("BTTS", "yes", 2)])
    expect(w.length).toBe(0)
  })
  it("avisa 1X2 local + Doble Oportunidad 1X (solapadas)", () => {
    const w = correlationWarnings([bet("1X2", "home"), bet("Doble Oportunidad", "1X")])
    expect(w.length).toBe(1)
  })
  it("sin pares correlacionados no avisa", () => {
    const w = correlationWarnings([bet("1X2", "home"), bet("BTTS", "no")])
    expect(w.length).toBe(0)
  })
})
