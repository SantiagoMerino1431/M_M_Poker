import type { FormRecord } from "../types"

export interface FormFactor {
  factor: number
  description: string
}

export function calcFormFactor(records: FormRecord[]): FormFactor {
  if (!records.length) return { factor: 1.0, description: "" }

  const recent = records.slice(0, 5)
  let weightedScore = 0
  let totalWeight = 0

  recent.forEach((r, i) => {
    // Temporal decay: most recent = 1.0, oldest = ~0.6
    const weight = Math.exp(-0.1 * i)
    const scored = r.goalsFor > 0 ? 1 : 0
    const won = r.goalsFor > r.goalsAgainst ? 1 : 0
    const drew = r.goalsFor === r.goalsAgainst ? 0.5 : 0
    const opponentFactor = 1 + (50 - r.opponentRanking) * 0.005

    weightedScore += (won + drew + scored * 0.3) * opponentFactor * weight
    totalWeight += weight
  })

  const normalizedScore = weightedScore / totalWeight
  let factor = 1.0
  let description = ""

  if (normalizedScore >= 1.5) { factor = 1.08; description = "Buena forma reciente" }
  else if (normalizedScore >= 1.0) { factor = 1.03 }
  else if (normalizedScore <= 0.3) { factor = 0.92; description = "Mala racha reciente" }
  else if (normalizedScore <= 0.6) { factor = 0.97 }

  return { factor, description }
}
