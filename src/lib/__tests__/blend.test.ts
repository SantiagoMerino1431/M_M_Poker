import { describe, it, expect } from "vitest"
import { blendProbability, MODEL_WEIGHT } from "../model/blend"

describe("blendProbability", () => {
  it("sin prob de mercado, devuelve la del modelo", () => {
    expect(blendProbability(0.62, null)).toBe(0.62)
  })

  it("mezcla hacia el mercado con el peso configurado", () => {
    const blended = blendProbability(0.62, 0.50)
    const expected = MODEL_WEIGHT * 0.62 + (1 - MODEL_WEIGHT) * 0.50
    expect(blended).toBeCloseTo(expected, 6)
  })

  it("el peso del modelo es conservador (<= 0.5)", () => {
    expect(MODEL_WEIGHT).toBeLessThanOrEqual(0.5)
    expect(MODEL_WEIGHT).toBeGreaterThan(0)
  })

  it("reduce el edge aparente: el blend queda entre modelo y mercado", () => {
    const blended = blendProbability(0.70, 0.50)
    expect(blended).toBeLessThan(0.70)
    expect(blended).toBeGreaterThan(0.50)
  })
})
