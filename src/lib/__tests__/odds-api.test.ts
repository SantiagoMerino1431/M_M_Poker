import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const SAMPLE = [
  {
    home_team: "Canada", away_team: "Bosnia & Herzegovina",
    commence_time: "2026-06-12T19:00:00Z",
    bookmakers: [
      { key: "pinnacle", last_update: "2026-06-12T17:00:00Z", markets: [
        { key: "h2h", outcomes: [
          { name: "Canada", price: 1.85 }, { name: "Bosnia & Herzegovina", price: 4.40 }, { name: "Draw", price: 3.35 },
        ]},
        { key: "totals", outcomes: [
          { name: "Over", price: 2.10, point: 2.5 }, { name: "Under", price: 1.70, point: 2.5 },
        ]},
      ]},
    ],
  },
  {
    home_team: "USA", away_team: "Paraguay", commence_time: "2026-06-13T01:00:00Z",
    bookmakers: [{ key: "pinnacle", last_update: "2026-06-12T23:00:00Z", markets: [
      { key: "h2h", outcomes: [{ name: "USA", price: 2.10 }, { name: "Paraguay", price: 3.92 }, { name: "Draw", price: 3.25 }] },
    ]}],
  },
]

beforeEach(() => {
  process.env.ODDS_API_KEY = "test"
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => SAMPLE }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe("fetchOdds", () => {
  it("no pide el mercado btts al endpoint general", async () => {
    const { fetchOdds } = await import("../data/odds-api")
    await fetchOdds("Canadá", "Bosnia y Herzegovina")
    const url = (globalThis.fetch as any).mock.calls[0][0] as string
    expect(url).toContain("markets=h2h,totals")
    expect(url).not.toContain("btts")
  })

  it("empareja por nombre ES contra evento EN y devuelve cuotas", async () => {
    const { fetchOdds } = await import("../data/odds-api")
    const odds = await fetchOdds("Canadá", "Bosnia y Herzegovina")
    expect(odds.length).toBeGreaterThan(0)
    const home = odds.find(o => o.market === "h2h" && o.selection === "Canada")
    expect(home?.odds).toBe(1.85)
  })

  it("traduce las selecciones totals a 'Over 2.5' / 'Under 2.5'", async () => {
    const { fetchOdds } = await import("../data/odds-api")
    const odds = await fetchOdds("Canadá", "Bosnia y Herzegovina")
    expect(odds.some(o => o.market === "totals" && o.selection === "Over 2.5")).toBe(true)
  })

  it("usa el last_update real del bookmaker, no Date.now()", async () => {
    const { fetchOdds } = await import("../data/odds-api")
    const odds = await fetchOdds("Canadá", "Bosnia y Herzegovina")
    expect(odds[0].updatedAt).toBe("2026-06-12T17:00:00Z")
  })

  it("no empareja el evento equivocado cuando solo coincide un equipo", async () => {
    const { fetchOdds } = await import("../data/odds-api")
    // Paraguay aparece en USA vs Paraguay; pedir 'Turquía vs Paraguay' no debe matchear ese evento
    const odds = await fetchOdds("Turquía", "Paraguay")
    expect(odds.length).toBe(0)
  })
})
