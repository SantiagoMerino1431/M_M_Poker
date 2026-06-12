export interface TeamStrengths {
  attackStrength: number
  defenseStrength: number
  fifaRanking: number
}

export interface MatchPrediction {
  homeWin: number
  draw: number
  awayWin: number
  over15: number
  over25: number
  over35: number
  btts: number
  expectedHomeGoals: number
  expectedAwayGoals: number
  exactScores: { score: string; prob: number }[]
  cleanSheetHome: number
  cleanSheetAway: number
}

function factorial(n: number): number {
  if (n <= 1) return 1
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

function poissonProb(lambda: number, k: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k)
}

function lambdaFromStrengths(
  attacker: TeamStrengths,
  defender: TeamStrengths,
  homeAdvantage = 1.1,
  isHome = true,
  avgGoals = 1.4
): number {
  const rankFactor = 1 + (50 - attacker.fifaRanking) * 0.003
  const base = avgGoals * attacker.attackStrength * defender.defenseStrength * rankFactor
  return isHome ? base * homeAdvantage : base
}

export const DIXON_COLES_RHO = -0.13

// Factor de dependencia de Dixon-Coles para corregir la sub-estimación de
// marcadores bajos del Poisson independiente.
function dixonColesTau(h: number, a: number, lambdaH: number, lambdaA: number, rho: number): number {
  if (h === 0 && a === 0) return 1 - lambdaH * lambdaA * rho
  if (h === 0 && a === 1) return 1 + lambdaH * rho
  if (h === 1 && a === 0) return 1 + lambdaA * rho
  if (h === 1 && a === 1) return 1 - rho
  return 1
}

export function buildScoreMatrix(lambdaHome: number, lambdaAway: number, maxGoals = 8): number[][] {
  const matrix: number[][] = []
  let total = 0
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = []
    for (let a = 0; a <= maxGoals; a++) {
      const base = poissonProb(lambdaHome, h) * poissonProb(lambdaAway, a)
      const adjusted = base * dixonColesTau(h, a, lambdaHome, lambdaAway, DIXON_COLES_RHO)
      matrix[h][a] = adjusted
      total += adjusted
    }
  }
  // Normalizar para que la matriz sume 1 tras el ajuste y el truncamiento.
  for (let h = 0; h <= maxGoals; h++)
    for (let a = 0; a <= maxGoals; a++)
      matrix[h][a] /= total
  return matrix
}

export interface MatchProbabilities {
  homeWin: number
  draw: number
  awayWin: number
}

export function extractMatchProbabilities(matrix: number[][]): MatchProbabilities {
  let homeWin = 0, draw = 0, awayWin = 0
  for (let h = 0; h < matrix.length; h++) {
    for (let a = 0; a < matrix[h].length; a++) {
      const p = matrix[h][a]
      if (h > a) homeWin += p
      else if (h === a) draw += p
      else awayWin += p
    }
  }
  return { homeWin, draw, awayWin }
}

export function predictMatch(
  home: TeamStrengths,
  away: TeamStrengths,
  recentFormHome = 0,
  recentFormAway = 0
): MatchPrediction {
  const lambdaHome = lambdaFromStrengths(home, away, 1.1, true) * (1 + recentFormHome * 0.05)
  const lambdaAway = lambdaFromStrengths(away, home, 1.0, false) * (1 + recentFormAway * 0.05)

  const matrix = buildScoreMatrix(lambdaHome, lambdaAway)

  let homeWin = 0, draw = 0, awayWin = 0
  let over15 = 0, over25 = 0, over35 = 0, btts = 0
  let cleanSheetHome = 0, cleanSheetAway = 0
  const scores: { score: string; prob: number }[] = []

  for (let h = 0; h < matrix.length; h++) {
    for (let a = 0; a < matrix[h].length; a++) {
      const p = matrix[h][a]
      if (h > a) homeWin += p
      else if (h === a) draw += p
      else awayWin += p
      if (h + a > 1.5) over15 += p
      if (h + a > 2.5) over25 += p
      if (h + a > 3.5) over35 += p
      if (h > 0 && a > 0) btts += p
      if (a === 0) cleanSheetHome += p
      if (h === 0) cleanSheetAway += p
      if (h <= 5 && a <= 5) scores.push({ score: `${h}-${a}`, prob: p })
    }
  }

  scores.sort((a, b) => b.prob - a.prob)

  return {
    homeWin, draw, awayWin,
    over15, over25, over35, btts,
    expectedHomeGoals: lambdaHome,
    expectedAwayGoals: lambdaAway,
    exactScores: scores.slice(0, 5),
    cleanSheetHome,
    cleanSheetAway,
  }
}
