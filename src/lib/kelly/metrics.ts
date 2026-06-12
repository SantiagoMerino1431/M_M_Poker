import type { Bet, MarketOdds } from "../types"
import { median } from "../model/devig"
import { matchesTeam } from "../data/team-names"

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

export function closingOddsForBet(
  closing: MarketOdds[],
  market: string,
  selection: string,
  homeName: string,
  awayName: string,
): number | null {
  let matcher: (o: MarketOdds) => boolean

  if (market === "1X2") {
    if (selection === "home") {
      matcher = o => o.market === "h2h" && matchesTeam(o.selection, homeName)
    } else if (selection === "away") {
      matcher = o => o.market === "h2h" && matchesTeam(o.selection, awayName)
    } else {
      matcher = o => o.market === "h2h" && o.selection.toLowerCase().replace(/[^a-z]/g, "") === "draw"
    }
  } else if (market === "Over/Under") {
    const label = selection
      .replace("over_", "Over ")
      .replace("under_", "Under ")
      .replace("_", " ")
      .replace(/\s+/g, " ")
      .trim()
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]/g, "")
    matcher = o => o.market === "totals" && norm(o.selection) === norm(label)
  } else if (market === "BTTS") {
    const target = selection === "yes" ? "yes" : "no"
    matcher = o => o.market === "btts" && o.selection.toLowerCase() === target
  } else {
    return null
  }

  const prices = closing.filter(matcher).map(o => o.odds)
  return prices.length ? median(prices) : null
}
