import type { H2HRecord } from "../types"

export interface H2HFactor {
  attackMultiplier: number
  adjustmentDescription: string
}

function monthsAgo(dateStr: string): number {
  const matchDate = new Date(dateStr)
  const now = new Date()
  return (now.getFullYear() - matchDate.getFullYear()) * 12 + (now.getMonth() - matchDate.getMonth())
}

function temporalWeight(dateStr: string): number {
  return Math.exp(-0.1 * Math.max(0, monthsAgo(dateStr)))
}

export function calcH2HFactor(records: H2HRecord[], teamId: number): H2HFactor {
  if (!records.length) return { attackMultiplier: 1.0, adjustmentDescription: "" }

  const recent = records.slice(0, 10)
  let wins = 0, totalWeight = 0

  for (const r of recent) {
    const isHome = r.homeTeamId === teamId
    const goalsFor = isHome ? r.homeGoals : r.awayGoals
    const goalsAgainst = isHome ? r.awayGoals : r.homeGoals
    const won = goalsFor > goalsAgainst

    const compWeight = r.competition === "world_cup" ? 1.5 : r.competition === "continental" ? 1.2 : 1.0
    const w = compWeight * temporalWeight(r.date)
    wins += won ? w : 0
    totalWeight += w
  }

  const winRate = totalWeight > 0 ? wins / totalWeight : 0

  let multiplier = 1.0
  if (winRate >= 0.7) multiplier = 1.10
  else if (winRate >= 0.5) multiplier = 1.05
  else if (winRate <= 0.2) multiplier = 0.90
  else if (winRate <= 0.4) multiplier = 0.95

  // Cap at ±15%
  multiplier = Math.max(0.85, Math.min(1.15, multiplier))

  const desc = multiplier !== 1.0
    ? `H2H: ${(winRate * 100).toFixed(0)}% wins (decay) → x${multiplier.toFixed(2)}`
    : ""

  return { attackMultiplier: multiplier, adjustmentDescription: desc }
}
