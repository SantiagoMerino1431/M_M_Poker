export interface CornersPrediction {
  expectedCorners: number
  line: number
  over: number
  under: number
}

export function predictCorners(
  homeAvgCorners: number,
  awayAvgCorners: number,
  possessionBias = 0
): CornersPrediction {
  const base = (homeAvgCorners + awayAvgCorners) * (1 + possessionBias * 0.05)
  const line = Math.round(base) + 0.5

  // Poisson approximation for over/under
  let over = 0
  const lambda = base
  for (let k = 0; k <= Math.floor(line); k++) {
    over += poissonProb(lambda, k)
  }
  over = 1 - over

  return {
    expectedCorners: base,
    line,
    over,
    under: 1 - over,
  }
}

function poissonProb(lambda: number, k: number): number {
  let result = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) result *= lambda / i
  return result
}
