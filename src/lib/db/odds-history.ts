import { db } from "./client"

export interface OddsPoint {
  odds: number
  source: string
  recordedAt: string
}

export async function appendOdds(
  fixtureId: number, market: string, selection: string, odds: number, source = "manual"
): Promise<void> {
  if (!Number.isFinite(odds) || odds <= 1) return
  await db.execute({
    sql: `INSERT INTO odds_history (fixture_id, market, selection, odds, source, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [fixtureId, market, selection, odds, source, new Date().toISOString()],
  })
}

export async function listOddsHistory(
  fixtureId: number, market: string, selection: string
): Promise<OddsPoint[]> {
  const rows = await db.execute({
    sql: `SELECT odds, source, recorded_at FROM odds_history
          WHERE fixture_id = ? AND market = ? AND selection = ?
          ORDER BY recorded_at ASC`,
    args: [fixtureId, market, selection],
  })
  return (rows.rows as any[]).map(r => ({ odds: r.odds, source: r.source, recordedAt: r.recorded_at }))
}
