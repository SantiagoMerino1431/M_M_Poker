import { describe, it, expect } from "vitest"
import { calcAllMarkets } from "../engine/markets"
import { analyzeMatch } from "../engine/analyzer"
import { makeMockMatchData } from "./fixtures/mock-match-data"

function buildTestMatrix(lH: number, lA: number): number[][] {
  const matrix: number[][] = []
  let total = 0
  for (let h = 0; h <= 8; h++) {
    matrix[h] = []
    for (let a = 0; a <= 8; a++) {
      matrix[h][a] = poissonP(lH, h) * poissonP(lA, a)
      total += matrix[h][a]
    }
  }
  for (let h = 0; h <= 8; h++)
    for (let a = 0; a <= 8; a++)
      matrix[h][a] /= total
  return matrix
}

function poissonP(l: number, k: number): number {
  let p = Math.exp(-l)
  for (let i = 1; i <= k; i++) p *= l / i
  return p
}

describe("calcAllMarkets", () => {
  it("devuelve array no vacío de mercados", () => {
    const data = makeMockMatchData()
    const matrix = buildTestMatrix(1.4, 1.2)
    const markets = calcAllMarkets(matrix, data)
    expect(markets.length).toBeGreaterThan(10)
  })

  it("1X2 probabilities suman ~1", () => {
    const matrix = buildTestMatrix(1.4, 1.2)
    const data = makeMockMatchData()
    const markets = calcAllMarkets(matrix, data)
    const home = markets.find(m => m.name === "1X2" && m.selection === "home")!
    const draw = markets.find(m => m.name === "1X2" && m.selection === "draw")!
    const away = markets.find(m => m.name === "1X2" && m.selection === "away")!
    expect(home.ourProbability + draw.ourProbability + away.ourProbability).toBeCloseTo(1.0, 2)
  })

  it("over 2.5 tiene odds stale false cuando odds son recientes", () => {
    const data = makeMockMatchData()
    const matrix = buildTestMatrix(1.4, 1.2)
    const markets = calcAllMarkets(matrix, data)
    const over25 = markets.find(m => m.name === "Over/Under" && m.selection === "over_2.5")
    expect(over25?.oddsStale).toBe(false)
  })

  it("mercados sin cuota tienen odds null y EV null", () => {
    const data = makeMockMatchData({ odds: [] })
    const matrix = buildTestMatrix(1.4, 1.2)
    const markets = calcAllMarkets(matrix, data)
    expect(markets.every(m => m.odds === null)).toBe(true)
    expect(markets.every(m => m.EV === null)).toBe(true)
  })
})

describe("analyzeMatch", () => {
  it("devuelve MatchAnalysis con todos los campos requeridos", () => {
    const data = makeMockMatchData()
    const result = analyzeMatch(data, 1000)
    expect(result.fixtureId).toBe(1)
    expect(result.confidence).toBe(55)
    expect(result.markets.length).toBeGreaterThan(5)
    expect(result.lastUpdated).toBeDefined()
  })

  it("markets recomendados tienen kellyAmount calculado", () => {
    const data = makeMockMatchData()
    const result = analyzeMatch(data, 1000)
    const recommended = result.markets.filter(m => m.isRecommended)
    for (const m of recommended) {
      expect(m.kellyAmount).not.toBeNull()
      expect(m.kellyAmount!).toBeGreaterThan(0)
    }
  })

  it("sin odds, ningún mercado es recomendado", () => {
    const data = makeMockMatchData({ odds: [] })
    const result = analyzeMatch(data, 1000)
    expect(result.markets.every(m => !m.isRecommended)).toBe(true)
  })

  it("alerta cuando lineup no está confirmado", () => {
    const data = makeMockMatchData({ lineups: { home: null, away: null } })
    const result = analyzeMatch(data, 1000)
    expect(result.alerts).toContain("Lineup no confirmado")
  })
})
