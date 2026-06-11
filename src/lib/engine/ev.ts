import type { MarketResult } from "../types"

export function applyKellyToMarkets(
  markets: MarketResult[],
  bankroll: number,
  confidenceMultiplier: number,
  trialMode = false
): MarketResult[] {
  const MAX = trialMode ? 0.005 : 0.08
  const halfKelly = trialMode ? 0.05 : 0.5

  return markets.map(m => {
    if (m.EV === null || m.odds === null || !m.isRecommended) return m

    const b = m.odds - 1
    const p = m.ourProbability
    const q = 1 - p
    const rawKelly = (p * b - q) / b
    const adjusted = rawKelly * halfKelly * confidenceMultiplier
    const capped = Math.max(0.005, Math.min(MAX, adjusted))
    const amount = Math.round(bankroll * capped)

    return { ...m, kellyFraction: capped, kellyAmount: amount }
  })
}

export function rankMarkets(markets: MarketResult[]): MarketResult[] {
  return [...markets].sort((a, b) => {
    if (a.isRecommended && !b.isRecommended) return -1
    if (!a.isRecommended && b.isRecommended) return 1
    return (b.EV ?? -Infinity) - (a.EV ?? -Infinity)
  })
}
