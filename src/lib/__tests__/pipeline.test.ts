import { describe, it, expect, vi } from "vitest"
import { buildMatchData } from "../data/pipeline"

vi.mock("../data/api-football", () => ({
  fetchTodayFixtures: vi.fn(),
  fetchTeamStats: vi.fn().mockResolvedValue({ attackStrength: 1.2, defenseStrength: 0.9 }),
  fetchH2H: vi.fn().mockResolvedValue([]),
  fetchRecentForm: vi.fn().mockResolvedValue([]),
  fetchInjuries: vi.fn().mockResolvedValue({ home: [], away: [] }),
  fetchLineups: vi.fn().mockResolvedValue({ home: null, away: null }),
  fetchReferee: vi.fn().mockResolvedValue(null),
}))

vi.mock("../data/odds-api", () => ({
  fetchOdds: vi.fn().mockResolvedValue([]),
}))

vi.mock("../data/balldontlie", () => ({
  fetchBDLOdds: vi.fn().mockResolvedValue([]),
}))

describe("buildMatchData", () => {
  it("devuelve estructura MatchData completa aunque fallen fuentes secundarias", async () => {
    const fixture = {
      id: 1,
      date: "2026-06-11T18:00:00Z",
      stadium: "MetLife Stadium",
      city: "East Rutherford",
      altitudeM: 5,
      homeTeamId: 29,
      awayTeamId: 37,
      stage: "Group H",
    }
    const homeTeam = {
      id: 29, name: "España", country: "ESP", groupName: "H",
      fifaRanking: 1, attackStrength: 1.45, defenseStrength: 0.70,
    }
    const awayTeam = {
      id: 37, name: "Argentina", country: "ARG", groupName: "J",
      fifaRanking: 2, attackStrength: 1.50, defenseStrength: 0.75,
    }

    const result = await buildMatchData(fixture, homeTeam, awayTeam)

    expect(result.fixture.id).toBe(1)
    expect(result.teams.home.name).toBe("España")
    expect(result.teams.away.name).toBe("Argentina")
    expect(result.dataQuality).toBeGreaterThan(0)
    expect(result.fetchedAt).toBeDefined()
  })

  it("dataQuality sube cuando hay lineups confirmados", async () => {
    const { fetchLineups } = await import("../data/api-football")
    vi.mocked(fetchLineups).mockResolvedValueOnce({
      home: [{ id: 1, name: "Yamal", position: "FWD", goals_per_90: 0.4, shots_per_90: 2.1, isStarter: true }],
      away: [{ id: 2, name: "Messi", position: "FWD", goals_per_90: 0.6, shots_per_90: 3.0, isStarter: true }],
    })

    const fixture = { id: 1, date: "2026-06-11T18:00:00Z", stadium: "MetLife", city: "NJ", altitudeM: 5, homeTeamId: 29, awayTeamId: 37, stage: "Group H" }
    const home = { id: 29, name: "España", country: "ESP", groupName: "H", fifaRanking: 1, attackStrength: 1.45, defenseStrength: 0.70 }
    const away = { id: 37, name: "Argentina", country: "ARG", groupName: "J", fifaRanking: 2, attackStrength: 1.50, defenseStrength: 0.75 }

    const withLineup = await buildMatchData(fixture, home, away)
    expect(withLineup.lineups.home).not.toBeNull()
    expect(withLineup.dataQuality).toBeGreaterThan(40)
  })
})
