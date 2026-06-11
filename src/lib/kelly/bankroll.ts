import { db } from "../db/client"
import type { BankrollState } from "../types"

export async function getBankrollState(): Promise<BankrollState> {
  const rows = await db.execute(
    "SELECT * FROM bankroll_snapshots ORDER BY created_at DESC LIMIT 2"
  )
  const snapshots = rows.rows as any[]

  const current = snapshots.find(s => s.snapshot_type === "daily")?.balance ?? 1000
  const initial = snapshots.find(s => s.snapshot_type === "weekly")?.balance ?? current

  const lossRows = await db.execute(
    "SELECT result FROM bets WHERE mode = 'real' ORDER BY created_at DESC LIMIT 10"
  )
  const recent = (lossRows.rows as any[]).map(r => r.result)
  let consecutive = 0
  for (const r of recent) {
    if (r === "loss") consecutive++
    else break
  }

  const drawdown = (initial - current) / Math.max(initial, 1)
  const mode: BankrollState["mode"] =
    consecutive >= 5 ? "paused" :
    drawdown > 0.30 ? "conservative" :
    "normal"

  return {
    current,
    initial,
    weeklySnapshot: initial,
    mode,
    consecutiveLosses: consecutive,
    lastUpdated: new Date().toISOString(),
  }
}

export async function updateBankroll(newBalance: number, type: "daily" | "weekly" | "manual") {
  await db.execute({
    sql: "INSERT INTO bankroll_snapshots (balance, snapshot_type, created_at) VALUES (?, ?, ?)",
    args: [newBalance, type, new Date().toISOString()],
  })
}
