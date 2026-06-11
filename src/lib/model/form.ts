import type { FormRecord } from "../types"

const WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.2]
const DECAY_PER_MONTH = 0.1

function ageWeight(dateStr: string): number {
  const months = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30)
  return Math.exp(-DECAY_PER_MONTH * months)
}

export function calcFormFactor(records: FormRecord[]): { factor: number; description: string } {
  if (records.length === 0) return { factor: 1.0, description: "" }

  const sorted = [...records].slice(0, 5)
  let weightedGoalDiff = 0, totalWeight = 0

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]
    const posWeight = WEIGHTS[i] ?? 0.2
    const timeWeight = ageWeight(r.date)
    const rankAdj = 1 + (50 - r.opponentRanking) * 0.002
    const w = posWeight * timeWeight * rankAdj
    weightedGoalDiff += (r.goalsFor - r.goalsAgainst) * w
    totalWeight += w
  }

  const avgDiff = totalWeight > 0 ? weightedGoalDiff / totalWeight : 0
  const factor = Math.max(0.90, Math.min(1.10, 1 + avgDiff * 0.04))

  const description = factor !== 1.0
    ? `Forma ${factor > 1 ? "+" : ""}${((factor - 1) * 100).toFixed(0)}%`
    : ""

  return { factor, description }
}
