import { describe, it, expect } from "vitest"
import { DEFAULT_SETTINGS, mergeSettings, effectiveBetMode } from "../config/settings"

describe("settings", () => {
  it("paperOnly arranca en true (blindado por defecto)", () => {
    expect(DEFAULT_SETTINGS.paperOnly).toBe(true)
  })
  it("mergeSettings completa con defaults", () => {
    const s = mergeSettings({ kellyFraction: 0.25 })
    expect(s.kellyFraction).toBe(0.25)
    expect(s.maxStakeFraction).toBe(DEFAULT_SETTINGS.maxStakeFraction)
  })
  it("effectiveBetMode fuerza paper cuando paperOnly", () => {
    expect(effectiveBetMode("real", true)).toBe("paper")
    expect(effectiveBetMode("real", false)).toBe("real")
    expect(effectiveBetMode("paper", false)).toBe("paper")
  })
})
