import { describe, it, expect } from "vitest"
import { lineupAttackMultiplier, lineupConcedeMultiplier } from "../model/lineup"

describe("lineup adjustments", () => {
  it("sin ausencias no cambia nada", () => {
    expect(lineupAttackMultiplier([])).toBe(1.0)
    expect(lineupConcedeMultiplier([])).toBe(1.0)
  })
  it("perder un goleador baja el ataque", () => {
    const m = lineupAttackMultiplier([{ goalsPer90: 0.8, key: true, position: "FWD" }])
    expect(m).toBeLessThan(1.0)
    expect(m).toBeGreaterThanOrEqual(0.8)
  })
  it("perder un defensa/portero sube los goles que se conceden", () => {
    const m = lineupConcedeMultiplier([{ key: true, position: "GK" }])
    expect(m).toBeGreaterThan(1.0)
    expect(m).toBeLessThanOrEqual(1.2)
  })
  it("ausencias sin goles conocidos usan importancia key/regular", () => {
    const key = lineupAttackMultiplier([{ key: true, position: "MID" }])
    const reg = lineupAttackMultiplier([{ key: false, position: "MID" }])
    expect(key).toBeLessThan(reg)
  })
})
