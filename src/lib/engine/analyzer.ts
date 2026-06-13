import type { MatchData, MatchAnalysis, ModelOutput } from "../types"
import { buildScoreMatrix } from "../model/poisson"
import { calcH2HFactor } from "../model/h2h"
import { calcFormFactor } from "../model/form"
import { calcContextAdjustments } from "../model/context"
import { calcAllMarkets } from "./markets"
import { applyKellyToMarkets, rankMarkets } from "./ev"
import { lineupAttackMultiplier, lineupConcedeMultiplier, type MissingPlayer } from "../model/lineup"

function confidenceMultiplier(score: number): number {
  if (score >= 80) return 1.00
  if (score >= 60) return 0.75
  if (score >= 40) return 0.50
  return 0.00
}

// Confidence = calidad de datos penalizada por divergencia modelo/mercado.
// Una divergencia grande en 1X2 casi nunca es "valor": suele ser ruido o bug,
// así que reduce la confianza y, por la regla <40, puede bloquear la recomendación.
export function calcConfidence(dataQuality: number, maxDivergence1x2: number): number {
  let confidence = dataQuality
  if (maxDivergence1x2 > 0.20) confidence -= 30
  else if (maxDivergence1x2 > 0.12) confidence -= 15
  else if (maxDivergence1x2 > 0.08) confidence -= 5
  return Math.max(0, Math.min(100, confidence))
}

export function dataQualityFromData(data: MatchData): number {
  let score = 40
  if (data.h2h.length >= 3) score += 15
  if (data.homeForm.length >= 3 && data.awayForm.length >= 3) score += 15
  const hasLineup = !!(data.lineups.home && data.lineups.away)
  if (hasLineup) score += 15
  if (data.lineupConfirmed) score += 5
  if (data.odds.length > 0) score += 10
  if (data.referee) score += 5
  return Math.min(100, score)
}

function calcRestDays(form: import("../types").FormRecord[], matchDate: string): number {
  if (!form.length) return 5
  const sorted = [...form].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const days = Math.round(
    (new Date(matchDate).getTime() - new Date(sorted[0].date).getTime()) / (1000 * 60 * 60 * 24)
  )
  return Math.max(1, Math.min(30, days))
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
    homeRestDays: calcRestDays(data.homeForm, data.fixture.date),
    awayRestDays: calcRestDays(data.awayForm, data.fixture.date),
    refereeAvgYellows: data.referee?.avgYellowsPerGame ?? null,
  })

  if (homeH2H.adjustmentDescription) adjustments.push(homeH2H.adjustmentDescription)
  if (homeForm.description) adjustments.push(`Local: ${homeForm.description}`)
  if (awayForm.description) adjustments.push(`Visitante: ${awayForm.description}`)
  adjustments.push(...context.adjustments)

  const toMissing = (inj: typeof data.injuries.home): MissingPlayer[] =>
    inj.filter(i => i.status === "out").map(i => ({ position: i.position, key: true }))
  const homeMissing = toMissing(data.injuries.home)
  const awayMissing = toMissing(data.injuries.away)

  const homeAtkMult = lineupAttackMultiplier(homeMissing)
  const awayAtkMult = lineupAttackMultiplier(awayMissing)
  const homeConcedeMult = lineupConcedeMultiplier(homeMissing)
  const awayConcedeMult = lineupConcedeMultiplier(awayMissing)

  if (homeMissing.length) adjustments.push(`Bajas local: ${homeMissing.length} (ataque x${homeAtkMult.toFixed(2)})`)
  if (awayMissing.length) adjustments.push(`Bajas visitante: ${awayMissing.length} (ataque x${awayAtkMult.toFixed(2)})`)

  const lambdaHome =
    data.teams.home.attackStrength *
    data.teams.away.defenseStrength *
    1.4 *
    context.homeAdvantage *
    homeH2H.attackMultiplier *
    homeForm.factor *
    context.altitudeFactorHome *
    context.heatFactorHome *
    context.fatigueFactor *
    homeAtkMult *
    awayConcedeMult

  const lambdaAway =
    data.teams.away.attackStrength *
    data.teams.home.defenseStrength *
    1.4 *
    awayH2H.attackMultiplier *
    awayForm.factor *
    context.altitudeFactorAway *
    context.heatFactorAway *
    context.fatigueFactor *
    awayAtkMult *
    homeConcedeMult

  const matrix = buildScoreMatrix(lambdaHome, lambdaAway)
  const modelOutput: ModelOutput = {
    lambdaHome,
    lambdaAway,
    adjustmentsApplied: adjustments,
    scoreMatrix: matrix,
  }

  let markets = calcAllMarkets(matrix, data)

  // Divergencia máxima entre modelo y mercado en las 3 vías 1X2.
  const oneX2 = markets.filter(m => m.name === "1X2" && m.marketProbability !== null)
  const maxDivergence = oneX2.reduce(
    (mx, m) => Math.max(mx, Math.abs(m.modelProbability - (m.marketProbability ?? m.modelProbability))),
    0,
  )
  const effectiveDataQuality = dataQualityFromData(data)
  const confidence = calcConfidence(effectiveDataQuality, maxDivergence)

  const multiplier = confidenceMultiplier(confidence)
  markets = applyKellyToMarkets(markets, bankroll, multiplier, trialMode)
  markets = rankMarkets(markets)

  return {
    fixtureId: data.fixture.id,
    confidence,
    isPreliminary: !data.lineups.home || !data.lineups.away,
    model: modelOutput,
    markets,
    alerts,
    lastUpdated: new Date().toISOString(),
  }
}
