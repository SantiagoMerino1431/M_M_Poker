export interface KellyInput {
  probability: number
  odds: number
  bankroll: number
  confidence: number
  trialMode?: boolean
}

export interface KellyResult {
  fraction: number
  amount: number
  isNegative: boolean
}

function confidenceMultiplier(confidence: number): number {
  if (confidence >= 80) return 1.00
  if (confidence >= 60) return 0.75
  if (confidence >= 40) return 0.50
  return 0.00
}

export function calcKelly(input: KellyInput): KellyResult {
  const { probability: p, odds, bankroll, confidence, trialMode = false } = input
  const b = odds - 1
  const q = 1 - p
  const rawKelly = (p * b - q) / b

  if (rawKelly <= 0) return { fraction: 0, amount: 0, isNegative: rawKelly < 0 }

  const multiplier = confidenceMultiplier(confidence)

  // Primeros 4 partidos: Kelly al 10% del normal, tope 0.5%
  const halfKelly = trialMode ? 0.05 : 0.5
  const MIN = 0.005
  const MAX = trialMode ? 0.005 : 0.08

  const adjusted = rawKelly * halfKelly * multiplier
  const capped = Math.max(MIN, Math.min(MAX, adjusted))
  const amount = Math.round(bankroll * capped)

  return { fraction: capped, amount, isNegative: false }
}
