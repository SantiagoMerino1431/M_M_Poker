import { db } from "../src/lib/db/client"
import { migrate } from "../src/lib/db/schema"
import { seed } from "../src/lib/db/seed"
import { predictMatch } from "../src/lib/model/poisson"
import { predictCards } from "../src/lib/model/cards"
import { predictCorners } from "../src/lib/model/corners"

async function getTeams() {
  const result = await db.execute("SELECT * FROM teams")
  return result.rows as unknown as {
    id: number; name: string; attack_strength: number
    defense_strength: number; fifa_ranking: number
  }[]
}

async function getFixtures() {
  const result = await db.execute(
    "SELECT * FROM fixtures WHERE status = 'scheduled' OR status = 'live'"
  )
  return result.rows as unknown as {
    id: number; home_team_id: number; away_team_id: number; stage: string
  }[]
}

async function savePrediction(fixtureId: number, pred: ReturnType<typeof predictMatch>) {
  const now = new Date().toISOString()
  await db.execute({
    sql: `INSERT OR REPLACE INTO predictions
          (fixture_id, created_at, home_win, draw, away_win,
           over_15, over_25, over_35, btts,
           expected_home_goals, expected_away_goals,
           exact_scores, corners_over, cards_over,
           clean_sheet_home, clean_sheet_away)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      fixtureId, now,
      pred.homeWin, pred.draw, pred.awayWin,
      pred.over15, pred.over25, pred.over35, pred.btts,
      pred.expectedHomeGoals, pred.expectedAwayGoals,
      JSON.stringify(pred.exactScores),
      0.45, 0.4,
      pred.cleanSheetHome, pred.cleanSheetAway,
    ],
  })
}

async function run() {
  console.log("Iniciando cron de predicciones...")
  await migrate()
  await seed()

  const teams = await getTeams()
  const fixtures = await getFixtures()
  const teamMap = new Map(teams.map(t => [t.id, t]))

  let processed = 0
  for (const f of fixtures) {
    const home = teamMap.get(f.home_team_id)
    const away = teamMap.get(f.away_team_id)
    if (!home || !away) continue

    const pred = predictMatch(
      { attackStrength: home.attack_strength, defenseStrength: home.defense_strength, fifaRanking: home.fifa_ranking },
      { attackStrength: away.attack_strength, defenseStrength: away.defense_strength, fifaRanking: away.fifa_ranking }
    )
    await savePrediction(f.id, pred)
    processed++
  }

  console.log(`Cron completado: ${processed} predicciones generadas`)
  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
