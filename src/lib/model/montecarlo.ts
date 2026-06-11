import { predictMatch, TeamStrengths } from "./poisson"

export interface TeamStanding {
  teamId: number
  name: string
  group: string
  points: number
  gf: number
  ga: number
}

export interface TournamentResult {
  champion: Record<number, number>
  topScorer: Record<number, number>
  groupQualified: Record<string, number[]>
}

function simulateGroup(
  teams: (TeamStrengths & { id: number; name: string; group: string })[],
  fixtures: { homeId: number; awayId: number }[]
): TeamStanding[] {
  const standings: Record<number, TeamStanding> = {}
  for (const t of teams) {
    standings[t.id] = { teamId: t.id, name: t.name, group: t.group, points: 0, gf: 0, ga: 0 }
  }

  for (const f of fixtures) {
    const home = teams.find(t => t.id === f.homeId)!
    const away = teams.find(t => t.id === f.awayId)!
    const pred = predictMatch(home, away)

    // Sample outcome from probability distribution
    const r = Math.random()
    let hg: number, ag: number
    if (r < pred.homeWin) {
      hg = Math.max(1, Math.round(pred.expectedHomeGoals))
      ag = Math.max(0, Math.round(pred.expectedAwayGoals))
      if (hg <= ag) hg = ag + 1
    } else if (r < pred.homeWin + pred.draw) {
      hg = Math.round(pred.expectedHomeGoals)
      ag = hg
    } else {
      ag = Math.max(1, Math.round(pred.expectedAwayGoals))
      hg = Math.max(0, Math.round(pred.expectedHomeGoals))
      if (ag <= hg) ag = hg + 1
    }

    standings[f.homeId].gf += hg
    standings[f.homeId].ga += ag
    standings[f.awayId].gf += ag
    standings[f.awayId].ga += hg

    if (hg > ag) standings[f.homeId].points += 3
    else if (hg === ag) { standings[f.homeId].points += 1; standings[f.awayId].points += 1 }
    else standings[f.awayId].points += 3
  }

  return Object.values(standings).sort((a, b) =>
    b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga)
  )
}

export function runMonteCarlo(
  teams: (TeamStrengths & { id: number; name: string; group: string })[],
  fixtures: { homeId: number; awayId: number; stage: string }[],
  iterations = 10000
): TournamentResult {
  const champion: Record<number, number> = {}
  const groupQualified: Record<string, Record<number, number>> = {}

  for (let i = 0; i < iterations; i++) {
    const groups = [...new Set(teams.map(t => t.group))]
    const qualifiedIds: number[] = []

    for (const g of groups) {
      const gTeams = teams.filter(t => t.group === g)
      const gFixtures = fixtures
        .filter(f => f.stage === `group_${g}`)
        .map(f => ({ homeId: f.homeId, awayId: f.awayId }))

      const standings = simulateGroup(gTeams, gFixtures)
      const top2 = standings.slice(0, 2).map(s => s.teamId)
      qualifiedIds.push(...top2)

      if (!groupQualified[g]) groupQualified[g] = {}
      for (const id of top2) {
        groupQualified[g][id] = (groupQualified[g][id] || 0) + 1
      }
    }

    // Simplified: pick champion as the team with best attack among qualified
    const qualified = teams.filter(t => qualifiedIds.includes(t.id))
    const champId = qualified.sort((a, b) => b.attackStrength - a.attackStrength)[0]?.id
    if (champId) champion[champId] = (champion[champId] || 0) + 1
  }

  // Convert counts to probabilities
  const champProbs: Record<number, number> = {}
  for (const [id, count] of Object.entries(champion)) {
    champProbs[Number(id)] = count / iterations
  }

  const qualProbs: Record<string, number[]> = {}
  for (const [g, counts] of Object.entries(groupQualified)) {
    const top = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([id]) => Number(id))
    qualProbs[g] = top
  }

  return { champion: champProbs, topScorer: {}, groupQualified: qualProbs }
}
