import type { MarketResult } from "../types"

export function applyKellyToMarkets(
  markets: MarketResult[],
  bankroll: number,
  confidenceMultiplier: number
): MarketResult[] {
  return markets.map(m => {
    if (m.EV === null || m.odds === null || !m.isRecommended) return m

    const b = m.odds - 1
    const p = m.ourProbability
    const q = 1 - p
    const rawKelly = (p * b - q) / b
    const adjusted = rawKelly * 0.5 * confidenceMultiplier
    const capped = Math.max(0.005, Math.min(0.08, adjusted))
    const amount = Math.round(bankroll * capped * 100) / 100

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
