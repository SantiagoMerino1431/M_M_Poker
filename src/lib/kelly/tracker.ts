import { db } from "../db/client"
import type { Bet } from "../types"
export { calcMetrics, type BettingMetrics } from "./metrics"

export async function saveBet(bet: Omit<Bet, "id">): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO bets (
      fixture_id, market, selection, our_probability, bookmaker_probability,
      odds_used, odds_closing, amount, kelly_suggested, ev, edge,
      result, profit_loss, mode, confidence_at_time, created_at, settled_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      bet.fixtureId, bet.market, bet.selection,
      bet.ourProbability, bet.bookmakerProbability,
      bet.oddsUsed, bet.oddsClosing, bet.amount,
      bet.kellySuggested, bet.EV, bet.edge,
      bet.result, bet.profitLoss, bet.mode,
      bet.confidenceAtTime, bet.createdAt, bet.settledAt,
    ],
  })
  return Number(result.lastInsertRowid)
}

export async function getBets(filter?: { mode?: "real" | "paper" }): Promise<Bet[]> {
  const sql = filter?.mode
    ? "SELECT * FROM bets WHERE mode = ? ORDER BY created_at DESC"
    : "SELECT * FROM bets ORDER BY created_at DESC"
  const args = filter?.mode ? [filter.mode] : []
  const rows = await db.execute({ sql, args })
  return (rows.rows as any[]).map(rowToBet)
}

function rowToBet(r: any): Bet {
  return {
    id: r.id, fixtureId: r.fixture_id, market: r.market, selection: r.selection,
    ourProbability: r.our_probability, bookmakerProbability: r.bookmaker_probability,
    oddsUsed: r.odds_used, oddsClosing: r.odds_closing, amount: r.amount,
    kellySuggested: r.kelly_suggested, EV: r.ev, edge: r.edge,
    result: r.result, profitLoss: r.profit_loss, mode: r.mode,
    confidenceAtTime: r.confidence_at_time, createdAt: r.created_at, settledAt: r.settled_at,
  }
}
