// Calibration report: Brier score + reliability diagram buckets.
// Usage: pnpm calibrate:run
import { db } from "../src/lib/db/client"

interface BetRow {
  our_probability: number
  bookmaker_probability: number | null
  odds_closing: number | null
  odds_used: number
  result: "win" | "loss" | "void"
  ev: number
}

async function run() {
  const rows = await db.execute(
    `SELECT our_probability, bookmaker_probability, odds_closing, odds_used, result, ev
     FROM bets
     WHERE result IN ('win','loss') AND mode = 'real'
     ORDER BY created_at ASC`
  )

  const bets = rows.rows as unknown as BetRow[]

  if (bets.length === 0) {
    console.log("Sin apuestas liquidadas para calibrar.")
    process.exit(0)
  }

  // --- Brier score ---
  const brierSum = bets.reduce((s, b) => {
    const outcome = b.result === "win" ? 1 : 0
    return s + Math.pow(b.our_probability - outcome, 2)
  }, 0)
  const brier = brierSum / bets.length

  // --- Log loss ---
  const eps = 1e-7
  const logLossSum = bets.reduce((s, b) => {
    const outcome = b.result === "win" ? 1 : 0
    const p = Math.max(eps, Math.min(1 - eps, b.our_probability))
    return s + (outcome === 1 ? -Math.log(p) : -Math.log(1 - p))
  }, 0)
  const logLoss = logLossSum / bets.length

  // --- Calibration buckets (10 buckets 0-10%, 10-20%, ...) ---
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}-${(i + 1) * 10}%`,
    count: 0,
    wins: 0,
    sumP: 0,
  }))

  for (const b of bets) {
    const idx = Math.min(9, Math.floor(b.our_probability * 10))
    buckets[idx].count++
    buckets[idx].wins += b.result === "win" ? 1 : 0
    buckets[idx].sumP += b.our_probability
  }

  // --- Average CLV ---
  const clvBets = bets.filter(b => b.odds_closing !== null)
  const avgCLV = clvBets.length
    ? clvBets.reduce((s, b) => s + (b.odds_used / b.odds_closing! - 1), 0) / clvBets.length
    : null

  // --- ROI ---
  const roi = await db.execute(
    `SELECT SUM(profit_loss) as pl, SUM(amount) as staked FROM bets WHERE result IN ('win','loss') AND mode = 'real'`
  )
  const { pl, staked } = roi.rows[0] as any
  const roiPct = staked > 0 ? ((pl / staked) * 100).toFixed(2) : "N/A"

  // --- Output ---
  console.log("\n===== CALIBRATION REPORT =====")
  console.log(`Apuestas analizadas : ${bets.length}`)
  console.log(`Brier Score         : ${brier.toFixed(4)}  (0=perfecto, 0.25=azar)`)
  console.log(`Log Loss            : ${logLoss.toFixed(4)}`)
  console.log(`ROI real            : ${roiPct}%`)
  if (avgCLV !== null) console.log(`CLV promedio        : ${(avgCLV * 100).toFixed(2)}%  (n=${clvBets.length})`)

  console.log("\n--- Diagrama de fiabilidad ---")
  console.log("Bucket     | N   | Predicho | Real     | Diferencia")
  console.log("-----------|-----|----------|----------|-----------")
  for (const b of buckets) {
    if (b.count === 0) continue
    const predicted = (b.sumP / b.count * 100).toFixed(1)
    const actual = (b.wins / b.count * 100).toFixed(1)
    const diff = ((b.wins / b.count - b.sumP / b.count) * 100).toFixed(1)
    const flag = Math.abs(b.wins / b.count - b.sumP / b.count) > 0.10 ? " (**)" : ""
    console.log(`${b.range.padEnd(10)} | ${String(b.count).padEnd(3)} | ${predicted.padStart(7)}% | ${actual.padStart(7)}% | ${diff.padStart(8)}%${flag}`)
  }

  console.log("\n(**) Divergencia > 10 puntos — revisar modelo en ese rango de probabilidad")
  console.log("==============================\n")

  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
