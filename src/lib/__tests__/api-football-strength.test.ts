import { describe, it, expect, vi, beforeEach } from "vitest"

beforeEach(() => { vi.resetModules() })

describe("fetchTeamStats — defensa menor = mejor", () => {
  it("equipo que concede 0.5 goles/partido produce defenseStrength < 1", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          fixtures: { played: { total: 10 } },
          goals: { for: { total: { total: 20 } }, against: { total: { total: 5 } } },
        },
      }),
    }))
    process.env.RAPIDAPI_KEY = "test"
    const { fetchTeamStats } = await import("../data/api-football")
    const s = await fetchTeamStats(1)
    // concede 0.5/partido -> 0.5/1.4 ~= 0.36 -> defensa fuerte (<1)
    expect(s.defenseStrength!).toBeLessThan(1.0)
    // marca 2.0/partido -> 2.0/1.4 ~= 1.43 -> ataque fuerte (>1)
    expect(s.attackStrength!).toBeGreaterThan(1.0)
  })
})
