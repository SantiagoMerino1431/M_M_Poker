"use server"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/schema"
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

export async function registerBet(bet: Omit<Bet, "id">): Promise<{ ok: boolean; id?: number; message?: string }> {
  const { checkBetAllowed } = await import("@/lib/kelly/portfolio")
  const state = await getBankrollState(bet.userId)

  // Exposición real ya comprometida hoy (apuestas reales sin liquidar o de hoy).
  const today = new Date().toISOString().split("T")[0]
  const stakedRow = await db.execute({
    sql: `SELECT COALESCE(SUM(amount),0) AS s FROM bets
          WHERE mode='real' AND created_at >= ?${bet.userId != null ? " AND user_id = ?" : ""}`,
    args: bet.userId != null ? [`${today}T00:00:00Z`, bet.userId] : [`${today}T00:00:00Z`],
  })
  const todayRealStaked = Number((stakedRow.rows[0] as any).s ?? 0)

  const check = checkBetAllowed({
    mode: state.mode,
    bankroll: state.current,
    todayRealStaked,
    newAmount: bet.amount,
    betMode: bet.mode,
  })
  if (!check.allowed) return { ok: false, message: check.reason }

  const id = await saveBet({ ...bet, amount: check.adjustedAmount })
  return { ok: true, id, message: check.reason }
}

async function ensureSchema() {
  await migrate()
}

export async function getUsers() {
  await ensureSchema()
  const rows = await db.execute("SELECT * FROM users ORDER BY created_at ASC")
  return (rows.rows as any[]).map(r => ({
    id: r.id as number,
    name: r.name as string,
    initialBankroll: r.initial_bankroll as number,
    createdAt: r.created_at as string,
  }))
}

export async function createUser(name: string, initialBankroll: number): Promise<{ id: number }> {
  await ensureSchema()
  const now = new Date().toISOString()
  const result = await db.execute({
    sql: "INSERT INTO users (name, initial_bankroll, created_at) VALUES (?, ?, ?)",
    args: [name.trim(), initialBankroll, now],
  })
  const userId = Number(result.lastInsertRowid)
  // Seed initial bankroll snapshots for this user
  await db.execute({
    sql: "INSERT INTO bankroll_snapshots (balance, snapshot_type, user_id, created_at) VALUES (?, 'weekly', ?, ?)",
    args: [initialBankroll, userId, now],
  })
  await db.execute({
    sql: "INSERT INTO bankroll_snapshots (balance, snapshot_type, user_id, created_at) VALUES (?, 'daily', ?, ?)",
    args: [initialBankroll, userId, now],
  })
  return { id: userId }
}

export async function getDashboardData(userId?: number) {
  const [bankroll, bets] = await Promise.all([
    getBankrollState(userId),
    getBets({ mode: "real", userId }),
  ])
  const metrics = calcMetrics(bets)
  const alertRows = await db.execute("SELECT * FROM alerts WHERE is_read = 0 ORDER BY created_at DESC LIMIT 5")
  return { bankroll, metrics, alerts: alertRows.rows }
}

// --- Admin Actions ---

