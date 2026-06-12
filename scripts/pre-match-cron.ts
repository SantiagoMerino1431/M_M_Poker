// Ejecutar 60 minutos antes de cada partido para datos finales
import { db } from "../src/lib/db/client"
import { fetchLineups, fetchTodayFixtures } from "../src/lib/data/api-football"
import { fetchOdds } from "../src/lib/data/odds-api"
import type { TeamStrength } from "../src/lib/types"

async function getTeamStrengths(): Promise<Map<number, TeamStrength>> {
  const result = await db.execute("SELECT * FROM teams")
  const map = new Map<number, TeamStrength>()
  for (const row of result.rows as any[]) {
    map.set(row.id, {
      id: row.id, name: row.name, country: row.country, groupName: row.group_name,
      fifaRanking: row.fifa_ranking, attackStrength: row.attack_strength,
      defenseStrength: row.defense_strength,
    })
  }
  return map
}

async function createAlert(fixtureId: number, type: string, message: string) {
  await db.execute({
    sql: `INSERT INTO alerts (fixture_id, type, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
    args: [fixtureId, type, message, new Date().toISOString()],
  })
}

async function run() {
  const fixtureId = process.env.FIXTURE_ID ? Number(process.env.FIXTURE_ID) : null
  console.log(`[pre-match] Fixture: ${fixtureId ?? "todos los de hoy en 60 min"}`)

  const teams = await getTeamStrengths()
  const fixtures = await fetchTodayFixtures()

  const now = Date.now()
  const targets = fixtureId
    ? fixtures.filter(f => f.id === fixtureId)
    : fixtures.filter(f => {
        const matchTime = new Date(f.date).getTime()
        const minutesBefore = (matchTime - now) / 60000
        return minutesBefore >= 55 && minutesBefore <= 65
      })

  for (const fixture of targets) {
    const home = teams.get(fixture.homeTeamId)
    const away = teams.get(fixture.awayTeamId)
    if (!home || !away) continue

    const lineups = await fetchLineups(fixture.id)
    if (lineups.home && lineups.away) {
      await createAlert(fixture.id, "lineup_available",
        `Alineaciones confirmadas: ${home.name} vs ${away.name}`)
      console.log(`[pre-match] Lineups confirmados para ${home.name} vs ${away.name}`)
    }

    const odds = await fetchOdds(home.name, away.name)
    if (odds.length === 0) {
      await createAlert(fixture.id, "stale_odds",
        `Sin cuotas actualizadas para ${home.name} vs ${away.name} — ingresar manualmente`)
    } else {
      // Capturar closing odds para CLV antes de que el partido empiece
      const { closingOddsForBet } = await import("../src/lib/kelly/metrics")
      const betsRows = await db.execute({
        sql: "SELECT id, market, selection FROM bets WHERE fixture_id = ? AND result IS NULL",
        args: [fixture.id],
      })
      let clvCount = 0
      for (const bet of betsRows.rows as any[]) {
        const closingOdds = closingOddsForBet(odds, bet.market, bet.selection, home.name, away.name)
        if (closingOdds !== null) {
          await db.execute({
            sql: "UPDATE bets SET odds_closing = ? WHERE id = ?",
            args: [closingOdds, bet.id],
          })
          clvCount++
        }
      }
      if (clvCount > 0) console.log(`[pre-match] CLV capturado para ${clvCount} apuesta(s) — fixture ${fixture.id}`)
    }

    await db.execute({
      sql: `UPDATE match_analyses SET is_preliminary = 0 WHERE fixture_id = ?`,
      args: [fixture.id],
    })
    console.log(`[pre-match] Análisis marcado como FINAL: fixture ${fixture.id}`)
  }

  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
