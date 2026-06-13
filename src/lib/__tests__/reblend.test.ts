import { describe, it, expect } from "vitest"
import { reblendSelection } from "../engine/reblend"

describe("reblendSelection", () => {
  it("con cuotas de ambos lados de-vigga y re-mezcla 35/65", () => {
    // over@2.0 y under@2.0 -> implícitas 0.5/0.5, de-vig 0.5
    // modelo 0.60 -> mezcla = 0.35*0.6 + 0.65*0.5 = 0.535
    const r = reblendSelection(0.60, 2.0, 2.0)
    expect(r.marketProbability).toBeCloseTo(0.5, 4)
    expect(r.ourProbability).toBeCloseTo(0.535, 4)
  })
  it("sin lado opuesto aplica de-vig aproximado (/1.05)", () => {
    // odds 2.0 -> implícita 0.5 -> /1.05 ~ 0.476
    const r = reblendSelection(0.60, 2.0, null)
    expect(r.marketProbability).toBeCloseTo(0.476, 3)
    expect(r.ourProbability).toBeCloseTo(0.35 * 0.6 + 0.65 * 0.476, 3)
  })
})
