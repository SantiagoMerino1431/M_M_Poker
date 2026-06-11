export interface KellyInput {
  probability: number
  odds: number
  bankroll: number
  confidence: number
}

export interface KellyResult {
  fraction: number
  amount: number
  isNegative: boolean
}

const CONFIDENCE_MULTIPLIER: Record<string, number> = {
  high: 1.00,
  medium: 0.75,
  low: 0.50,
  none: 0.00,
}

function confidenceMultiplier(confidence: number): number {
  if (confidence >= 80) return CONFIDENCE_MULTIPLIER.high
  if (confidence >= 60) return CONFIDENCE_MULTIPLIER.medium
  if (confidence >= 40) return CONFIDENCE_MULTIPLIER.low
  return CONFIDENCE_MULTIPLIER.none
}

export function calcKelly(input: KellyInput): KellyResult {
  const { probability: p, odds, bankroll, confidence } = input
  const b = odds - 1
  const q = 1 - p
  const rawKelly = (p * b - q) / b

  if (rawKelly <= 0) return { fraction: 0, amount: 0, isNegative: rawKelly < 0 }

  const multiplier = confidenceMultiplier(confidence)
  const adjusted = rawKelly * 0.5 * multiplier
  const MIN = 0.005
  const MAX = 0.08
  const capped = Math.max(MIN, Math.min(MAX, adjusted))
  const amount = Math.round(bankroll * capped * 100) / 100

  return { fraction: capped, amount, isNegative: false }
}
