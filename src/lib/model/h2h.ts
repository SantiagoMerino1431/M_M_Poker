import type { H2HRecord } from "../types"

const COMPETITION_WEIGHT: Record<H2HRecord["competition"], number> = {
  world_cup: 3.0,
  continental: 2.0,
  qualifier: 1.5,
  friendly: 0.5,
}

const MAX_ADJUSTMENT = 0.15

export function calcH2HFactor(
  records: H2HRecord[],
  teamId: number
): { attackMultiplier: number; defenseMultiplier: number; adjustmentDescription: string } {
  if (records.length < 3) {
    return { attackMultiplier: 1.0, defenseMultiplier: 1.0, adjustmentDescription: "" }
  }

  let weightedWins = 0, weightedTotal = 0

  for (const r of records) {
    const w = COMPETITION_WEIGHT[r.competition]
    const teamIsHome = r.homeTeamId === teamId
    const teamGoals = teamIsHome ? r.homeGoals : r.awayGoals
    const oppGoals = teamIsHome ? r.awayGoals : r.homeGoals
    if (teamGoals > oppGoals) weightedWins += w
    weightedTotal += w
  }

  const winRate = weightedWins / weightedTotal
  const rawAdj = (winRate - 0.5) * 0.3

  const clampedAdj = Math.max(-MAX_ADJUSTMENT, Math.min(MAX_ADJUSTMENT, rawAdj))

  const description = clampedAdj !== 0
    ? `H2H ${clampedAdj > 0 ? "+" : ""}${(clampedAdj * 100).toFixed(0)}%`
    : ""

  return {
    attackMultiplier: 1 + clampedAdj,
    defenseMultiplier: 1 - clampedAdj * 0.5,
    adjustmentDescription: description,
  }
}
