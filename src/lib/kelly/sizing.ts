export const KELLY_FRACTION = 0.5
export const MAX_STAKE_FRACTION = 0.08
export const DAILY_EXPOSURE_FRACTION = 0.15

export function confidenceMultiplier(confidence: number): number {
  if (confidence >= 80) return 1.0
  if (confidence >= 60) return 0.75
  if (confidence >= 40) return 0.5
  return 0
}

export interface KellyStakeInput {
  probability: number
  odds: number
  bankroll: number
  confidence: number
  trialMode?: boolean
}

export interface KellyStakeResult {
  fraction: number
  amount: number
  rawKelly: number
}

export function kellyStake(input: KellyStakeInput): KellyStakeResult {
  const { probability: p, odds, bankroll, confidence, trialMode = false } = input
  const b = odds - 1
  if (b <= 0) return { fraction: 0, amount: 0, rawKelly: 0 }
  const rawKelly = (p * b - (1 - p)) / b
  if (rawKelly <= 0) return { fraction: 0, amount: 0, rawKelly }

  const base = trialMode ? 0.05 : KELLY_FRACTION
  const max = trialMode ? 0.005 : MAX_STAKE_FRACTION
  const adjusted = rawKelly * base * confidenceMultiplier(confidence)
  const fraction = Math.min(max, Math.max(0, adjusted))
  return { fraction, amount: Math.round(bankroll * fraction), rawKelly }
}
