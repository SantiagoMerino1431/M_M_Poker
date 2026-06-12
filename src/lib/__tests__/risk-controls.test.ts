import { describe, it, expect } from "vitest"
import { checkBetAllowed } from "../kelly/portfolio"

describe("checkBetAllowed", () => {
  it("bloquea apuestas reales en modo paused", () => {
    const r = checkBetAllowed({ mode: "paused", bankroll: 100000, todayRealStaked: 0, newAmount: 5000, betMode: "real" })
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/pausa/i)
  })

  it("permite apuestas paper aunque esté paused", () => {
    const r = checkBetAllowed({ mode: "paused", bankroll: 100000, todayRealStaked: 0, newAmount: 5000, betMode: "paper" })
    expect(r.allowed).toBe(true)
  })

  it("recorta el monto si excede el 15% de exposición diaria", () => {
    const r = checkBetAllowed({ mode: "normal", bankroll: 100000, todayRealStaked: 13000, newAmount: 5000, betMode: "real" })
    expect(r.allowed).toBe(true)
    expect(r.adjustedAmount).toBe(2000) // 15000 max - 13000 ya apostado
  })

  it("permite el monto completo si hay margen", () => {
    const r = checkBetAllowed({ mode: "normal", bankroll: 100000, todayRealStaked: 0, newAmount: 5000, betMode: "real" })
    expect(r.adjustedAmount).toBe(5000)
  })
})
