import { describe, it, expect } from "vitest"
import { buildScoreMatrix } from "../model/poisson"
import { calcAllMarkets } from "../engine/markets"
import { makeMockMatchData } from "./fixtures/mock-match-data"

// Verificación de cordura: con la semántica de defensa corregida (menor = mejor),
// el modelo debe identificar al favorito del mercado correctamente.
// Nota: usa ourProbability porque modelProbability se añade en Fase 3.
describe("cordura: el favorito del modelo coincide con el del mercado", () => {
  it("Canadá (mejor ranking) es favorito sobre Bosnia con sus fuerzas reales", () => {
    // Fuerzas del seed: Canadá atk 0.95 def 1.05 ; Bosnia atk 0.85 def 1.10
    // lambdaHome = 0.95 × 1.10 × 1.4 = 1.463 (Canadá anota)
    // lambdaAway = 0.85 × 1.05 × 1.4 = 1.249 (Bosnia anota)
    const data = makeMockMatchData({
      teams: {
        home: { id: 5, name: "Canadá", country: "CAN", groupName: "B", fifaRanking: 43, attackStrength: 0.95, defenseStrength: 1.05 },
        away: { id: 6, name: "Bosnia y Herzegovina", country: "BIH", groupName: "B", fifaRanking: 70, attackStrength: 0.85, defenseStrength: 1.10 },
      },
      odds: [],
    })
    const lambdaHome = data.teams.home.attackStrength * data.teams.away.defenseStrength * 1.4
    const lambdaAway = data.teams.away.attackStrength * data.teams.home.defenseStrength * 1.4
    const matrix = buildScoreMatrix(lambdaHome, lambdaAway)
    const markets = calcAllMarkets(matrix, data)
    const home = markets.find(m => m.name === "1X2" && m.selection === "home")!
    const away = markets.find(m => m.name === "1X2" && m.selection === "away")!
    expect(home.ourProbability).toBeGreaterThan(away.ourProbability)
  })
})
