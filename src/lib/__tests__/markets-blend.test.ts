import { describe, it, expect } from "vitest"
import { calcAllMarkets } from "../engine/markets"
import { makeMockMatchData } from "./fixtures/mock-match-data"
import { buildScoreMatrix } from "../model/poisson"

describe("calcAllMarkets — blend con mercado", () => {
  it("1X2 expone modelProbability, marketProbability y ourProbability blended", () => {
    const data = makeMockMatchData()  // trae cuotas h2h España/Draw/Argentina
    const matrix = buildScoreMatrix(1.5, 1.2)
    const markets = calcAllMarkets(matrix, data)
    const home = markets.find(m => m.name === "1X2" && m.selection === "home")!
    expect(home.modelProbability).toBeGreaterThan(0)
    expect(home.marketProbability).not.toBeNull()
    // ourProbability queda entre modelo y mercado
    const lo = Math.min(home.modelProbability, home.marketProbability!)
    const hi = Math.max(home.modelProbability, home.marketProbability!)
    expect(home.ourProbability).toBeGreaterThanOrEqual(lo - 1e-9)
    expect(home.ourProbability).toBeLessThanOrEqual(hi + 1e-9)
  })

  it("marketProbability de las 3 vías 1X2 suma ~1 (de-viggeado)", () => {
    const data = makeMockMatchData()
    const matrix = buildScoreMatrix(1.5, 1.2)
    const markets = calcAllMarkets(matrix, data)
    const h = markets.find(m => m.name === "1X2" && m.selection === "home")!.marketProbability!
    const d = markets.find(m => m.name === "1X2" && m.selection === "draw")!.marketProbability!
    const a = markets.find(m => m.name === "1X2" && m.selection === "away")!.marketProbability!
    expect(h + d + a).toBeCloseTo(1.0, 6)
  })

  it("sin cuotas, ourProbability == modelProbability y no recomienda", () => {
    const data = makeMockMatchData({ odds: [] })
    const matrix = buildScoreMatrix(1.5, 1.2)
    const markets = calcAllMarkets(matrix, data)
    const home = markets.find(m => m.name === "1X2" && m.selection === "home")!
    expect(home.marketProbability).toBeNull()
    expect(home.ourProbability).toBe(home.modelProbability)
    expect(markets.every(m => !m.isRecommended)).toBe(true)
  })
})
