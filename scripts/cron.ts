import { db } from "../src/lib/db/client"
import { migrate } from "../src/lib/db/schema"
import { seed } from "../src/lib/db/seed"
import { fetchTodayFixtures } from "../src/lib/data/api-football"
import { buildMatchData } from "../src/lib/data/pipeline"
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

async function saveAnalysisStub(fixtureId: number, dataQuality: number) {
  await db.execute({
    sql: `INSERT OR REPLACE INTO match_analyses
          (fixture_id, is_preliminary, confidence, lambda_home, lambda_away,
           adjustments_applied, markets, alerts, data_quality, created_at)
          VALUES (?, 1, ?, 0, 0, '[]', '[]', '[]', ?, ?)`,
    args: [fixtureId, dataQuality, dataQuality, new Date().toISOString()],
  })
}

async function run() {
  console.log("[cron] Iniciando pipeline diario...")
  await migrate()
  await seed()

  const teams = await getTeamStrengths()
  const fixtures = await fetchTodayFixtures()
  console.log(`[cron] ${fixtures.length} partidos hoy`)

  for (const fixture of fixtures) {
    const home = teams.get(fixture.homeTeamId)
    const away = teams.get(fixture.awayTeamId)
    if (!home || !away) {
      console.warn(`[cron] Equipos no encontrados: ${fixture.homeTeamId} vs ${fixture.awayTeamId}`)
      continue
    }

    try {
      const matchData = await buildMatchData(fixture, home, away)
      await saveAnalysisStub(fixture.id, matchData.dataQuality)
      console.log(`[cron] ${home.name} vs ${away.name} — dataQuality: ${matchData.dataQuality}`)
    } catch (err) {
      console.error(`[cron] Error en fixture ${fixture.id}:`, err)
    }
  }

  console.log("[cron] Pipeline diario completado")
  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
