export interface CardsPrediction {
  expectedCards: number
  over35Cards: number
  redCardProb: number
}

export function predictCards(
  homeAvgCards: number,
  awayAvgCards: number,
  stageIntensity = 1.0
): CardsPrediction {
  const expected = (homeAvgCards + awayAvgCards) * stageIntensity

  // Over 3.5 cards using normal approximation
  const sigma = Math.sqrt(expected * 0.8)
  const z = (3.5 - expected) / Math.max(sigma, 0.01)
  const over35Cards = 1 - normalCDF(z)

  // Red card probability: roughly 8% of matches have a red in group stage
  const redCardProb = Math.min(0.08 * stageIntensity * (expected / 4), 0.4)

  return { expectedCards: expected, over35Cards, redCardProb }
}

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2315419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))))
  return z > 0 ? 1 - prob : prob
}