export async function runDailyCronAction(): Promise<{ ok: boolean; message: string }> {
  try {
    const { seed } = await import("@/lib/db/seed")
    const { fetchTodayFixtures } = await import("@/lib/data/api-football")
    const { buildMatchData } = await import("@/lib/data/pipeline")
    await migrate()

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
        const ts = new Date().toISOString()
        const existingRow = await db.execute({
          sql: "SELECT id FROM match_analyses WHERE fixture_id = ? ORDER BY created_at DESC LIMIT 1",
          args: [fixture.id],
        })
        if (existingRow.rows.length > 0) {
          await db.execute({
            sql: `UPDATE match_analyses SET
                    is_preliminary = ?, confidence = ?, lambda_home = ?, lambda_away = ?,
                    adjustments_applied = ?, markets = ?, alerts = ?, data_quality = ?,
                    home_team = ?, away_team = ?, created_at = ?
                  WHERE id = ?`,
            args: [
              analysis.isPreliminary ? 1 : 0, analysis.confidence,
              analysis.model.lambdaHome, analysis.model.lambdaAway,
              JSON.stringify(analysis.model.adjustmentsApplied),
              JSON.stringify(analysis.markets), JSON.stringify(analysis.alerts),
              matchData.dataQuality, fixture.homeTeamName, fixture.awayTeamName, ts,
              (existingRow.rows[0] as any).id,
            ],
          })
          await db.execute({
            sql: "DELETE FROM match_analyses WHERE fixture_id = ? AND id != ?",
            args: [fixture.id, (existingRow.rows[0] as any).id],
          })
        } else {
          await db.execute({
            sql: `INSERT INTO match_analyses
                  (fixture_id, is_preliminary, confidence, lambda_home, lambda_away,
                   adjustments_applied, markets, alerts, data_quality, home_team, away_team, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              fixture.id, analysis.isPreliminary ? 1 : 0, analysis.confidence,
              analysis.model.lambdaHome, analysis.model.lambdaAway,
              JSON.stringify(analysis.model.adjustmentsApplied),
              JSON.stringify(analysis.markets), JSON.stringify(analysis.alerts),
              matchData.dataQuality, fixture.homeTeamName, fixture.awayTeamName, ts,
            ],
          })
        }
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
    const { fetchLineups } = await import("@/lib/data/api-football")
    const { fetchESPNLineups } = await import("@/lib/data/espn")
    const { buildMatchData } = await import("@/lib/data/pipeline")
    const { analyzeMatch } = await import("@/lib/engine/analyzer")
    const { fetchOdds } = await import("@/lib/data/odds-api")
    const { appendOdds } = await import("@/lib/db/odds-history")
    const { median } = await import("@/lib/model/devig")

    // Load target fixtures from local DB (not live API)
    const fxSql = fixtureId != null
      ? `SELECT f.id, f.match_date, f.stadium, f.city, f.altitude_m, f.stage,
                f.home_team_id, f.away_team_id, h.name AS home_name, a.name AS away_name
         FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id
         WHERE f.id = ?`
      : `SELECT f.id, f.match_date, f.stadium, f.city, f.altitude_m, f.stage,
                f.home_team_id, f.away_team_id, h.name AS home_name, a.name AS away_name
         FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id
         WHERE f.match_date >= ? AND f.match_date < ?`
    const today = new Date().toISOString().split("T")[0]
    const fxArgs = fixtureId != null ? [fixtureId] : [`${today}T00:00:00Z`, `${today}T23:59:59Z`]
    const fxRows = await db.execute({ sql: fxSql, args: fxArgs })
    const targets = (fxRows.rows as any[]).map(r => ({
      id: r.id, date: r.match_date, stadium: r.stadium ?? "Unknown", city: r.city ?? "Unknown",
      altitudeM: r.altitude_m ?? 0, stage: r.stage,
      homeTeamId: r.home_team_id, awayTeamId: r.away_team_id,
      homeTeamName: r.home_name, awayTeamName: r.away_name,
    }))
    if (targets.length === 0) {
      return { ok: false, message: fixtureId ? `Fixture ${fixtureId} no existe en la DB` : "No hay partidos hoy en la DB" }
    }

    const teamsRows = await db.execute("SELECT * FROM teams")
    const teams = new Map<number, any>()
    const teamsByName = new Map<string, any>()
    for (const row of teamsRows.rows as any[]) {
      const t = {
        id: row.id, name: row.name, country: row.country, groupName: row.group_name,
        fifaRanking: row.fifa_ranking, attackStrength: row.attack_strength, defenseStrength: row.defense_strength,
      }
      teams.set(row.id, t)
      teamsByName.set(normalizeName(row.name), t)
    }
    const bankrollState = await getBankrollState()
    const ok: string[] = []
    const noLineup: string[] = []

    for (const fixture of targets) {
      const home = teams.get(fixture.homeTeamId) ?? teamsByName.get(normalizeName(fixture.homeTeamName))
      const away = teams.get(fixture.awayTeamId) ?? teamsByName.get(normalizeName(fixture.awayTeamName))
      if (!home || !away) continue

      // Lineup chain: ESPN -> API-Football -> skip (user can enter manually)
      let lineups: { home: any[] | null; away: any[] | null } = { home: null, away: null }
      let lineupSource = "none"
      try {
        const espn = await fetchESPNLineups(home.name, away.name, fixture.date?.split("T")[0])
        if (espn.home && espn.away) { lineups = espn; lineupSource = "ESPN" }
      } catch { /* ignore ESPN errors */ }

      if (!lineups.home || !lineups.away) {
        try {
          const af = await fetchLineups(fixture.id)
          if (af.home && af.away) { lineups = af; lineupSource = "API-Football" }
        } catch { /* no network or no data */ }
      }

      const matchData = await buildMatchData(
        { id: fixture.id, date: fixture.date, stadium: fixture.stadium, city: fixture.city, altitudeM: fixture.altitudeM, stage: fixture.stage, homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId },
        home, away,
      )
      const matchDataWithLineups = (lineups.home && lineups.away) ? { ...matchData, lineups } : matchData
      const analysis = analyzeMatch(matchDataWithLineups, bankrollState.current, bankrollState.trialMode)

      // Preserve any manually entered odds from a previous analysis
      const existing = await db.execute({
        sql: "SELECT markets FROM match_analyses WHERE fixture_id = ? ORDER BY created_at DESC LIMIT 1",
        args: [fixture.id],
      })
      const prevMarkets: any[] = JSON.parse((existing.rows[0] as any)?.markets ?? "[]")
      const merged = analysis.markets.map(m => {
        const prev = prevMarkets.find((e: any) => e.name === m.name && e.selection === m.selection)
        if (prev?.odds != null) {
          const EV = m.ourProbability * prev.odds - 1
          const edge = m.ourProbability - 1 / prev.odds
          return { ...m, odds: prev.odds, bookmakerProbability: 1 / prev.odds, bookmaker: prev.bookmaker, EV, edge, isRecommended: EV >= 0.08 && edge >= 0.02 && prev.odds >= 1.5 }
        }
        return m
      })

      const now = new Date().toISOString()
      const isPrelim = (lineups.home && lineups.away) ? 0 : 1

      // Upsert analysis
      const existingRow = await db.execute({ sql: "SELECT id FROM match_analyses WHERE fixture_id = ?", args: [fixture.id] })
      if ((existingRow.rows as any[]).length > 0) {
        await db.execute({
          sql: `UPDATE match_analyses SET is_preliminary = ?, confidence = ?, lambda_home = ?, lambda_away = ?,
                  adjustments_applied = ?, markets = ?, alerts = ?, data_quality = ?, home_team = ?, away_team = ?, created_at = ?
                WHERE fixture_id = ?`,
          args: [isPrelim, analysis.confidence, analysis.model.lambdaHome, analysis.model.lambdaAway,
                 JSON.stringify(analysis.model.adjustmentsApplied), JSON.stringify(merged), JSON.stringify(analysis.alerts),
                 matchDataWithLineups.dataQuality, home.name, away.name, now, fixture.id],
        })
      } else {
        await db.execute({
          sql: `INSERT INTO match_analyses (fixture_id, is_preliminary, confidence, lambda_home, lambda_away,
                  adjustments_applied, markets, alerts, data_quality, home_team, away_team, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [fixture.id, isPrelim, analysis.confidence, analysis.model.lambdaHome, analysis.model.lambdaAway,
                 JSON.stringify(analysis.model.adjustmentsApplied), JSON.stringify(merged), JSON.stringify(analysis.alerts),
                 matchDataWithLineups.dataQuality, home.name, away.name, now],
        })
      }

      // Persist market consensus odds to odds_history
      const odds = await fetchOdds(home.name, away.name)
      if (odds.length > 0) {
        const groups = new Map<string, number[]>()
        for (const o of odds) {
          const k = `${o.market}|${o.selection}`
          if (!groups.has(k)) groups.set(k, [])
          groups.get(k)!.push(o.odds)
        }
        for (const [k, prices] of groups) {
          const [m, sel] = k.split("|")
          await appendOdds(fixture.id, m, sel, median(prices), "market")
        }
      } else {
        await db.execute({
          sql: `INSERT INTO alerts (fixture_id, type, message, is_read, created_at) VALUES (?,?,?,0,?)`,
          args: [fixture.id, "stale_odds", `Sin cuotas: ${home.name} vs ${away.name}`, now],
        })
      }

      if (lineups.home && lineups.away) ok.push(`${home.name} vs ${away.name} (${lineupSource}, conf. ${analysis.confidence})`)
      else noLineup.push(`${home.name} vs ${away.name}`)
    }

    if (ok.length > 0 && noLineup.length === 0) return { ok: true, message: `Pre-match OK: ${ok.join(", ")}` }
    if (ok.length > 0) return { ok: true, message: `Pre-match parcial. Con lineup: ${ok.join(", ")}. Sin lineup (ingresar manual): ${noLineup.join(", ")}` }
    return { ok: true, message: `Sin lineups automáticos para: ${noLineup.join(", ")}. Usa "Lineup manual" en el partido.` }
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

    if (bet.mode === "real") {
      const { nextBalanceAfterSettle, updateBankroll } = await import("@/lib/kelly/bankroll")
      const state = await getBankrollState(bet.user_id ?? undefined)
      const nextBalance = nextBalanceAfterSettle(state.current, result, bet.amount, bet.odds_used)
      await updateBankroll(nextBalance, "daily", bet.user_id ?? undefined)
    }

    const label = result === "win" ? `+$${profitLoss}` : result === "loss" ? `-$${bet.amount}` : "Void"
    return { ok: true, message: `Liquidada: ${label} COP` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al liquidar" }
  }
}

export async function adjustBankrollAction(
  amount: number,
  userId?: number,
  reason?: string
): Promise<{ ok: boolean; message: string }> {
  try {
    await db.execute({
      sql: `INSERT INTO bankroll_snapshots (snapshot_type, balance, user_id, created_at) VALUES (?, ?, ?, ?)`,
      args: ["manual", amount, userId ?? null, new Date().toISOString()],
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

export async function captureClosingOddsAction(fixtureId: number): Promise<{ ok: boolean; message: string }> {
  try {
    const fixtureRow = await db.execute({
      sql: "SELECT home_team, away_team FROM match_analyses WHERE fixture_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [fixtureId],
    })
    const row = fixtureRow.rows[0] as any
    if (!row) return { ok: false, message: "Fixture no encontrado en análisis" }

    const { fetchOdds } = await import("@/lib/data/odds-api")
    const { closingOddsForBet } = await import("@/lib/kelly/metrics")

    const closing = await fetchOdds(row.home_team, row.away_team)
    if (closing.length === 0) return { ok: false, message: "Sin cuotas de cierre disponibles" }

    const betsRows = await db.execute({
      sql: "SELECT id, market, selection FROM bets WHERE fixture_id = ? AND result IS NULL",
      args: [fixtureId],
    })

    let updated = 0
    for (const bet of betsRows.rows as any[]) {
      const closingOdds = closingOddsForBet(closing, bet.market, bet.selection, row.home_team, row.away_team)
      if (closingOdds !== null) {
        await db.execute({
          sql: "UPDATE bets SET odds_closing = ? WHERE id = ?",
          args: [closingOdds, bet.id],
        })
        updated++
      }
    }

    return { ok: true, message: `CLV capturado para ${updated} apuesta${updated !== 1 ? "s" : ""} (fixture ${fixtureId})` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al capturar closing odds" }
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

export async function saveManualLineupAction(
  fixtureId: number,
  homeMissing: string[],
  awayMissing: string[],
  homeConfirmed: boolean,
  awayConfirmed: boolean,
): Promise<{ ok: boolean; message: string }> {
  try {
    await db.execute({
      sql: `INSERT INTO manual_lineups (fixture_id, home_missing, away_missing, home_confirmed, away_confirmed, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(fixture_id) DO UPDATE SET
              home_missing=excluded.home_missing, away_missing=excluded.away_missing,
              home_confirmed=excluded.home_confirmed, away_confirmed=excluded.away_confirmed,
              updated_at=excluded.updated_at`,
      args: [fixtureId, JSON.stringify(homeMissing), JSON.stringify(awayMissing),
             homeConfirmed ? 1 : 0, awayConfirmed ? 1 : 0, new Date().toISOString()],
    })
    if (homeConfirmed && awayConfirmed) {
      await db.execute({ sql: `UPDATE match_analyses SET is_preliminary = 0 WHERE fixture_id = ?`, args: [fixtureId] })
    }
    return { ok: true, message: "Lineup/lesiones guardados" }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al guardar lineup" }
  }
}

export async function getManualLineup(fixtureId: number): Promise<{ homeMissing: string[]; awayMissing: string[]; homeConfirmed: boolean; awayConfirmed: boolean } | null> {
  const rows = await db.execute({ sql: "SELECT * FROM manual_lineups WHERE fixture_id = ?", args: [fixtureId] })
  const r = rows.rows[0] as any
  if (!r) return null
  return {
    homeMissing: JSON.parse(r.home_missing || "[]"),
    awayMissing: JSON.parse(r.away_missing || "[]"),
    homeConfirmed: Boolean(r.home_confirmed),
    awayConfirmed: Boolean(r.away_confirmed),
  }
}
