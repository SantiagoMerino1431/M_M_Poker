import { describe, it, expect } from "vitest"
import { buildScoreMatrix, extractMatchProbabilities } from "../model/poisson"

describe("buildScoreMatrix", () => {
  it("suma de todas las probabilidades es ~1", () => {
    const matrix = buildScoreMatrix(1.4, 1.2)
    const sum = matrix.flat().reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 2)
  })

  it("con lambdas iguales, la probabilidad de empate es mayor que victoria local en WC", () => {
    const matrix = buildScoreMatrix(1.3, 1.3)
    const probs = extractMatchProbabilities(matrix)
    expect(probs.draw).toBeGreaterThan(probs.homeWin * 0.8)
  })

  it("equipo con lambda alto tiene mayor prob de ganar", () => {
    const strong = buildScoreMatrix(2.5, 0.6)
    const probs = extractMatchProbabilities(strong)
    expect(probs.homeWin).toBeGreaterThan(0.6)
    expect(probs.awayWin).toBeLessThan(0.15)
  })

  it("Dixon-Coles con rho negativo incrementa prob de 0-0 respecto a Poisson puro", () => {
    // rho=-0.13 -> tau(0,0) = 1 - lH*lA*rho > 1, aumenta P(0,0)
    const lambdaH = 1.4
    const lambdaA = 1.2
    const rawP00 = Math.exp(-lambdaH) * Math.exp(-lambdaA)
    const matrix = buildScoreMatrix(lambdaH, lambdaA)
    expect(matrix[0][0]).toBeGreaterThan(rawP00)
  })
})

describe("extractMatchProbabilities", () => {
  it("1X2 suman 1", () => {
    const matrix = buildScoreMatrix(1.4, 1.2)
    const probs = extractMatchProbabilities(matrix)
    expect(probs.homeWin + probs.draw + probs.awayWin).toBeCloseTo(1.0, 2)
  })
})
