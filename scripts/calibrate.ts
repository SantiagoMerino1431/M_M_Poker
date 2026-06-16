// Calibration report: Brier score, log loss, CLV, reliability diagram.
// Usage: pnpm calibrate:run
import { getBets } from "../src/lib/kelly/tracker"
import { calibrationReport } from "../src/lib/engine/calibration"

async function run() {
  const allBets = await getBets({})
  const realBets = allBets.filter(b => b.mode === "real")
  const report = calibrationReport(realBets)

  if (report.settledBets === 0) {
    console.log("Sin apuestas liquidadas para calibrar.")
    process.exit(0)
  }

  function pct(n: number | null, decimals = 2) {
    if (n == null) return "N/A"
    return `${(n * 100).toFixed(decimals)}%`
  }

  console.log("\n===== CALIBRATION REPORT =====")
  console.log(`Apuestas totales    : ${report.totalBets}`)
  console.log(`Apuestas liquidadas : ${report.settledBets}`)
  console.log(`Win rate            : ${pct(report.winRate)}`)
  console.log(`ROI real            : ${pct(report.roi)}`)
  console.log(`Beneficio           : ${report.totalProfit.toFixed(0)}`)
  console.log(`Brier Score         : ${report.brierScore?.toFixed(4) ?? "N/A"}  (0=perfecto, 0.25=azar)`)
  console.log(`Log Loss            : ${report.logLoss?.toFixed(4) ?? "N/A"}`)
  if (report.clvAvg != null) {
    const clvBets = realBets.filter(b => b.oddsClosing != null)
    console.log(`CLV promedio        : ${pct(report.clvAvg)}  (n=${clvBets.length})`)
  }

  console.log("\n--- Diagrama de fiabilidad ---")
  console.log("Bucket     | N   | Predicho | Real     | Diferencia")
  console.log("-----------|-----|----------|----------|-----------")
  for (const b of report.buckets) {
    if (b.count === 0) continue
    const predicted = (b.predicted * 100).toFixed(1)
    const actual = (b.actual * 100).toFixed(1)
    const diff = ((b.actual - b.predicted) * 100).toFixed(1)
    const flag = Math.abs(b.actual - b.predicted) > 0.10 ? " (**)" : ""
    console.log(`${b.label.padEnd(10)} | ${String(b.count).padEnd(3)} | ${predicted.padStart(7)}% | ${actual.padStart(7)}% | ${diff.padStart(8)}%${flag}`)
  }

  console.log("\n(**) Divergencia > 10 puntos — revisar modelo en ese rango de probabilidad")
  console.log("==============================\n")

  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
