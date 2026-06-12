import type { FormRecord } from "../types"

export interface FormFactor {
  factor: number
  description: string
}

function monthsAgo(dateStr: string): number {
  const matchDate = new Date(dateStr)
  const now = new Date()
  return (now.getFullYear() - matchDate.getFullYear()) * 12 + (now.getMonth() - matchDate.getMonth())
}

export function calcFormFactor(records: FormRecord[]): FormFactor {
  if (!records.length) return { factor: 1.0, description: "" }

  const recent = records.slice(0, 10)
  let weightedScore = 0
  let totalWeight = 0

  for (const r of recent) {
    const temporalW = Math.exp(-0.1 * Math.max(0, monthsAgo(r.date)))
    const won = r.goalsFor > r.goalsAgainst ? 1 : 0
    const drew = r.goalsFor === r.goalsAgainst ? 0.5 : 0
    const scored = r.goalsFor > 0 ? 1 : 0
    // opponentFactor: ranking 1 (best) yields 1.245; ranking 50 yields 1.0; ranking 100 yields 0.755
    const opponentFactor = 1 + (50 - r.opponentRanking) * 0.005

    weightedScore += (won + drew + scored * 0.3) * opponentFactor * temporalW
    totalWeight += temporalW
  }

  const normalizedScore = totalWeight > 0 ? weightedScore / totalWeight : 0
  let factor = 1.0
  let description = ""

  if (normalizedScore >= 1.5) { factor = 1.08; description = "Buena forma reciente" }
  else if (normalizedScore >= 1.0) { factor = 1.03 }
  else if (normalizedScore <= 0.3) { factor = 0.92; description = "Mala racha reciente" }
  else if (normalizedScore <= 0.6) { factor = 0.97 }

  return { factor, description }
}
