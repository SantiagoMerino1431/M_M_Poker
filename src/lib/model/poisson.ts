export interface MatchProbabilities {
  homeWin: number
  draw: number
  awayWin: number
  over15: number
  over25: number
  over35: number
  over45: number
  btts: number
  cleanSheetHome: number
  cleanSheetAway: number
  exactScores: { score: string; prob: number }[]
}

const RHO = -0.13

function poissonProb(lambda: number, k: number): number {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}

function dixonColesTau(h: number, a: number, lH: number, lA: number): number {
  if (h === 0 && a === 0) return 1 - lH * lA * RHO
  if (h === 0 && a === 1) return 1 + lH * RHO
  if (h === 1 && a === 0) return 1 + lA * RHO
  if (h === 1 && a === 1) return 1 - RHO
  return 1
}

export function buildScoreMatrix(lambdaHome: number, lambdaAway: number, maxGoals = 8): number[][] {
  const matrix: number[][] = []
  let total = 0
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = []
    for (let a = 0; a <= maxGoals; a++) {
      const raw = poissonProb(lambdaHome, h) * poissonProb(lambdaAway, a)
      const tau = dixonColesTau(h, a, lambdaHome, lambdaAway)
      matrix[h][a] = raw * tau
      total += matrix[h][a]
    }
  }
  for (let h = 0; h <= maxGoals; h++)
    for (let a = 0; a <= maxGoals; a++)
      matrix[h][a] /= total
  return matrix
}

export function extractMatchProbabilities(matrix: number[][]): MatchProbabilities {
  let homeWin = 0, draw = 0, awayWin = 0
  let over15 = 0, over25 = 0, over35 = 0, over45 = 0
  let btts = 0, cleanSheetHome = 0, cleanSheetAway = 0
  const scores: { score: string; prob: number }[] = []

  for (let h = 0; h < matrix.length; h++) {
    for (let a = 0; a < matrix[h].length; a++) {
      const p = matrix[h][a]
      if (h > a) homeWin += p
      else if (h === a) draw += p
      else awayWin += p
      if (h + a > 1) over15 += p
      if (h + a > 2) over25 += p
      if (h + a > 3) over35 += p
      if (h + a > 4) over45 += p
      if (h > 0 && a > 0) btts += p
      if (a === 0) cleanSheetHome += p
      if (h === 0) cleanSheetAway += p
      if (h <= 5 && a <= 5) scores.push({ score: `${h}-${a}`, prob: p })
    }
  }

  scores.sort((a, b) => b.prob - a.prob)

  return {
    homeWin, draw, awayWin,
    over15, over25, over35, over45,
    btts, cleanSheetHome, cleanSheetAway,
    exactScores: scores.slice(0, 10),
  }
}
