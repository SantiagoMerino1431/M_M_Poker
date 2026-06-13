import { kellyStake } from "./sizing"

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

export function calcKelly(input: KellyInput): KellyResult {
  const { rawKelly, fraction, amount } = kellyStake(input)
  return { fraction, amount, isNegative: rawKelly < 0 }
}
