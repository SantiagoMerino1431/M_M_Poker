import type { Bet } from "../types"

export interface BettingMetrics {
  ROI: number
  yield: number
  strikeRate: number
  avgCLV: number
  maxDrawdown: number
  totalBets: number
  totalStaked: number
  profitLoss: number
}

export function calcMetrics(bets: Bet[]): BettingMetrics {
  const settled = bets.filter(b => b.result !== null && b.profitLoss !== null)
  if (!settled.length) return { ROI: 0, yield: 0, strikeRate: 0, avgCLV: 0, maxDrawdown: 0, totalBets: 0, totalStaked: 0, profitLoss: 0 }

  const totalStaked = settled.reduce((s, b) => s + b.amount, 0)
  const profitLoss = settled.reduce((s, b) => s + (b.profitLoss ?? 0), 0)
  const wins = settled.filter(b => b.result === "win").length
  const ROI = totalStaked > 0 ? (profitLoss / totalStaked) * 100 : 0
  const strikeRate = wins / settled.length

  const clvBets = settled.filter(b => b.oddsClosing !== null)
  const avgCLV = clvBets.length
    ? clvBets.reduce((s, b) => s + (b.oddsUsed / b.oddsClosing! - 1), 0) / clvBets.length
    : 0

  let peak = 0, current = 0, maxDrawdown = 0
  for (const b of settled) {
    current += b.profitLoss ?? 0
    if (current > peak) peak = current
    const dd = peak - current
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  return {
    ROI,
    yield: settled.length > 0 ? ROI / settled.length : 0,
    strikeRate,
    avgCLV,
    maxDrawdown,
    totalBets: settled.length,
    totalStaked,
    profitLoss,
  }
}
