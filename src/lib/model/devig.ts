import type { MarketOdds } from "../types"

// De-vig multiplicativo (proporcional): normaliza las probabilidades implícitas
// para que sumen 1, repartiendo el margen del bookmaker de forma proporcional.
export function devig(oddsSet: number[]): number[] {
  const implied = oddsSet.map(o => 1 / o)
  const overround = implied.reduce((s, p) => s + p, 0)
  if (overround <= 0) return implied
  return implied.map(p => p / overround)
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Cuota de consenso (mediana entre bookmakers) por selección, usando matching laxo
// de nombre de selección (minúsculas, solo alfanumérico) para tolerar variantes.
function normSel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function consensusOdds(
  odds: MarketOdds[],
  market: string,
  selections: string[],
): Map<string, number> {
  const result = new Map<string, number>()
  for (const sel of selections) {
    const target = normSel(sel)
    const prices = odds
      .filter(o => o.market === market && normSel(o.selection) === target)
      .map(o => o.odds)
    if (prices.length > 0) result.set(sel, median(prices))
  }
  return result
}
