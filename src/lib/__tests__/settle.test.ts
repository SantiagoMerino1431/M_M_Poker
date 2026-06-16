import { describe, it, expect } from "vitest"
import { betResultForScore } from "../engine/settle"

describe("betResultForScore", () => {
  it("1X2 home win", () => {
    expect(betResultForScore("1X2", "home", 2, 1)).toBe("win")
  })
  it("1X2 home loss", () => {
    expect(betResultForScore("1X2", "home", 1, 2)).toBe("loss")
  })
  it("1X2 draw", () => {
    expect(betResultForScore("1X2", "draw", 1, 1)).toBe("win")
    expect(betResultForScore("1X2", "draw", 1, 0)).toBe("loss")
  })
  it("Over/Under over_2.5", () => {
    expect(betResultForScore("Over/Under", "over_2.5", 2, 1)).toBe("win")
    expect(betResultForScore("Over/Under", "over_2.5", 1, 1)).toBe("loss")
  })
  it("Over/Under under_2.5", () => {
    expect(betResultForScore("Over/Under", "under_2.5", 1, 0)).toBe("win")
    expect(betResultForScore("Over/Under", "under_2.5", 2, 1)).toBe("loss")
  })
  it("BTTS yes", () => {
    expect(betResultForScore("BTTS", "yes", 1, 1)).toBe("win")
    expect(betResultForScore("BTTS", "yes", 1, 0)).toBe("loss")
  })
  it("BTTS no", () => {
    expect(betResultForScore("BTTS", "no", 1, 0)).toBe("win")
    expect(betResultForScore("BTTS", "no", 1, 1)).toBe("loss")
  })
  it("Exact score match", () => {
    expect(betResultForScore("Marcador Exacto", "2-1", 2, 1)).toBe("win")
    expect(betResultForScore("Marcador Exacto", "2-1", 1, 2)).toBe("loss")
  })
  it("unknown market returns null", () => {
    expect(betResultForScore("Handicap", "team_a", 2, 1)).toBe(null)
  })
})
