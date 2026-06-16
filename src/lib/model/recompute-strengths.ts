import { updatedStrengths, type StrengthSnapshot } from "./feedback"

interface MatchResult { homeGoals: number; awayGoals: number }

export function replayStrengths(seed: StrengthSnapshot, results: MatchResult[]): StrengthSnapshot {
  return results.reduce<StrengthSnapshot>(
    (snap, r) => {
      const u = updatedStrengths({ ...snap, homeGoals: r.homeGoals, awayGoals: r.awayGoals })
      return { homeAttack: u.homeAttack, homeDefense: u.homeDefense, awayAttack: u.awayAttack, awayDefense: u.awayDefense }
    },
    seed,
  )
}

// NOTE: recomputeAllStrengths is called from a Server Action — it runs server-side only
export async function recomputeAllStrengths(): Promise<void> {
  const { db } = await import("../db/client")

  // 1. Reset all teams to their seed values
  await db.execute(`UPDATE teams SET attack_strength = attack_seed, defense_strength = defense_seed`)

  // 2. For each team, gather all settled fixtures (ordered by date ascending) and replay
  const teamsRow = await db.execute(`SELECT id, attack_seed, defense_seed FROM teams`)

  for (const team of teamsRow.rows) {
    const teamId = team.id as number
    const attackSeed = team.attack_seed as number
    const defenseSeed = team.defense_seed as number

    // Treat each team symmetrically: homeAttack = awayAttack = attackSeed, homeDefense = awayDefense = defenseSeed
    let current: StrengthSnapshot = {
      homeAttack: attackSeed,
      homeDefense: defenseSeed,
      awayAttack: attackSeed,
      awayDefense: defenseSeed,
    }

    // Get all settled fixtures for this team, ordered chronologically
    const fixtures = await db.execute({
      sql: `SELECT f.id, f.home_team_id, f.away_team_id, f.home_score, f.away_score
            FROM fixtures f
            WHERE (f.home_team_id = ? OR f.away_team_id = ?)
              AND f.home_score IS NOT NULL AND f.away_score IS NOT NULL
            ORDER BY f.match_date ASC`,
      args: [teamId, teamId],
    })

    for (const fx of fixtures.rows) {
      const isHome = (fx.home_team_id as number) === teamId
      const homeGoals = fx.home_score as number
      const awayGoals = fx.away_score as number
      const oppId = isHome ? (fx.away_team_id as number) : (fx.home_team_id as number)

      // Use opponent's seed strengths as a deterministic proxy (avoids circular dependency between teams)
      const oppRow = await db.execute({
        sql: `SELECT attack_seed, defense_seed FROM teams WHERE id = ?`,
        args: [oppId],
      })
      const opp = oppRow.rows[0]
      if (!opp) continue

      const oppAttack = opp.attack_seed as number
      const oppDefense = opp.defense_seed as number

      const snap: StrengthSnapshot = isHome
        ? { homeAttack: current.homeAttack, homeDefense: current.homeDefense, awayAttack: oppAttack, awayDefense: oppDefense }
        : { homeAttack: oppAttack, homeDefense: oppDefense, awayAttack: current.awayAttack, awayDefense: current.awayDefense }

      const updated = updatedStrengths({
        ...snap,
        homeGoals: isHome ? homeGoals : awayGoals,
        awayGoals: isHome ? awayGoals : homeGoals,
      })

      if (isHome) {
        current = { ...current, homeAttack: updated.homeAttack, homeDefense: updated.homeDefense }
      } else {
        current = { ...current, awayAttack: updated.awayAttack, awayDefense: updated.awayDefense }
      }
    }

    // Merge home/away perspectives: take average for attack, worst-case (max) for defense
    const finalAttack = (current.homeAttack + current.awayAttack) / 2
    const finalDefense = (current.homeDefense + current.awayDefense) / 2

    await db.execute({
      sql: `UPDATE teams SET attack_strength = ?, defense_strength = ? WHERE id = ?`,
      args: [finalAttack, finalDefense, teamId],
    })
  }
}
