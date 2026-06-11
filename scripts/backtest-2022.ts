import { db } from "../src/lib/db/client"
import { analyzeMatch } from "../src/lib/engine/analyzer"
import { loadAll, buildMatchData } from "./backtest/builder"
import { resolveMarket } from "./backtest/resolver"
import path from "path"

const DATA = path.resolve(process.cwd(), "data")
const BANKROLL = 100_000

interface CalibrationBucket {
  total: number
  wins: number
}

async function main() {
  console.log("=== BACKTEST QATAR 2022 ===\n")
  console.log("Cargando datos CSV...")
  const loaders = loadAll(DATA)
  const matches = loaders.matches
  console.log(`${matches.length} partidos cargados.\n`)

  let bankroll = BANKROLL
  let totalBets = 0
  let totalWins = 0
  let totalStaked = 0
  let totalPL = 0
  let peakBankroll = BANKROLL
  let maxDrawdown = 0

  const calibration: CalibrationBucket[] = Array.from({ length: 10 }, () => ({ total: 0, wins: 0 }))

  const betsToSave: Array<{
    fixture_id: number
    market: string
    selection: string
    our_probability: number
    bookmaker_probability: number | null
    odds_used: number
    amount: number
    kelly_suggested: number
    ev: number
    edge: number
    result: string
    profit_loss: number
    confidence_at_time: number
    created_at: string
    settled_at: string
  }> = []

  for (const match of matches) {
    const md = buildMatchData(match.home, match.away, match.date, match.fixtureId, loaders, match.stage)
    const analysis = analyzeMatch(md, bankroll)

    const recommended = analysis.markets.filter(
      m => m.isRecommended && m.odds !== null && m.kellyAmount !== null
    )

    for (const market of recommended) {
      const result = resolveMarket(market.name, market.selection, match.homeScore, match.awayScore)
      const amount = market.kellyAmount!
      const pl = result === "win"
        ? Math.round(amount * (market.odds! - 1))
        : result === "loss"
          ? -amount
          : 0

      bankroll += pl
      totalBets++
      if (result === "win") totalWins++
      totalStaked += amount
      totalPL += pl

      if (bankroll > peakBankroll) peakBankroll = bankroll
      const drawdown = (peakBankroll - bankroll) / peakBankroll
      if (drawdown > maxDrawdown) maxDrawdown = drawdown

      const decile = Math.min(9, Math.floor(market.ourProbability * 10))
      calibration[decile].total++
      if (result === "win") calibration[decile].wins++

      betsToSave.push({
        fixture_id:          match.fixtureId,
        market:              market.name,
        selection:           market.selection,
        our_probability:     market.ourProbability,
        bookmaker_probability: market.bookmakerProbability,
        odds_used:           market.odds!,
        amount,
        kelly_suggested:     market.kellyFraction!,
        ev:                  market.EV!,
        edge:                market.edge!,
        result,
        profit_loss:         pl,
        confidence_at_time:  analysis.confidence,
        created_at:          match.date + "T12:00:00Z",
        settled_at:          match.date + "T14:00:00Z",
      })
    }

    const flag = recommended.length > 0 ? `✓ ${recommended.length} apuesta(s)` : "  sin recomendaciones"
    console.log(`${match.date} ${match.home} ${match.homeScore}-${match.awayScore} ${match.away}  ${flag}`)
  }

  if (betsToSave.length > 0) {
    console.log(`\nGuardando ${betsToSave.length} apuestas en DB (mode=paper)...`)
    for (const bet of betsToSave) {
      await db.execute({
        sql: `INSERT INTO bets
          (fixture_id, market, selection, our_probability, bookmaker_probability,
           odds_used, odds_closing, amount, kelly_suggested, ev, edge,
           result, profit_loss, mode, confidence_at_time, created_at, settled_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'paper',?,?,?)`,
        args: [
          bet.fixture_id, bet.market, bet.selection,
          bet.our_probability, bet.bookmaker_probability,
          bet.odds_used, bet.odds_used,
          bet.amount, bet.kelly_suggested, bet.ev, bet.edge,
          bet.result, bet.profit_loss,
          bet.confidence_at_time, bet.created_at, bet.settled_at,
        ],
      })
    }
    console.log("Guardado.\n")
  }

  const roi    = totalStaked > 0 ? (totalPL / totalStaked) * 100 : 0
  const strike = totalBets > 0 ? (totalWins / totalBets) * 100 : 0

  console.log("\n════════════════════════════════")
  console.log("  RESULTADOS BACKTEST 2022")
  console.log("════════════════════════════════")
  console.log(`Partidos analizados:    ${matches.length}`)
  console.log(`Apuestas recomendadas:  ${totalBets}`)
  console.log(`Apuestas ganadoras:     ${totalWins} (${strike.toFixed(1)}% strike rate)`)
  console.log(`Total apostado:         $${totalStaked.toLocaleString()} COP`)
  console.log(`P/L total:              $${totalPL.toLocaleString()} COP`)
  console.log(`ROI:                    ${roi.toFixed(2)}%`)
  console.log(`Bankroll final:         $${bankroll.toLocaleString()} COP (inicio $${BANKROLL.toLocaleString()} COP)`)
  console.log(`Drawdown máximo:        ${(maxDrawdown * 100).toFixed(1)}%`)

  console.log("\nCalibración (prob. modelo vs frecuencia real):")
  console.log("  Decil      | Predicho | Real     | N")
  console.log("  -----------|----------|----------|----")
  calibration.forEach((b, i) => {
    const predicted = `${i * 10}-${(i + 1) * 10}%`
    const actual    = b.total > 0 ? `${((b.wins / b.total) * 100).toFixed(0)}%` : "N/A"
    console.log(`  ${predicted.padEnd(11)}| ${((i * 10 + 5) + "%").padEnd(9)}| ${actual.padEnd(9)}| ${b.total}`)
  })
  console.log("")
}

main().catch(err => {
  console.error("Error en backtest:", err)
  process.exit(1)
})
