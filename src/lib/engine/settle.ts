export type BetResult = "win" | "loss" | "draw"

export function betResultForScore(
  market: string, selection: string, homeGoals: number, awayGoals: number
): BetResult | null {
  const total = homeGoals + awayGoals

  if (market === "1X2") {
    if (homeGoals > awayGoals) return selection === "home" ? "win" : "loss"
    if (awayGoals > homeGoals) return selection === "away" ? "win" : "loss"
    return selection === "draw" ? "win" : "loss"
  }

  if (market === "Over/Under") {
    const m = selection.match(/^(over|under)_([\d._]+)$/)
    if (!m) return null
    const line = parseFloat(m[2].replace("_", "."))
    const over = total > line
    return (m[1] === "over") === over ? "win" : "loss"
  }

  if (market === "BTTS") {
    const both = homeGoals > 0 && awayGoals > 0
    return (selection === "yes") === both ? "win" : "loss"
  }

  if (market === "Marcador Exacto") {
    const [h, a] = selection.split("-").map(Number)
    return h === homeGoals && a === awayGoals ? "win" : "loss"
  }

  if (market === "Doble Oportunidad") {
    const homeWins = homeGoals > awayGoals
    const awayWins = awayGoals > homeGoals
    const isDraw = homeGoals === awayGoals
    if (selection === "1X") return homeWins || isDraw ? "win" : "loss"
    if (selection === "X2") return awayWins || isDraw ? "win" : "loss"
    if (selection === "12") return homeWins || awayWins ? "win" : "loss"
    return null
  }

  return null
}
