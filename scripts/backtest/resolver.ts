export function resolveMarket(
  market: string,
  selection: string,
  homeScore: number,
  awayScore: number,
): "win" | "loss" | "void" {
  const total = homeScore + awayScore
  const sel = selection.toLowerCase()

  if (market === "1X2") {
    if (sel === "home") return homeScore > awayScore ? "win" : "loss"
    if (sel === "draw") return homeScore === awayScore ? "win" : "loss"
    if (sel === "away") return awayScore > homeScore ? "win" : "loss"
  }

  if (market === "Over/Under") {
    const m = sel.match(/^(over|under)_([\d.]+)$/)
    if (!m) return "void"
    const line = parseFloat(m[2])
    if (m[1] === "over")  return total > line ? "win" : "loss"
    if (m[1] === "under") return total <= line ? "win" : "loss"
  }

  if (market === "BTTS") {
    const btts = homeScore > 0 && awayScore > 0
    if (sel === "yes") return btts ? "win" : "loss"
    if (sel === "no")  return btts ? "loss" : "win"
  }

  return "void"
}
