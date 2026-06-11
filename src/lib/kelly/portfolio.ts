const HIGH_CORRELATION_PAIRS = new Set([
  "result:result",
  "exact_score:result",
  "btts:goals_ou_2.5",
])

export function detectCorrelation(
  groupA: string,
  groupB: string,
  _fixtureId: number
): "high" | "low" {
  const pair = [groupA, groupB].sort().join(":")
  return HIGH_CORRELATION_PAIRS.has(pair) ? "high" : "low"
}

export function applyDailyLimit(
  bets: { amount: number; kellyFraction: number }[],
  bankroll: number
): { amount: number; kellyFraction: number }[] {
  const MAX_EXPOSURE = 0.15
  const totalAmount = bets.reduce((s, b) => s + b.amount, 0)
  const maxAllowed = bankroll * MAX_EXPOSURE

  if (totalAmount <= maxAllowed) return bets

  const scale = maxAllowed / totalAmount
  return bets.map(b => ({
    ...b,
    amount: Math.round(b.amount * scale * 100) / 100,
    kellyFraction: b.kellyFraction * scale,
  }))
}
