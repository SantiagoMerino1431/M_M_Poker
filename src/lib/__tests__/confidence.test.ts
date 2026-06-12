import { describe, it, expect } from "vitest"
import { calcConfidence } from "../engine/analyzer"

describe("calcConfidence", () => {
  it("sin divergencia, confidence ~= dataQuality", () => {
    expect(calcConfidence(70, 0.03)).toBe(70)
  })

  it("divergencia grande vs mercado penaliza fuerte (puede caer bajo 40)", () => {
    // 25 puntos de divergencia en 1X2 -> probable bug o ruido
    expect(calcConfidence(55, 0.25)).toBeLessThan(40)
  })

  it("nunca devuelve fuera de [0,100]", () => {
    expect(calcConfidence(100, 0)).toBeLessThanOrEqual(100)
    expect(calcConfidence(40, 0.9)).toBeGreaterThanOrEqual(0)
  })
})
