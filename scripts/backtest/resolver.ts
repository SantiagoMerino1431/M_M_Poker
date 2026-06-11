export function resolveMarket(
  market: string,
  selection: string,
  homeScore: number,
  awayScore: number,
): "win" | "loss" | "void" {
  const total = homeScore + awayScore

  if (market === "1X2") {
    if (selection === "1") return homeScore > awayScore ? "win" : "loss"
    if (selection === "X") return homeScore === awayScore ? "win" : "loss"
    if (selection === "2") return awayScore > homeScore ? "win" : "loss"
  }

  if (market.startsWith("Over") && market.includes("Goals")) {
    const line = parseFloat(market.match(/([\d.]+)/)?.[1] ?? "2.5")
    if (selection === "Over")  return total > line ? "win" : "loss"
    if (selection === "Under") return total <= line ? "win" : "loss"
  }

  if (market === "BTTS") {
    const btts = homeScore > 0 && awayScore > 0
    if (selection === "Yes") return btts ? "win" : "loss"
    if (selection === "No")  return btts ? "loss" : "win"
  }

  return "void"
}
