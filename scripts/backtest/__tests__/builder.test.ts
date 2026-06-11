import { describe, it, expect, beforeAll } from "vitest"
import path from "path"
import { buildMatchData, loadAll } from "../builder"
import type { BacktestLoaders } from "../builder"

const DATA = path.resolve(process.cwd(), "data")
let loaders: BacktestLoaders

beforeAll(() => {
  loaders = loadAll(DATA)
})

describe("buildMatchData", () => {
  it("returns a valid MatchData for Qatar vs Ecuador", () => {
    const md = buildMatchData("Qatar", "Ecuador", "2022-11-20", -1, loaders)
    expect(md.fixture.id).toBe(-1)
    expect(md.teams.home.name).toBe("Qatar")
    expect(md.teams.away.name).toBe("Ecuador")
    expect(md.fixture.altitudeM).toBe(10)
    expect(md.weather?.tempC).toBe(25)
  })

  it("attack and defense strengths are > 0", () => {
    const md = buildMatchData("Brazil", "Serbia", "2022-11-24", -2, loaders)
    expect(md.teams.home.attackStrength).toBeGreaterThan(0)
    expect(md.teams.home.defenseStrength).toBeGreaterThan(0)
    expect(md.teams.away.attackStrength).toBeGreaterThan(0)
  })

  it("homeForm contains records before match date", () => {
    const md = buildMatchData("France", "Australia", "2022-11-22", -3, loaders)
    for (const r of md.homeForm) {
      expect(r.date < "2022-11-22").toBe(true)
    }
    expect(md.homeForm.length).toBeGreaterThan(0)
  })

  it("odds are populated for Qatar vs Ecuador (1X2 available)", () => {
    const md = buildMatchData("Qatar", "Ecuador", "2022-11-20", -1, loaders)
    const homeOdds = md.odds.find(o => o.market === "h2h" && o.selection === "Qatar")
    expect(homeOdds?.odds).toBeCloseTo(100.0, 0)
  })

  it("dataQuality is between 40 and 80", () => {
    const md = buildMatchData("Spain", "Germany", "2022-11-27", -5, loaders)
    expect(md.dataQuality).toBeGreaterThanOrEqual(40)
    expect(md.dataQuality).toBeLessThanOrEqual(80)
  })

  it("lineups are null (not available for backtest)", () => {
    const md = buildMatchData("Brazil", "Serbia", "2022-11-24", -2, loaders)
    expect(md.lineups.home).toBeNull()
    expect(md.lineups.away).toBeNull()
  })
})
