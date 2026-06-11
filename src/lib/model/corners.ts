import type { MatchData } from "../types"

export interface CornersPrediction {
  expectedCorners: number
  over85: number
  over95: number
  over105: number
  over115: number
  firstHalfOver45: number
}

export function predictCorners(data: MatchData): CornersPrediction {
  const homeAttack = data.teams.home.attackStrength
  const awayAttack = data.teams.away.attackStrength
  const base = (homeAttack + awayAttack) * 4.8

  const over = (threshold: number): number => {
    let cumulative = 0
    for (let k = 0; k <= Math.floor(threshold); k++) {
      cumulative += poissonProb(base, k)
    }
    return 1 - cumulative
  }

  return {
    expectedCorners: base,
    over85: over(8.5),
    over95: over(9.5),
    over105: over(10.5),
    over115: over(11.5),
    firstHalfOver45: over(4.5 * (base / 9.5) * 0.45),
  }
}

function poissonProb(lambda: number, k: number): number {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}
