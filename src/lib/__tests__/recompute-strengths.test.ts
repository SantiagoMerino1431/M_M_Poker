import { describe, it, expect } from "vitest"
import { replayStrengths } from "../model/recompute-strengths"
import type { StrengthSnapshot } from "../model/feedback"

const seed: StrengthSnapshot = { homeAttack: 1.2, homeDefense: 0.9, awayAttack: 1.0, awayDefense: 1.0 }

describe("replayStrengths", () => {
  it("zero results returns seed", () => {
    const out = replayStrengths(seed, [])
    expect(out).toEqual(seed)
  })

  it("single result mutates from seed", () => {
    const out = replayStrengths(seed, [{ homeGoals: 2, awayGoals: 0 }])
    expect(out.homeAttack).not.toEqual(seed.homeAttack)
  })

  it("is idempotent for same input", () => {
    const results = [
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 0, awayGoals: 3 },
    ]
    const a = replayStrengths(seed, results)
    const b = replayStrengths(seed, results)
    expect(a).toEqual(b)
  })

  it("different order produces different result", () => {
    const r1 = { homeGoals: 3, awayGoals: 0 }
    const r2 = { homeGoals: 0, awayGoals: 3 }
    const a = replayStrengths(seed, [r1, r2])
    const b = replayStrengths(seed, [r2, r1])
    // Order matters — EMA is sequential
    expect(a.homeAttack).not.toEqual(b.homeAttack)
  })
})
