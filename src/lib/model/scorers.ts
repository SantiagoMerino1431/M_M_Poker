export interface PlayerScorerOdds {
  playerId: number
  name: string
  firstGoalProb: number
  anytimeProb: number
}

export function predictScorers(
  players: { id: number; name: string; goals_per_90: number }[],
  teamLambda: number
): PlayerScorerOdds[] {
  const totalRate = players.reduce((s, p) => s + p.goals_per_90, 0) || 1
  const normalized = players.map(p => ({
    ...p,
    share: p.goals_per_90 / totalRate,
  }))

  return normalized.map(p => {
    const playerLambda = teamLambda * p.share
    // P(anytime scorer) = 1 - P(0 goals) = 1 - e^-lambda
    const anytimeProb = 1 - Math.exp(-playerLambda)
    // P(first goal scorer) approximated as share of team goals
    const firstGoalProb = p.share * (1 - Math.exp(-teamLambda))
    return {
      playerId: p.id,
      name: p.name,
      firstGoalProb,
      anytimeProb,
    }
  }).sort((a, b) => b.anytimeProb - a.anytimeProb)
}
