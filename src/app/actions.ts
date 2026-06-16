"use server"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/schema"
import { getBankrollState } from "@/lib/kelly/bankroll"
import { calcMetrics, getBets, saveBet, deleteBet, updateBet } from "@/lib/kelly/tracker"
import { kellyStake } from "@/lib/kelly/sizing"
import { appendOdds } from "@/lib/db/odds-history"
import { reblendSelection } from "@/lib/engine/reblend"
import { bogotaDayRangeUtc } from "@/lib/utils/time"
import type { MatchAnalysis, Bet } from "@/lib/types"

function normalizeName(name: string): string {
  return name.toLowerCase()
    .normalize("NFD").replace(/\p{Mn}/gu, "")
    .replace(/[\s'\-.]/g, "")
}

export async function getTodayAnalyses(): Promise<MatchAnalysis[]> {
  const { startUtc, endUtc } = bogotaDayRangeUtc()
  const rows = await db.execute({
    sql: `SELECT ma.* FROM match_analyses ma
          JOIN fixtures f ON f.id = ma.fixture_id
          WHERE f.match_date >= ? AND f.match_date < ?
          ORDER BY ma.confidence DESC`,
    args: [startUtc, endUtc],
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
    sql: `SELECT f.match_date, f.stage, f.stadium, f.city, f.home_score, f.away_score, f.status,
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
    homeScore: r.home_score as number | null,
    awayScore: r.away_score as number | null,
    status: r.status as string | null,
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
    confidenceBreakdown: r.confidence_breakdown ? JSON.parse(r.confidence_breakdown as string) : null,
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

    const { analyzeMatch, confidenceBreakdown } = await import("@/lib/engine/analyzer")
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
        const breakdown = JSON.stringify(confidenceBreakdown(matchData))
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
                    home_team = ?, away_team = ?, confidence_breakdown = ?, created_at = ?
                  WHERE id = ?`,
            args: [
              analysis.isPreliminary ? 1 : 0, analysis.confidence,
              analysis.model.lambdaHome, analysis.model.lambdaAway,
              JSON.stringify(analysis.model.adjustmentsApplied),
              JSON.stringify(analysis.markets), JSON.stringify(analysis.alerts),
              matchData.dataQuality, fixture.homeTeamName, fixture.awayTeamName, breakdown, ts,
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
                   adjustments_applied, markets, alerts, data_quality, home_team, away_team, confidence_breakdown, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              fixture.id, analysis.isPreliminary ? 1 : 0, analysis.confidence,
              analysis.model.lambdaHome, analysis.model.lambdaAway,
              JSON.stringify(analysis.model.adjustmentsApplied),
              JSON.stringify(analysis.markets), JSON.stringify(analysis.alerts),
              matchData.dataQuality, fixture.homeTeamName, fixture.awayTeamName, breakdown, ts,
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
    const { fetchESPNLineups } = await import("@/lib/data/espn")
    const { buildMatchData } = await import("@/lib/data/pipeline")
    const { analyzeMatch, confidenceBreakdown } = await import("@/lib/engine/analyzer")
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
    const { startUtc, endUtc } = bogotaDayRangeUtc()
    const fxArgs = fixtureId != null ? [fixtureId] : [startUtc, endUtc]
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

      // Lineups automáticos: solo ESPN (rosters disponibles ~1h antes del pitazo).
      // API-Football se omite: los fixtures son ids de seed locales, no ids de API-Football.
      let lineups: { home: any[] | null; away: any[] | null } = { home: null, away: null }
      let lineupSource = "none"
      try {
        const espn = await fetchESPNLineups(home.name, away.name, fixture.date?.split("T")[0])
        if (espn.home && espn.away) { lineups = espn; lineupSource = "ESPN" }
      } catch { /* ESPN sin datos o sin red */ }

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
      const breakdown = JSON.stringify(confidenceBreakdown(matchDataWithLineups))

      // Upsert analysis
      const existingRow = await db.execute({ sql: "SELECT id FROM match_analyses WHERE fixture_id = ?", args: [fixture.id] })
      if ((existingRow.rows as any[]).length > 0) {
        await db.execute({
          sql: `UPDATE match_analyses SET is_preliminary = ?, confidence = ?, lambda_home = ?, lambda_away = ?,
                  adjustments_applied = ?, markets = ?, alerts = ?, data_quality = ?, home_team = ?, away_team = ?,
                  confidence_breakdown = ?, created_at = ?
                WHERE fixture_id = ?`,
          args: [isPrelim, analysis.confidence, analysis.model.lambdaHome, analysis.model.lambdaAway,
                 JSON.stringify(analysis.model.adjustmentsApplied), JSON.stringify(merged), JSON.stringify(analysis.alerts),
                 matchDataWithLineups.dataQuality, home.name, away.name, breakdown, now, fixture.id],
        })
      } else {
        await db.execute({
          sql: `INSERT INTO match_analyses (fixture_id, is_preliminary, confidence, lambda_home, lambda_away,
                  adjustments_applied, markets, alerts, data_quality, home_team, away_team, confidence_breakdown, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [fixture.id, isPrelim, analysis.confidence, analysis.model.lambdaHome, analysis.model.lambdaAway,
                 JSON.stringify(analysis.model.adjustmentsApplied), JSON.stringify(merged), JSON.stringify(analysis.alerts),
                 matchDataWithLineups.dataQuality, home.name, away.name, breakdown, now],
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

    if (ok.length > 0 && noLineup.length === 0) return { ok: true, message: `Pre-match OK con alineaciones: ${ok.join(", ")}` }
    if (ok.length > 0) return { ok: true, message: `Análisis actualizado. Con alineaciones (ESPN): ${ok.join(", ")}. Sin alineaciones todavía (llegan ~1h antes; usa "Lineup manual"): ${noLineup.join(", ")}` }
    return { ok: true, message: `Análisis preliminar actualizado. Las alineaciones de ESPN aparecen ~1h antes del partido. Por ahora usa "Lineup manual" en cada partido para confirmar bajas: ${noLineup.join(", ")}` }
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

export async function captureClosingOddsAction(fixtureId: number): Promise<{ ok: boolean; message: string; captured: number }> {
  try {
    // Get current analysis to read market odds
    const analysis = await getAnalysisForFixture(fixtureId)
    if (!analysis) return { ok: false, message: "Sin análisis para este partido.", captured: 0 }

    let captured = 0

    // Save each market selection's current odds to history as "closing"
    for (const market of analysis.markets) {
      if (market.odds != null && market.odds > 1) {
        await appendOdds(fixtureId, market.name, market.selection, market.odds, "closing")
        captured++
      }
    }

    // Update open bets with closing odds where market+selection matches
    const openBets = (await getBets({})).filter(
      b => b.fixtureId === fixtureId && b.result === null && b.oddsClosing == null
    )
    for (const bet of openBets) {
      const match = analysis.markets.find(
        m => m.name === bet.market && m.selection === bet.selection && m.odds != null && m.odds > 1
      )
      if (match && match.odds != null) {
        await updateBet(bet.id!, { oddsClosing: match.odds })
      }
    }

    return { ok: true, message: `Cuotas de cierre capturadas (${captured} mercados).`, captured }
  } catch (e) {
    return { ok: false, message: `Error: ${e instanceof Error ? e.message : String(e)}`, captured: 0 }
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
      sql: "SELECT markets, created_at, confidence FROM match_analyses WHERE fixture_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [fixtureId],
    })
    const row = rows.rows[0] as any
    if (!row) return { ok: false, message: "Análisis no encontrado" }
    const matchConfidence = Number(row.confidence ?? 0)

    const markets = JSON.parse(row.markets || "[]") as any[]
    const updated = markets.map(m => {
      if (m.name !== market || m.selection !== selection) return m
      if (odds <= 0) return { ...m, odds: null, bookmakerProbability: null, bookmaker: null, EV: null, edge: null }
      // Find opposite side for symmetric markets (Over/Under, BTTS) to de-vig properly
      const opposite = markets.find((x: any) =>
        x.name === market && x.selection !== selection && x.odds != null &&
        (market === "Over/Under" || market === "BTTS")
      )
      const { marketProbability, ourProbability } = reblendSelection(
        m.modelProbability ?? m.ourProbability,
        odds,
        opposite?.odds ?? null,
      )
      const EV = ourProbability * odds - 1
      const edge = ourProbability - marketProbability
      const kellyFraction = kellyStake({ probability: ourProbability, odds, bankroll: 1, confidence: matchConfidence }).fraction
      const recommended = EV >= 0.08 && edge >= 0.02 && odds >= 1.5 && matchConfidence >= 40
      return { ...m, odds, bookmakerProbability: marketProbability, bookmaker: "manual", ourProbability, EV, edge, kellyFraction, isRecommended: recommended }
    })

    await db.execute({
      sql: `UPDATE match_analyses SET markets = ? WHERE fixture_id = ? AND created_at = ?`,
      args: [JSON.stringify(updated), fixtureId, row.created_at],
    })

    if (odds > 0) {
      await appendOdds(fixtureId, market, selection, odds, "manual")
    }

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
    await ensureSchema()
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

    // Re-analyze with missing players as "out" injuries
    const { buildMatchData } = await import("@/lib/data/pipeline")
    const { analyzeMatch, confidenceBreakdown } = await import("@/lib/engine/analyzer")
    const fxRows = await db.execute({
      sql: `SELECT f.id, f.match_date, f.stadium, f.city, f.altitude_m, f.stage,
                   f.home_team_id, f.away_team_id, h.name AS home_name, a.name AS away_name
            FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id
            WHERE f.id = ?`, args: [fixtureId],
    })
    const r = fxRows.rows[0] as any
    if (!r) return { ok: true, message: "Lineup guardado (sin fixture para re-analizar)" }

    const tRows = await db.execute({ sql: "SELECT * FROM teams WHERE id IN (?, ?)", args: [r.home_team_id, r.away_team_id] })
    const tById = new Map((tRows.rows as any[]).map(t => [t.id, {
      id: t.id, name: t.name, country: t.country, groupName: t.group_name,
      fifaRanking: t.fifa_ranking, attackStrength: t.attack_strength, defenseStrength: t.defense_strength,
    }]))
    const home = tById.get(r.home_team_id)
    const away = tById.get(r.away_team_id)
    if (!home || !away) return { ok: true, message: "Lineup guardado" }

    const fixture = {
      id: r.id, date: r.match_date, stadium: r.stadium ?? "", city: r.city ?? "",
      altitudeM: r.altitude_m ?? 0, stage: r.stage,
      homeTeamId: r.home_team_id, awayTeamId: r.away_team_id,
    }
    const matchData = await buildMatchData(fixture as any, home as any, away as any)

    // Inject manual absences as "out" injuries and set lineupConfirmed
    const mkInj = (names: string[]) => names.map((n, i) => ({
      playerId: -(i + 1), playerName: n, position: "Unknown", reason: "Manual", status: "out" as const,
    }))
    const withManual = {
      ...matchData,
      injuries: {
        home: [...matchData.injuries.home, ...mkInj(homeMissing)],
        away: [...matchData.injuries.away, ...mkInj(awayMissing)],
      },
      lineupConfirmed: homeConfirmed && awayConfirmed,
    }

    const { getBankrollState } = await import("@/lib/kelly/bankroll")
    const bankroll = await getBankrollState()
    const analysis = analyzeMatch(withManual, bankroll.current, bankroll.trialMode)

    // Preserve previously entered manual odds
    const existing = await db.execute({
      sql: "SELECT markets FROM match_analyses WHERE fixture_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [fixtureId],
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
    const isPrelim = homeConfirmed && awayConfirmed ? 0 : 1
    const breakdown = JSON.stringify(confidenceBreakdown(withManual))
    const existingRow = await db.execute({ sql: "SELECT id FROM match_analyses WHERE fixture_id = ?", args: [fixtureId] })
    if ((existingRow.rows as any[]).length > 0) {
      await db.execute({
        sql: `UPDATE match_analyses SET is_preliminary = ?, confidence = ?, lambda_home = ?, lambda_away = ?,
                adjustments_applied = ?, markets = ?, alerts = ?, data_quality = ?,
                confidence_breakdown = ?, created_at = ? WHERE fixture_id = ?`,
        args: [isPrelim, analysis.confidence, analysis.model.lambdaHome, analysis.model.lambdaAway,
               JSON.stringify(analysis.model.adjustmentsApplied), JSON.stringify(merged),
               JSON.stringify(analysis.alerts), withManual.dataQuality, breakdown, now, fixtureId],
      })
    } else {
      await db.execute({
        sql: `INSERT INTO match_analyses (fixture_id, is_preliminary, confidence, lambda_home, lambda_away,
                adjustments_applied, markets, alerts, data_quality, home_team, away_team, confidence_breakdown, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [fixtureId, isPrelim, analysis.confidence, analysis.model.lambdaHome, analysis.model.lambdaAway,
               JSON.stringify(analysis.model.adjustmentsApplied), JSON.stringify(merged),
               JSON.stringify(analysis.alerts), withManual.dataQuality, home.name, away.name, breakdown, now],
      })
    }
    return { ok: true, message: `Lineup aplicado · confianza ${analysis.confidence} · λ ${analysis.model.lambdaHome.toFixed(2)}/${analysis.model.lambdaAway.toFixed(2)}` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al guardar lineup" }
  }
}

export async function getManualLineup(fixtureId: number): Promise<{ homeMissing: string[]; awayMissing: string[]; homeConfirmed: boolean; awayConfirmed: boolean } | null> {
  await ensureSchema()
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

export async function deleteBetAction(betId: number): Promise<{ ok: boolean; message: string }> {
  try {
    const rows = await db.execute({ sql: "SELECT * FROM bets WHERE id = ?", args: [betId] })
    const bet = rows.rows[0] as any
    if (!bet) return { ok: false, message: "Apuesta no encontrada" }
    // Revert bankroll effect if real settled bet
    if (bet.mode === "real" && bet.result && bet.result !== "void") {
      const { updateBankroll } = await import("@/lib/kelly/bankroll")
      const state = await getBankrollState(bet.user_id ?? undefined)
      const reverted = bet.result === "win"
        ? state.current - Math.round(bet.amount * (bet.odds_used - 1))
        : state.current + bet.amount
      await updateBankroll(reverted, "daily", bet.user_id ?? undefined)
    }
    await deleteBet(betId)
    return { ok: true, message: "Apuesta eliminada" }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al eliminar" }
  }
}

export async function getOpenBetsToday(): Promise<import("@/lib/types").Bet[]> {
  const today = new Date().toISOString().split("T")[0]
  const { getBets } = await import("@/lib/kelly/tracker")
  const all = await getBets({})
  return all.filter(b => b.result === null && b.createdAt >= `${today}T00:00:00Z`)
}

export async function updateBetAction(
  betId: number,
  patch: { amount?: number; oddsUsed?: number },
): Promise<{ ok: boolean; message: string }> {
  try {
    if (patch.amount != null && patch.amount <= 0) return { ok: false, message: "Monto inválido" }
    if (patch.oddsUsed != null && patch.oddsUsed <= 1) return { ok: false, message: "Cuota inválida" }
    await updateBet(betId, patch)
    return { ok: true, message: "Apuesta actualizada" }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al actualizar" }
  }
}

export async function getLiveStatusAction(fixtureId: number): Promise<{
  status: string
  homeScore: number | null
  awayScore: number | null
  elapsed: number | null
}> {
  const row = await db.execute({
    sql: `SELECT status, home_score, away_score FROM fixtures WHERE id = ?`,
    args: [fixtureId],
  })
  const r = row.rows[0]
  if (!r) return { status: "NS", homeScore: null, awayScore: null, elapsed: null }
  return {
    status: (r.status as string) ?? "NS",
    homeScore: r.home_score != null ? Number(r.home_score) : null,
    awayScore: r.away_score != null ? Number(r.away_score) : null,
    elapsed: null,
  }
}

export async function resetLearnedStrengthsAction(): Promise<{ ok: boolean; message: string }> {
  try {
    const { recomputeAllStrengths } = await import("@/lib/model/recompute-strengths")
    await recomputeAllStrengths()
    return { ok: true, message: "Fuerzas reiniciadas desde semillas y recalculadas con historial." }
  } catch (e) {
    return { ok: false, message: `Error: ${e instanceof Error ? e.message : String(e)}` }
  }
}

export async function recordResultAction(
  fixtureId: number, homeScore: number, awayScore: number, autoSettle = true
): Promise<{ ok: boolean; message: string; settled: number }> {
  try {
    // Save score to fixtures table
    await db.execute({
      sql: `UPDATE fixtures SET home_score = ?, away_score = ?, status = 'FT' WHERE id = ?`,
      args: [homeScore, awayScore, fixtureId],
    })

    let settled = 0
    if (autoSettle) {
      const { betResultForScore } = await import("@/lib/engine/settle")
      const { nextBalanceAfterSettle, updateBankroll } = await import("@/lib/kelly/bankroll")

      const openRows = await db.execute({
        sql: `SELECT * FROM bets WHERE fixture_id = ? AND result IS NULL`,
        args: [fixtureId],
      })

      for (const row of openRows.rows as any[]) {
        const result = betResultForScore(row.market, row.selection, homeScore, awayScore)
        if (!result) continue

        const profitLoss = result === "win"
          ? Math.round(row.amount * (row.odds_used - 1))
          : result === "loss"
          ? -row.amount
          : 0

        await db.execute({
          sql: `UPDATE bets SET result = ?, profit_loss = ?, settled_at = ? WHERE id = ?`,
          args: [result, profitLoss, new Date().toISOString(), row.id],
        })

        if (row.mode === "real") {
          const state = await getBankrollState(row.user_id ?? undefined)
          const settleResult: "win" | "loss" | "void" = result === "draw" ? "void" : result
          const nextBalance = nextBalanceAfterSettle(state.current, settleResult, row.amount, row.odds_used)
          await updateBankroll(nextBalance, "daily", row.user_id ?? undefined)
        }
        settled++
      }
    }

    // Trigger strength recomputation
    const { recomputeAllStrengths } = await import("@/lib/model/recompute-strengths")
    await recomputeAllStrengths()

    return { ok: true, message: `Resultado guardado. ${settled} apuesta(s) liquidada(s).`, settled }
  } catch (e) {
    return { ok: false, message: `Error: ${e instanceof Error ? e.message : String(e)}`, settled: 0 }
  }
}
