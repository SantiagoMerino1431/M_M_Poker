import { describe, it, expect } from "vitest"
import path from "path"
import { loadRankings, loadTeamStrengths, loadResults, loadH2H, loadFormerNames, loadQatar2022Matches, loadOdds } from "../loaders"
import { QATAR_START } from "../constants"

const DATA = path.resolve(process.cwd(), "data")

describe("loadRankings", () => {
  it("returns a ranking for each WC 2022 team", () => {
    const rankings = loadRankings(DATA)
    expect(rankings.get("Brazil")).toBe(1)
    expect(rankings.get("Argentina")).toBe(3)
    expect(rankings.get("France")).toBe(4)
    expect(rankings.get("Qatar")).toBeDefined()
    expect(rankings.get("USA")).toBeDefined()
  })

  it("returns numbers between 1 and 210", () => {
    const rankings = loadRankings(DATA)
    for (const [, rank] of rankings) {
      expect(rank).toBeGreaterThan(0)
      expect(rank).toBeLessThanOrEqual(210)
    }
  })
})

describe("loadTeamStrengths", () => {
  it("returns strengths for WC 2022 teams", () => {
    const strengths = loadTeamStrengths(DATA)
    expect(strengths.get("Brazil")).toBeDefined()
    expect(strengths.get("Qatar")).toBeDefined()
    expect(strengths.get("USA")).toBeDefined()
  })

  it("normalizes strengths so average attack is between 0.7 and 1.3", () => {
    const strengths = loadTeamStrengths(DATA)
    const attacks = [...strengths.values()].map(s => s.attack)
    const avg = attacks.reduce((a, b) => a + b, 0) / attacks.length
    expect(avg).toBeGreaterThan(0.7)
    expect(avg).toBeLessThan(1.3)
  })

  it("caps strengths at [0.5, 2.0]", () => {
    const strengths = loadTeamStrengths(DATA)
    for (const [, s] of strengths) {
      expect(s.attack).toBeGreaterThanOrEqual(0.5)
      expect(s.attack).toBeLessThanOrEqual(2.0)
      expect(s.defense).toBeGreaterThanOrEqual(0.5)
      expect(s.defense).toBeLessThanOrEqual(2.0)
    }
  })
})

describe("loadFormerNames", () => {
  it("maps West Germany to Germany", () => {
    const map = loadFormerNames(DATA)
    expect(map.get("West Germany")).toBe("Germany")
  })
})

describe("loadResults", () => {
  it("returns form records for WC 2022 teams", () => {
    const results = loadResults(DATA)
    expect(results.get("Brazil")?.length).toBeGreaterThan(10)
    expect(results.get("USA")?.length).toBeGreaterThan(0)
  })

  it("form records are ordered newest first", () => {
    const results = loadResults(DATA)
    const brazil = results.get("Brazil")!
    for (let i = 1; i < brazil.length; i++) {
      expect(brazil[i - 1].date >= brazil[i].date).toBe(true)
    }
  })

  it("all records are before Qatar start date", () => {
    const results = loadResults(DATA)
    for (const [, records] of results) {
      for (const r of records) {
        expect(r.date < QATAR_START).toBe(true)
      }
    }
  })
})

describe("loadH2H", () => {
  it("returns H2H history for Argentina vs Brazil", () => {
    const h2h = loadH2H(DATA)
    const key = ["Argentina", "Brazil"].sort().join("||")
    expect(h2h.get(key)?.length).toBeGreaterThan(3)
  })

  it("classifies FIFA World Cup matches as world_cup", () => {
    const h2h = loadH2H(DATA)
    const key = ["Germany", "Brazil"].sort().join("||")
    const records = h2h.get(key) ?? []
    const hasWC = records.some(r => r.competition === "world_cup")
    expect(hasWC).toBe(true)
  })

  it("H2H records use synthetic negative team IDs", () => {
    const h2h = loadH2H(DATA)
    const key = ["France", "Argentina"].sort().join("||")
    const records = h2h.get(key) ?? []
    for (const r of records) {
      expect(r.homeTeamId).toBeLessThan(0)
      expect(r.awayTeamId).toBeLessThan(0)
    }
  })
})

describe("loadQatar2022Matches", () => {
  it("returns exactly 64 matches", () => {
    const matches = loadQatar2022Matches(DATA)
    expect(matches).toHaveLength(64)
  })

  it("matches are in chronological order", () => {
    const matches = loadQatar2022Matches(DATA)
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].date <= matches[i].date).toBe(true)
    }
  })

  it("first match is Qatar vs Ecuador", () => {
    const matches = loadQatar2022Matches(DATA)
    expect(matches[0].home).toBe("Qatar")
    expect(matches[0].away).toBe("Ecuador")
    expect(matches[0].homeScore).toBe(0)
    expect(matches[0].awayScore).toBe(2)
  })

  it("final is Argentina vs France", () => {
    const matches = loadQatar2022Matches(DATA)
    const final = matches[matches.length - 1]
    const teams = [final.home, final.away].sort().join("-")
    expect(teams).toBe("Argentina-France")
  })
})

describe("loadOdds", () => {
  it("returns odds for Qatar vs Ecuador", () => {
    const odds = loadOdds(DATA)
    const entry = odds.get("Qatar||Ecuador")
    expect(entry).toBeDefined()
    expect(entry!.h).toBeCloseTo(100.0, 0)
    expect(entry!.d).toBeCloseTo(13.5, 0)
    expect(entry!.a).toBeCloseTo(2.41, 1)
  })

  it("returns odds for the final", () => {
    const odds = loadOdds(DATA)
    const entry = odds.get("Argentina||France")
    expect(entry).toBeDefined()
    expect(entry!.h).toBeGreaterThan(1.0)
  })

  it("returns close to 64 entries", () => {
    const odds = loadOdds(DATA)
    expect(odds.size).toBeGreaterThanOrEqual(60)
  })
})
