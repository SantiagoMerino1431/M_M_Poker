"use server"
import { db } from "@/lib/db/client"
import { getBankrollState } from "@/lib/kelly/bankroll"
import { calcMetrics, getBets, saveBet } from "@/lib/kelly/tracker"
import type { MatchAnalysis, Bet } from "@/lib/types"

export async function getTodayAnalyses(): Promise<MatchAnalysis[]> {
  const today = new Date().toISOString().split("T")[0]
  const rows = await db.execute({
    sql: "SELECT * FROM match_analyses WHERE created_at >= ? ORDER BY confidence DESC",
    args: [`${today}T00:00:00Z`],
  })
  return (rows.rows as any[]).map(r => ({
    fixtureId: r.fixture_id,
    confidence: r.confidence,
    isPreliminary: Boolean(r.is_preliminary),
    model: { lambdaHome: r.lambda_home, lambdaAway: r.lambda_away, adjustmentsApplied: JSON.parse(r.adjustments_applied || "[]"), scoreMatrix: [] },
    markets: JSON.parse(r.markets || "[]"),
    alerts: JSON.parse(r.alerts || "[]"),
    lastUpdated: r.created_at,
  }))
}

export async function getAnalysisForFixture(fixtureId: number): Promise<MatchAnalysis | null> {
  const rows = await db.execute({
    sql: "SELECT * FROM match_analyses WHERE fixture_id = ? ORDER BY created_at DESC LIMIT 1",
    args: [fixtureId],
  })
  const r = rows.rows[0] as any
  if (!r) return null
  return {
    fixtureId: r.fixture_id,
    confidence: r.confidence,
    isPreliminary: Boolean(r.is_preliminary),
    model: { lambdaHome: r.lambda_home, lambdaAway: r.lambda_away, adjustmentsApplied: JSON.parse(r.adjustments_applied || "[]"), scoreMatrix: [] },
    markets: JSON.parse(r.markets || "[]"),
    alerts: JSON.parse(r.alerts || "[]"),
    lastUpdated: r.created_at,
  }
}

export async function registerBet(bet: Omit<Bet, "id">): Promise<{ id: number }> {
  const id = await saveBet(bet)
  return { id }
}

export async function getDashboardData() {
  const [bankroll, bets] = await Promise.all([
    getBankrollState(),
    getBets({ mode: "real" }),
  ])
  const metrics = calcMetrics(bets)
  const alertRows = await db.execute("SELECT * FROM alerts WHERE is_read = 0 ORDER BY created_at DESC LIMIT 5")
  return { bankroll, metrics, alerts: alertRows.rows }
}
