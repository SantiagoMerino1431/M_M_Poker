import { describe, it, expect, beforeAll } from "vitest"
import { appendOdds, listOddsHistory } from "../db/odds-history"
import { migrate } from "../db/schema"

describe("odds_history", () => {
  beforeAll(async () => { await migrate() })

  it("guarda y lista el movimiento de una selección en orden cronológico", async () => {
    const fid = 99001
    await appendOdds(fid, "1X2", "home", 1.80, "manual")
    await appendOdds(fid, "1X2", "home", 1.75, "manual")
    const series = await listOddsHistory(fid, "1X2", "home")
    expect(series.length).toBeGreaterThanOrEqual(2)
    expect(series[0].odds).toBe(1.80)
    expect(series[series.length - 1].odds).toBe(1.75)
  })
})
