"use server"
import { db } from "@/lib/db/client"
import { getBankrollState } from "@/lib/kelly/bankroll"
import { calcMetrics, getBets, saveBet } from "@/lib/kelly/tracker"
import type { MatchAnalysis, Bet } from "@/lib/types"

function normalizeName(name: string): string {
  return name.toLowerCase()
    .normalize("NFD").replace(/\p{Mn}/gu, "")
    .replace(/[\s'\-.]/g, "")
}

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
    homeTeam: r.home_team || undefined,
    awayTeam: r.away_team || undefined,
    lastUpdated: r.created_at,
  }))
}

export async function getFixtureDetails(fixtureId: number) {
  const rows = await db.execute({
    sql: `SELECT f.match_date, f.stage, f.stadium, f.city,
                 ht.name as home_name, ht.country as home_country,
                 ht.group_name, ht.fifa_ranking as home_ranking,
                 at.name as away_name, at.country as away_country,
                 at.fifa_ranking as away_ranking
          FROM fixtures f
          JOIN teams ht ON ht.id = f.home_team_id
          JOIN teams at ON at.id = f.away_team_id
          WHERE f.id = ?`,
    args: [fixtureId],
  })
  const r = rows.rows[0] as any
  if (!r) return null
  return {
    matchDate: r.match_date as string | null,
    stage: r.stage as string,
    stadium: r.stadium as string | null,
    city: r.city as string | null,
    groupName: r.group_name as string,
    home: { name: r.home_name as string, country: r.home_country as string, fifaRanking: r.home_ranking as number },
    away: { name: r.away_name as string, country: r.away_country as string, fifaRanking: r.away_ranking as number },
  }
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

// --- Admin Actions ---

export async function runDailyCronAction(): Promise<{ ok: boolean; message: string }> {
  try {
    const { migrate } = await import("@/lib/db/schema")
    const { seed } = await import("@/lib/db/seed")
    const { fetchTodayFixtures } = await import("@/lib/data/api-football")
    const { buildMatchData } = await import("@/lib/data/pipeline")

    await migrate()
    await seed()

    const teamsRows = await db.execute("SELECT * FROM teams")
    const teams = new Map<number, any>()
    const teamsByName = new Map<string, any>()
    for (const row of teamsRows.rows as any[]) {
      const t = {
        id: row.id, name: row.name, country: row.country, groupName: row.group_name,
        fifaRanking: row.fifa_ranking, attackStrength: row.attack_strength,
        defenseStrength: row.defense_strength,
      }
      teams.set(row.id, t)
      teamsByName.set(normalizeName(row.name), t)
    }

    const { analyzeMatch } = await import("@/lib/engine/analyzer")
    const bankrollState = await getBankrollState()

    const fixtures = await fetchTodayFixtures()

    if (fixtures.length === 0) {
      return { ok: true, message: "API devolvió 0 fixtures para hoy (league=1, season=2026)" }
    }

    let processed = 0
    const errors: string[] = []

    for (const fixture of fixtures) {
      const home = teams.get(fixture.homeTeamId)
        ?? teamsByName.get(normalizeName(fixture.homeTeamName))
        ?? { id: fixture.homeTeamId, name: fixture.homeTeamName, country: "", groupName: "",
             fifaRanking: 50, attackStrength: 1.0, defenseStrength: 1.0 }
      const away = teams.get(fixture.awayTeamId)
        ?? teamsByName.get(normalizeName(fixture.awayTeamName))
        ?? { id: fixture.awayTeamId, name: fixture.awayTeamName, country: "", groupName: "",
             fifaRanking: 50, attackStrength: 1.0, defenseStrength: 1.0 }
      try {
        const matchData = await buildMatchData({ ...fixture, altitudeM: 0 }, home, away)
        const analysis = analyzeMatch(matchData, bankrollState.current)
        await db.execute({
          sql: `INSERT OR REPLACE INTO match_analyses
                (fixture_id, is_preliminary, confidence, lambda_home, lambda_away,
                 adjustments_applied, markets, alerts, data_quality, home_team, away_team, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            fixture.id,
            analysis.isPreliminary ? 1 : 0,
            analysis.confidence,
            analysis.model.lambdaHome,
            analysis.model.lambdaAway,
            JSON.stringify(analysis.model.adjustmentsApplied),
            JSON.stringify(analysis.markets),
            JSON.stringify(analysis.alerts),
            matchData.dataQuality,
            fixture.homeTeamName,
            fixture.awayTeamName,
            new Date().toISOString(),
          ],
        })
        processed++
      } catch (err: any) {
        errors.push(`${fixture.homeTeamName} vs ${fixture.awayTeamName}: ${err?.message ?? err}`)
      }
    }

    if (processed === 0 && errors.length > 0) {
      return { ok: false, message: `${fixtures.length} fixtures de API, 0 guardados. Error: ${errors[0]}` }
    }

    return { ok: true, message: `${processed}/${fixtures.length} partidos procesados` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error en pipeline diario" }
  }
}

export async function runPreMatchAction(fixtureId?: number): Promise<{ ok: boolean; message: string }> {
  try {
    const { fetchTodayFixtures, fetchLineups } = await import("@/lib/data/api-football")
    const { fetchOdds } = await import("@/lib/data/odds-api")

    const teamsRows = await db.execute("SELECT * FROM teams")
    const teams = new Map<number, any>()
    for (const row of teamsRows.rows as any[]) {
      teams.set(row.id, { id: row.id, name: row.name })
    }

    const fixtures = await fetchTodayFixtures()
    const now = Date.now()

    const targets = fixtureId
      ? fixtures.filter(f => f.id === fixtureId)
      : fixtures.filter(f => {
          const minutesBefore = (new Date(f.date).getTime() - now) / 60000
          return minutesBefore >= 55 && minutesBefore <= 65
        })

    if (targets.length === 0) {
      return { ok: true, message: fixtureId ? "Fixture no encontrado" : "Sin partidos en los próximos 65 min" }
    }

    const names: string[] = []
    for (const fixture of targets) {
      const home = teams.get(fixture.homeTeamId)
      const away = teams.get(fixture.awayTeamId)
      if (!home || !away) continue

      const lineups = await fetchLineups(fixture.id)
      if (lineups.home && lineups.away) {
        await db.execute({
          sql: `INSERT INTO alerts (fixture_id, type, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
          args: [fixture.id, "lineup_available", `Alineaciones confirmadas: ${home.name} vs ${away.name}`, new Date().toISOString()],
        })
        names.push(`${home.name} vs ${away.name}`)
      }

      const odds = await fetchOdds(home.name, away.name)
      if (odds.length === 0) {
        await db.execute({
          sql: `INSERT INTO alerts (fixture_id, type, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
          args: [fixture.id, "stale_odds", `Sin cuotas: ${home.name} vs ${away.name}`, new Date().toISOString()],
        })
      }

      await db.execute({
        sql: `UPDATE match_analyses SET is_preliminary = 0 WHERE fixture_id = ?`,
        args: [fixture.id],
      })
    }

    return { ok: true, message: names.length > 0 ? `Lineups: ${names.join(", ")}` : "Procesado — sin lineups disponibles" }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error en pre-match" }
  }
}

export async function settleBetAction(
  betId: number,
  result: "win" | "loss" | "void"
): Promise<{ ok: boolean; message: string }> {
  try {
    const rows = await db.execute({ sql: "SELECT * FROM bets WHERE id = ?", args: [betId] })
    const bet = rows.rows[0] as any
    if (!bet) return { ok: false, message: "Apuesta no encontrada" }

    const profitLoss = result === "win"
      ? Math.round(bet.amount * (bet.odds_used - 1))
      : result === "loss" ? -bet.amount : 0

    await db.execute({
      sql: `UPDATE bets SET result = ?, profit_loss = ?, settled_at = ? WHERE id = ?`,
      args: [result, profitLoss, new Date().toISOString(), betId],
    })

    const label = result === "win" ? `+$${profitLoss}` : result === "loss" ? `-$${bet.amount}` : "Void"
    return { ok: true, message: `Liquidada: ${label} COP` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al liquidar" }
  }
}

export async function adjustBankrollAction(
  amount: number,
  reason?: string
): Promise<{ ok: boolean; message: string }> {
  try {
    await db.execute({
      sql: `INSERT INTO bankroll_snapshots (snapshot_type, balance, created_at) VALUES (?, ?, ?)`,
      args: ["manual", amount, new Date().toISOString()],
    })
    return { ok: true, message: `Bankroll ajustado a $${amount.toLocaleString("es-CO")} COP` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al ajustar bankroll" }
  }
}

export async function takeWeeklySnapshotAction(): Promise<{ ok: boolean; message: string }> {
  try {
    const state = await getBankrollState()
    await db.execute({
      sql: `INSERT INTO bankroll_snapshots (snapshot_type, balance, created_at) VALUES (?, ?, ?)`,
      args: ["weekly", state.current, new Date().toISOString()],
    })
    return { ok: true, message: `Snapshot: $${state.current.toLocaleString("es-CO")} COP` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al guardar snapshot" }
  }
}

export async function clearAlertsAction(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await db.execute("UPDATE alerts SET is_read = 1 WHERE is_read = 0")
    const count = res.rowsAffected ?? 0
    return { ok: true, message: `${count} alerta${count !== 1 ? "s" : ""} marcada${count !== 1 ? "s" : ""} como leída${count !== 1 ? "s" : ""}` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al limpiar alertas" }
  }
}

export async function updateMarketOddsAction(
  fixtureId: number,
  market: string,
  selection: string,
  odds: number
): Promise<{ ok: boolean; message: string }> {
  try {
    const rows = await db.execute({
      sql: "SELECT markets, created_at FROM match_analyses WHERE fixture_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [fixtureId],
    })
    const row = rows.rows[0] as any
    if (!row) return { ok: false, message: "Análisis no encontrado" }

    const markets = JSON.parse(row.markets || "[]") as any[]
    const updated = markets.map(m => {
      if (m.name !== market || m.selection !== selection) return m
      if (odds <= 0) return { ...m, odds: null, bookmakerProbability: null, bookmaker: null, EV: null, edge: null }
      const bmProb = 1 / odds
      const EV = m.ourProbability * odds - 1
      const edge = m.ourProbability - bmProb
      const kellyFraction = EV > 0 ? (EV / (odds - 1)) * 0.25 : 0
      return { ...m, odds, bookmakerProbability: bmProb, bookmaker: "manual", EV, edge, kellyFraction, isRecommended: EV >= 0.08 && edge >= 0.02 && odds >= 1.5 }
    })

    await db.execute({
      sql: `UPDATE match_analyses SET markets = ? WHERE fixture_id = ? AND created_at = ?`,
      args: [JSON.stringify(updated), fixtureId, row.created_at],
    })
    return { ok: true, message: `Cuota actualizada: ${market} ${selection} @${odds}` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al actualizar cuota" }
  }
}
