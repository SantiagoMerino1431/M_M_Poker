import { db } from "../db/client"
import type { BankrollState } from "../types"

const INITIAL_BANKROLL = 100_000
const TRIAL_MATCHES = 4

export async function getBankrollState(userId?: number): Promise<BankrollState & { totalBetsPlaced: number; trialMode: boolean }> {
  const userFilter = userId != null ? " WHERE user_id = ?" : ""
  const userArg = userId != null ? [userId] : []

  const rows = await db.execute({
    sql: `SELECT * FROM bankroll_snapshots${userFilter} ORDER BY created_at DESC LIMIT 2`,
    args: userArg,
  })
  const snapshots = rows.rows as any[]

  // Fall back to initial_bankroll from users table if no snapshots
  let defaultBankroll = INITIAL_BANKROLL
  if (snapshots.length === 0 && userId != null) {
    const userRow = await db.execute({ sql: "SELECT initial_bankroll FROM users WHERE id = ?", args: [userId] })
    defaultBankroll = (userRow.rows[0] as any)?.initial_bankroll ?? INITIAL_BANKROLL
  }

  const current = snapshots.find(s => s.snapshot_type === "daily")?.balance ?? defaultBankroll
  const initial = snapshots.find(s => s.snapshot_type === "weekly")?.balance ?? defaultBankroll

  const lossArgs = userId != null ? [userId] : []
  const lossSql = userId != null
    ? "SELECT result FROM bets WHERE mode = 'real' AND user_id = ? ORDER BY created_at DESC LIMIT 10"
    : "SELECT result FROM bets WHERE mode = 'real' ORDER BY created_at DESC LIMIT 10"
  const lossRows = await db.execute({ sql: lossSql, args: lossArgs })
  const recent = (lossRows.rows as any[]).map(r => r.result)
  let consecutive = 0
  for (const r of recent) {
    if (r === "loss") consecutive++
    else break
  }

  const countSql = userId != null
    ? "SELECT COUNT(DISTINCT fixture_id) as n FROM bets WHERE mode = 'real' AND user_id = ?"
    : "SELECT COUNT(DISTINCT fixture_id) as n FROM bets WHERE mode = 'real'"
  const countRow = await db.execute({ sql: countSql, args: lossArgs })
  const totalBetsPlaced = Number((countRow.rows[0] as any).n ?? 0)
  const trialMode = totalBetsPlaced < TRIAL_MATCHES

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
    totalBetsPlaced,
    trialMode,
  }
}

export async function updateBankroll(newBalance: number, type: "daily" | "weekly" | "manual", userId?: number) {
  await db.execute({
    sql: "INSERT INTO bankroll_snapshots (balance, snapshot_type, user_id, created_at) VALUES (?, ?, ?, ?)",
    args: [newBalance, type, userId ?? null, new Date().toISOString()],
  })
}

export async function initBankroll() {
  const existing = await db.execute(
    "SELECT COUNT(*) as n FROM bankroll_snapshots"
  )
  if (Number((existing.rows[0] as any).n) > 0) {
    console.log("[bankroll] Ya inicializado, sin cambios")
    return
  }
  const now = new Date().toISOString()
  await db.execute({
    sql: "INSERT INTO bankroll_snapshots (balance, snapshot_type, created_at) VALUES (?, ?, ?)",
    args: [INITIAL_BANKROLL, "weekly", now],
  })
  await db.execute({
    sql: "INSERT INTO bankroll_snapshots (balance, snapshot_type, created_at) VALUES (?, ?, ?)",
    args: [INITIAL_BANKROLL, "daily", now],
  })
  console.log(`[bankroll] Bankroll inicial: $${INITIAL_BANKROLL.toLocaleString()} COP`)
}
