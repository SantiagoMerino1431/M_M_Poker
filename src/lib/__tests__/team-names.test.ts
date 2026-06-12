import { describe, it, expect } from "vitest"
import { toEnglish, toSpanish, matchesTeam } from "../data/team-names"

describe("team-names", () => {
  it("traduce español a inglés", () => {
    expect(toEnglish("Estados Unidos")).toBe("United States")
    expect(toEnglish("Canadá")).toBe("Canada")
  })

  it("traduce inglés a español", () => {
    expect(toSpanish("Canada")).toBe("Canadá")
    expect(toSpanish("United States")).toBe("Estados Unidos")
  })

  it("matchesTeam empareja variantes ES/EN y de la API", () => {
    expect(matchesTeam("Canadá", "Canada")).toBe(true)
    expect(matchesTeam("Estados Unidos", "USA")).toBe(true)
    expect(matchesTeam("Bosnia y Herzegovina", "Bosnia & Herzegovina")).toBe(true)
    expect(matchesTeam("Canadá", "Bosnia & Herzegovina")).toBe(false)
  })
})
