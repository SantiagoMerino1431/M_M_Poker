import { db } from "../src/lib/db/client"
import { migrate } from "../src/lib/db/schema"
import { seed } from "../src/lib/db/seed"
import { fetchTodayFixtures } from "../src/lib/data/api-football"
import { buildMatchData } from "../src/lib/data/pipeline"
import { analyzeMatch } from "../src/lib/engine/analyzer"
import { getBankrollState } from "../src/lib/kelly/bankroll"
import type { TeamStrength } from "../src/lib/types"

async function getTeamStrengths(): Promise<Map<number, TeamStrength>> {
  const result = await db.execute("SELECT * FROM teams")
  const map = new Map<number, TeamStrength>()
  for (const row of result.rows as any[]) {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      country: row.country,
      groupName: row.group_name,
      fifaRanking: row.fifa_ranking,
      attackStrength: row.attack_strength,
      defenseStrength: row.defense_strength,
    })
  }
  return map
}

async function upsertAnalysis(
  fixtureId: number,
  homeName: string,
  awayName: string,
  analysis: ReturnType<typeof analyzeMatch>,
  dataQuality: number,
) {
  const ts = new Date().toISOString()
  const existing = await db.execute({
    sql: "SELECT id FROM match_analyses WHERE fixture_id = ? ORDER BY created_at DESC LIMIT 1",
    args: [fixtureId],
  })

  const args = [
    analysis.isPreliminary ? 1 : 0,
    analysis.confidence,
    analysis.model.lambdaHome,
    analysis.model.lambdaAway,
    JSON.stringify(analysis.model.adjustmentsApplied),
    JSON.stringify(analysis.markets),
    JSON.stringify(analysis.alerts),
    dataQuality,
    homeName,
    awayName,
    ts,
  ]

  if (existing.rows.length > 0) {
    const id = (existing.rows[0] as any).id
    await db.execute({
      sql: `UPDATE match_analyses SET
              is_preliminary = ?, confidence = ?, lambda_home = ?, lambda_away = ?,
              adjustments_applied = ?, markets = ?, alerts = ?, data_quality = ?,
              home_team = ?, away_team = ?, created_at = ?
            WHERE id = ?`,
      args: [...args, id],
    })
    await db.execute({
      sql: "DELETE FROM match_analyses WHERE fixture_id = ? AND id != ?",
      args: [fixtureId, id],
    })
  } else {
    await db.execute({
      sql: `INSERT INTO match_analyses
              (fixture_id, is_preliminary, confidence, lambda_home, lambda_away,
               adjustments_applied, markets, alerts, data_quality, home_team, away_team, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [fixtureId, ...args],
    })
  }
}

async function run() {
  console.log("[cron] Iniciando pipeline diario...")
  await migrate()
  await seed()

  const teams = await getTeamStrengths()
  const fixtures = await fetchTodayFixtures()
  const bankroll = await getBankrollState()
  console.log(`[cron] ${fixtures.length} partidos hoy | bankroll: ${bankroll.current}`)

  let ok = 0
  const errors: string[] = []

  for (const fixture of fixtures) {
    const home = teams.get(fixture.homeTeamId)
    const away = teams.get(fixture.awayTeamId)
    if (!home || !away) {
      console.warn(`[cron] Equipos no encontrados: ${fixture.homeTeamId} vs ${fixture.awayTeamId}`)
      continue
    }

    try {
      const matchData = await buildMatchData({ ...fixture, altitudeM: 0 }, home, away)
      const analysis = analyzeMatch(matchData, bankroll.current, bankroll.trialMode)
      await upsertAnalysis(fixture.id, home.name, away.name, analysis, matchData.dataQuality)
      console.log(
        `[cron] ${home.name} vs ${away.name} — conf: ${analysis.confidence} | ` +
        `lambdas: ${analysis.model.lambdaHome.toFixed(2)}/${analysis.model.lambdaAway.toFixed(2)} | ` +
        `mercados: ${analysis.markets.filter(m => m.isRecommended).length} recomendados`
      )
      ok++
    } catch (err: any) {
      const msg = `${home.name} vs ${away.name}: ${err?.message ?? err}`
      errors.push(msg)
      console.error(`[cron] Error: ${msg}`)
    }
  }

  console.log(`[cron] Completado: ${ok}/${fixtures.length} partidos. Errores: ${errors.length}`)
  process.exit(errors.length > 0 && ok === 0 ? 1 : 0)
}

run().catch(err => { console.error(err); process.exit(1) })
