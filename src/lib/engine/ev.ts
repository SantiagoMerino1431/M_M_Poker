import type { MarketResult } from "../types"
import { calcKelly } from "../kelly/criterion"

// Convierte el confidenceMultiplier (0, 0.5, 0.75, 1.0) a un confidence
// equivalente para que calcKelly aplique la escala correcta internamente.
function multiplierToConfidence(mult: number): number {
  if (mult >= 1.0) return 80
  if (mult >= 0.75) return 60
  if (mult >= 0.5) return 40
  return 0
}

export function applyKellyToMarkets(
  markets: MarketResult[],
  bankroll: number,
  confidenceMultiplier: number,
  trialMode = false,
): MarketResult[] {
  const confidence = multiplierToConfidence(confidenceMultiplier)
  return markets.map(m => {
    if (m.EV === null || m.odds === null || !m.isRecommended) return m
    const k = calcKelly({ probability: m.ourProbability, odds: m.odds, bankroll, confidence, trialMode })
    return { ...m, kellyFraction: k.fraction, kellyAmount: k.amount }
  })
}

export function rankMarkets(markets: MarketResult[]): MarketResult[] {
  return [...markets].sort((a, b) => {
    if (a.isRecommended && !b.isRecommended) return -1
    if (!a.isRecommended && b.isRecommended) return 1
    return (b.EV ?? -Infinity) - (a.EV ?? -Infinity)
  })
}
