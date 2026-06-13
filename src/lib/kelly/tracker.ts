import { db } from "../db/client"
import type { Bet } from "../types"
export { calcMetrics, type BettingMetrics } from "./metrics"

export async function saveBet(bet: Omit<Bet, "id">): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO bets (
      fixture_id, user_id, market, selection, our_probability, bookmaker_probability,
      odds_used, odds_closing, amount, kelly_suggested, ev, edge,
      result, profit_loss, mode, confidence_at_time, created_at, settled_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      bet.fixtureId, bet.userId ?? null, bet.market, bet.selection,
      bet.ourProbability, bet.bookmakerProbability,
      bet.oddsUsed, bet.oddsClosing, bet.amount,
      bet.kellySuggested, bet.EV, bet.edge,
      bet.result, bet.profitLoss, bet.mode,
      bet.confidenceAtTime, bet.createdAt, bet.settledAt,
    ],
  })
  return Number(result.lastInsertRowid)
}

export async function getBets(filter?: { mode?: "real" | "paper"; userId?: number }): Promise<Bet[]> {
  const conditions: string[] = []
  const args: any[] = []
  if (filter?.mode) { conditions.push("mode = ?"); args.push(filter.mode) }
  if (filter?.userId != null) { conditions.push("user_id = ?"); args.push(filter.userId) }
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : ""
  const rows = await db.execute({ sql: `SELECT * FROM bets${where} ORDER BY created_at DESC`, args })
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

export async function deleteBet(id: number): Promise<void> {
  await db.execute({ sql: "DELETE FROM bets WHERE id = ?", args: [id] })
}

const EDITABLE_COLUMNS: Record<string, string> = {
  amount: "amount",
  oddsUsed: "odds_used",
  oddsClosing: "odds_closing",
  selection: "selection",
}

export async function updateBet(
  id: number,
  patch: Partial<Pick<Bet, "amount" | "oddsUsed" | "oddsClosing" | "selection">>,
): Promise<void> {
  const sets: string[] = []
  const args: any[] = []
  for (const [k, col] of Object.entries(EDITABLE_COLUMNS)) {
    if ((patch as any)[k] !== undefined) {
      sets.push(`${col} = ?`)
      args.push((patch as any)[k])
    }
  }
  if (sets.length === 0) return
  args.push(id)
  await db.execute({ sql: `UPDATE bets SET ${sets.join(", ")} WHERE id = ?`, args })
}
