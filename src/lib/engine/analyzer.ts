import type { MatchData, MatchAnalysis, ModelOutput } from "../types"
import { buildScoreMatrix } from "../model/poisson"
import { calcH2HFactor } from "../model/h2h"
import { calcFormFactor } from "../model/form"
import { calcContextAdjustments } from "../model/context"
import { calcAllMarkets } from "./markets"
import { applyKellyToMarkets, rankMarkets } from "./ev"

function confidenceMultiplier(score: number): number {
  if (score >= 80) return 1.00
  if (score >= 60) return 0.75
  if (score >= 40) return 0.50
  return 0.00
}

export function analyzeMatch(data: MatchData, bankroll: number, trialMode = false): MatchAnalysis {
  const alerts: string[] = []
  const adjustments: string[] = []

  if (!data.lineups.home || !data.lineups.away) alerts.push("Lineup no confirmado")
  if (data.odds.length === 0) alerts.push("Sin cuotas disponibles — ingresar manualmente")

  const staleOdds = data.odds.some(o => {
    const age = Date.now() - new Date(o.updatedAt).getTime()
    return age > 4 * 60 * 60 * 1000
  })
  if (staleOdds) alerts.push("Cuotas con más de 4 horas de antigüedad")

  const homeH2H = calcH2HFactor(data.h2h, data.teams.home.id)
  const awayH2H = calcH2HFactor(data.h2h, data.teams.away.id)
  const homeForm = calcFormFactor(data.homeForm)
  const awayForm = calcFormFactor(data.awayForm)

  const context = calcContextAdjustments({
    homeCountry: data.teams.home.country,
    awayCountry: data.teams.away.country,
    city: data.fixture.city,
    altitudeM: data.fixture.altitudeM,
    tempC: data.weather?.tempC ?? null,
    homeRestDays: 5,
    awayRestDays: 5,
    refereeAvgYellows: data.referee?.avgYellowsPerGame ?? null,
  })

  if (homeH2H.adjustmentDescription) adjustments.push(homeH2H.adjustmentDescription)
  if (homeForm.description) adjustments.push(`Local: ${homeForm.description}`)
  if (awayForm.description) adjustments.push(`Visitante: ${awayForm.description}`)
  adjustments.push(...context.adjustments)

  const lambdaHome =
    data.teams.home.attackStrength *
    data.teams.away.defenseStrength *
    1.4 *
    context.homeAdvantage *
    homeH2H.attackMultiplier *
    homeForm.factor *
    context.altitudeFactorHome *
    context.heatFactorHome *
    context.fatigueFactor

  const lambdaAway =
    data.teams.away.attackStrength *
    data.teams.home.defenseStrength *
    1.4 *
    awayH2H.attackMultiplier *
    awayForm.factor *
    context.altitudeFactorAway *
    context.heatFactorAway *
    context.fatigueFactor

  const matrix = buildScoreMatrix(lambdaHome, lambdaAway)
  const modelOutput: ModelOutput = {
    lambdaHome,
    lambdaAway,
    adjustmentsApplied: adjustments,
    scoreMatrix: matrix,
  }

  const multiplier = confidenceMultiplier(data.dataQuality)
  let markets = calcAllMarkets(matrix, data)
  markets = applyKellyToMarkets(markets, bankroll, multiplier, trialMode)
  markets = rankMarkets(markets)

  return {
    fixtureId: data.fixture.id,
    confidence: data.dataQuality,
    isPreliminary: !data.lineups.home || !data.lineups.away,
    model: modelOutput,
    markets,
    alerts,
    lastUpdated: new Date().toISOString(),
  }
}
