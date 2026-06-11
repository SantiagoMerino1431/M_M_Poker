import type { MatchData } from "../types"

export interface CardsPrediction {
  expectedYellows: number
  expectedReds: number
  over15: number
  over25: number
  over35: number
  over45: number
  redCardProb: number
}

export function predictCards(data: MatchData, cardIntensity: number): CardsPrediction {
  const homeStat = data.teams.home.attackStrength
  const awayStat = data.teams.away.attackStrength
  const baseYellows = 3.8 * cardIntensity * ((homeStat + awayStat) / 2)
  const baseReds = 0.10 * cardIntensity

  const over = (threshold: number): number => {
    let cumulative = 0
    for (let k = 0; k <= Math.floor(threshold); k++) {
      cumulative += poissonProb(baseYellows, k)
    }
    return 1 - cumulative
  }

  return {
    expectedYellows: baseYellows,
    expectedReds: baseReds,
    over15: over(1.5),
    over25: over(2.5),
    over35: over(3.5),
    over45: over(4.5),
    redCardProb: Math.min(0.35, baseReds),
  }
}

function poissonProb(lambda: number, k: number): number {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}
