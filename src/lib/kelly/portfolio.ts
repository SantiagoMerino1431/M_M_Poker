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

export interface BetCheckInput {
  mode: "normal" | "conservative" | "paused"
  bankroll: number
  todayRealStaked: number
  newAmount: number
  betMode: "real" | "paper"
}

export interface BetCheckResult {
  allowed: boolean
  adjustedAmount: number
  reason?: string
}

const MAX_DAILY_EXPOSURE = 0.15

export function checkBetAllowed(input: BetCheckInput): BetCheckResult {
  const { mode, bankroll, todayRealStaked, newAmount, betMode } = input

  // Paper no consume bankroll ni riesgo real.
  if (betMode === "paper") return { allowed: true, adjustedAmount: newAmount }

  if (mode === "paused") {
    return { allowed: false, adjustedAmount: 0, reason: "Sistema en pausa por 5 pérdidas consecutivas" }
  }

  const maxAllowed = bankroll * MAX_DAILY_EXPOSURE
  const remaining = Math.max(0, maxAllowed - todayRealStaked)
  if (remaining <= 0) {
    return { allowed: false, adjustedAmount: 0, reason: "Límite de exposición diaria (15%) alcanzado" }
  }
  if (newAmount > remaining) {
    return { allowed: true, adjustedAmount: Math.round(remaining), reason: "Monto recortado al límite de exposición diaria" }
  }
  return { allowed: true, adjustedAmount: newAmount }
}
