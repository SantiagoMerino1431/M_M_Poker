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

export async function listAllOddsHistory(
  fixtureId: number
): Promise<Record<string, Record<string, OddsPoint[]>>> {
  const rows = await db.execute({
    sql: `SELECT market, selection, odds, source, recorded_at FROM odds_history
          WHERE fixture_id = ?
          ORDER BY recorded_at ASC`,
    args: [fixtureId],
  })
  const out: Record<string, Record<string, OddsPoint[]>> = {}
  for (const r of rows.rows as any[]) {
    if (!out[r.market]) out[r.market] = {}
    if (!out[r.market][r.selection]) out[r.market][r.selection] = []
    out[r.market][r.selection].push({ odds: r.odds, source: r.source, recordedAt: r.recorded_at })
  }
  return out
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
