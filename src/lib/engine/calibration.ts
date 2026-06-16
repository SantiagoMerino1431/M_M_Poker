import type { Bet } from "@/lib/types"

export interface CalibrationBucket {
  label: string
  predicted: number
  actual: number
  count: number
}

export interface CalibrationReport {
  totalBets: number
  settledBets: number
  winRate: number | null
  totalProfit: number
  roi: number | null
  brierScore: number | null
  logLoss: number | null
  clvAvg: number | null
  buckets: CalibrationBucket[]
}

function emptyBuckets(): CalibrationBucket[] {
  return Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}–${(i + 1) * 10}%`,
    predicted: (i + 0.5) / 10,
    actual: 0,
    count: 0,
  }))
}

export function calibrationReport(bets: Bet[]): CalibrationReport {
  const settled = bets.filter(b => b.result !== null && b.profitLoss !== null)

  if (bets.length === 0) {
    return {
      totalBets: 0,
      settledBets: 0,
      winRate: null,
      totalProfit: 0,
      roi: null,
      brierScore: null,
      logLoss: null,
      clvAvg: null,
      buckets: emptyBuckets(),
    }
  }

  const wins = settled.filter(b => b.result === "win").length
  const winRate = settled.length > 0 ? wins / settled.length : null
  const totalProfit = settled.reduce((s, b) => s + (b.profitLoss ?? 0), 0)
  const totalStaked = settled.reduce((s, b) => s + b.amount, 0)
  const roi = totalStaked > 0 ? totalProfit / totalStaked : null

  // Brier score: mean((p - outcome)^2)
  const withOutcome = settled.map(b => ({
    p: b.ourProbability,
    o: b.result === "win" ? 1 : 0,
  }))
  const brierScore = withOutcome.length > 0
    ? withOutcome.reduce((s, { p, o }) => s + (p - o) ** 2, 0) / withOutcome.length
    : null

  // Log loss: -mean(o*log(p) + (1-o)*log(1-p))
  const eps = 1e-7
  const logLoss = withOutcome.length > 0
    ? -withOutcome.reduce((s, { p, o }) =>
        s + o * Math.log(Math.max(p, eps)) + (1 - o) * Math.log(Math.max(1 - p, eps)), 0
      ) / withOutcome.length
    : null

  // CLV: positive when our odds > closing odds (we beat the close)
  // impliedUsed = 1/oddsUsed, impliedClosing = 1/oddsClosing
  // CLV = (impliedClosing - impliedUsed) / impliedClosing
  const clvBets = settled.filter(
    b => b.oddsClosing != null && b.oddsClosing > 1 && b.oddsUsed > 1
  )
  const clvAvg = clvBets.length > 0
    ? clvBets.reduce((s, b) => {
        const impliedUsed = 1 / b.oddsUsed
        const impliedClosing = 1 / b.oddsClosing!
        return s + (impliedClosing - impliedUsed) / impliedClosing
      }, 0) / clvBets.length
    : null

  // Calibration buckets: 10 buckets 0-10%, 10-20%, ..., 90-100%
  const buckets = emptyBuckets()
  for (const { p, o } of withOutcome) {
    const idx = Math.min(9, Math.floor(p * 10))
    buckets[idx].count++
    buckets[idx].actual += o
  }
  for (const bucket of buckets) {
    if (bucket.count > 0) bucket.actual /= bucket.count
  }

  return {
    totalBets: bets.length,
    settledBets: settled.length,
    winRate,
    totalProfit,
    roi,
    brierScore,
    logLoss,
    clvAvg,
    buckets,
  }
}
