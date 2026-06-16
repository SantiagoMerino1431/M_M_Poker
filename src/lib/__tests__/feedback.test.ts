import { describe, it, expect } from "vitest"
import { updatedStrengths } from "../model/feedback"

const base = {
  homeAttack: 1.2, homeDefense: 0.9,
  awayAttack: 1.0, awayDefense: 1.0,
}

describe("updatedStrengths", () => {
  it("home overperforms attack: homeAttack increases", () => {
    const r = updatedStrengths({ ...base, homeGoals: 3, awayGoals: 0 })
    expect(r.homeAttack).toBeGreaterThan(base.homeAttack)
    expect(r.homeDefense).toBeLessThan(base.homeDefense)
  })

  it("home underperforms: homeAttack decreases", () => {
    const r = updatedStrengths({ ...base, homeGoals: 0, awayGoals: 3 })
    expect(r.homeAttack).toBeLessThan(base.homeAttack)
    expect(r.homeDefense).toBeGreaterThan(base.homeDefense)
  })

  it("clamps to [0.5, 2.0] on extreme result", () => {
    const extreme = { homeAttack: 1.9, homeDefense: 0.55, awayAttack: 0.55, awayDefense: 1.9 }
    const r = updatedStrengths({ ...extreme, homeGoals: 10, awayGoals: 0 })
    expect(r.homeAttack).toBeLessThanOrEqual(2.0)
    expect(r.awayDefense).toBeGreaterThanOrEqual(0.5)
  })

  it("draw near expected: very small change", () => {
    // expected ~1.2*1.0=1.2 home, 1.0*0.9=0.9 away
    const r = updatedStrengths({ ...base, homeGoals: 1, awayGoals: 1 })
    expect(Math.abs(r.homeAttack - base.homeAttack)).toBeLessThan(0.1)
  })
})
