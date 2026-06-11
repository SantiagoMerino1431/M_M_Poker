import type { H2HRecord } from "../types"

export interface H2HFactor {
  attackMultiplier: number
  adjustmentDescription: string
}

export function calcH2HFactor(records: H2HRecord[], teamId: number): H2HFactor {
  if (!records.length) return { attackMultiplier: 1.0, adjustmentDescription: "" }

  const recent = records.slice(0, 5)
  let wins = 0, goals = 0, matches = 0

  for (const r of recent) {
    const isHome = r.homeTeamId === teamId
    const goalsFor = isHome ? r.homeGoals : r.awayGoals
    const goalsAgainst = isHome ? r.awayGoals : r.homeGoals
    const won = goalsFor > goalsAgainst

    const weight = r.competition === 'world_cup' ? 1.5 : r.competition === 'continental' ? 1.2 : 1.0
    wins += won ? weight : 0
    goals += goalsFor * weight
    matches += weight
  }

  const winRate = wins / matches
  const avgGoals = goals / matches

  let multiplier = 1.0
  if (winRate >= 0.7) multiplier = 1.10
  else if (winRate >= 0.5) multiplier = 1.05
  else if (winRate <= 0.2) multiplier = 0.90
  else if (winRate <= 0.4) multiplier = 0.95

  // Cap at ±15%
  multiplier = Math.max(0.85, Math.min(1.15, multiplier))

  const desc = multiplier !== 1.0
    ? `H2H: ${(winRate * 100).toFixed(0)}% wins → x${multiplier.toFixed(2)}`
    : ""

  return { attackMultiplier: multiplier, adjustmentDescription: desc }
}
