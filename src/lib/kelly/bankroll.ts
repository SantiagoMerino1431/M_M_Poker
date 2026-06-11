import { db } from "../db/client"
import type { BankrollState } from "../types"

const INITIAL_BANKROLL = 100_000
const TRIAL_MATCHES = 4

export async function getBankrollState(): Promise<BankrollState & { totalBetsPlaced: number; trialMode: boolean }> {
  const rows = await db.execute(
    "SELECT * FROM bankroll_snapshots ORDER BY created_at DESC LIMIT 2"
  )
  const snapshots = rows.rows as any[]

  const current = snapshots.find(s => s.snapshot_type === "daily")?.balance ?? INITIAL_BANKROLL
  const initial = snapshots.find(s => s.snapshot_type === "weekly")?.balance ?? INITIAL_BANKROLL

  const lossRows = await db.execute(
    "SELECT result FROM bets WHERE mode = 'real' ORDER BY created_at DESC LIMIT 10"
  )
  const recent = (lossRows.rows as any[]).map(r => r.result)
  let consecutive = 0
  for (const r of recent) {
    if (r === "loss") consecutive++
    else break
  }

  const countRow = await db.execute(
    "SELECT COUNT(DISTINCT fixture_id) as n FROM bets WHERE mode = 'real'"
  )
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

export async function updateBankroll(newBalance: number, type: "daily" | "weekly" | "manual") {
  await db.execute({
    sql: "INSERT INTO bankroll_snapshots (balance, snapshot_type, created_at) VALUES (?, ?, ?)",
    args: [newBalance, type, new Date().toISOString()],
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
