import type { MatchData, MarketResult, MarketOdds } from "../types"

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

function isStale(updatedAt: string): boolean {
  return Date.now() - new Date(updatedAt).getTime() > FOUR_HOURS_MS
}

function bestOdds(odds: MarketOdds[], market: string, selection: string): MarketOdds | null {
  const candidates = odds.filter(o =>
    o.market === market &&
    o.selection.toLowerCase().replace(/[^a-z0-9]/g, "") ===
    selection.toLowerCase().replace(/[^a-z0-9]/g, "")
  )
  if (!candidates.length) return null
  return candidates.reduce((b, c) => c.odds > b.odds ? c : b)
}

function matrixSum(matrix: number[][], pred: (h: number, a: number) => boolean): number {
  let sum = 0
  for (let h = 0; h < matrix.length; h++)
    for (let a = 0; a < matrix[h].length; a++)
      if (pred(h, a)) sum += matrix[h][a]
  return sum
}

function calcBookmakerProb(odds: number): number {
  return 1 / odds
}

function makeMarket(
  name: string,
  selection: string,
  ourProbability: number,
  correlationGroup: string,
  odds: MarketOdds | null,
): MarketResult {
  const stale = odds ? isStale(odds.updatedAt) : false
  const bmProb = odds && !stale ? calcBookmakerProb(odds.odds) : null
  const EV = odds && !stale ? ourProbability * odds.odds - 1 : null
  const edge = bmProb !== null ? ourProbability - bmProb : null

  return {
    name,
    selection,
    ourProbability,
    bookmakerProbability: bmProb,
    odds: odds?.odds ?? null,
    bookmaker: odds?.bookmaker ?? null,
    EV,
    edge,
    kellyFraction: null,
    kellyAmount: null,
    correlationGroup,
    isRecommended: EV !== null && EV >= 0.03 && (edge ?? 0) >= 0.02 && (odds?.odds ?? 0) >= 1.5,
    oddsStale: stale,
  }
}

export function calcAllMarkets(matrix: number[][], data: MatchData): MarketResult[] {
  const { odds } = data
  const results: MarketResult[] = []

  const homeWin = matrixSum(matrix, (h, a) => h > a)
  const draw    = matrixSum(matrix, (h, a) => h === a)
  const awayWin = matrixSum(matrix, (h, a) => h < a)

  const homeOdds = bestOdds(odds, "h2h", data.teams.home.name)
  const drawOdds = bestOdds(odds, "h2h", "Draw")
  const awayOdds = bestOdds(odds, "h2h", data.teams.away.name)

  results.push(makeMarket("1X2", "home", homeWin, "result", homeOdds))
  results.push(makeMarket("1X2", "draw", draw, "result", drawOdds))
  results.push(makeMarket("1X2", "away", awayWin, "result", awayOdds))

  results.push(makeMarket("Doble Oportunidad", "1X", homeWin + draw, "double_chance", null))
  results.push(makeMarket("Doble Oportunidad", "X2", draw + awayWin, "double_chance", null))
  results.push(makeMarket("Doble Oportunidad", "12", homeWin + awayWin, "double_chance", null))

  for (const threshold of [1.5, 2.5, 3.5, 4.5]) {
    const label = `${threshold}`
    const over = matrixSum(matrix, (h, a) => h + a > threshold)
    const under = 1 - over
    const overOdds = bestOdds(odds, "totals", `Over ${label}`)
    const underOdds = bestOdds(odds, "totals", `Under ${label}`)
    results.push(makeMarket("Over/Under", `over_${label}`, over, `goals_ou_${label}`, overOdds))
    results.push(makeMarket("Over/Under", `under_${label}`, under, `goals_ou_${label}`, underOdds))
  }

  const btts = matrixSum(matrix, (h, a) => h > 0 && a > 0)
  const bttsOdds = bestOdds(odds, "btts", "Yes")
  results.push(makeMarket("BTTS", "yes", btts, "btts", bttsOdds))
  results.push(makeMarket("BTTS", "no", 1 - btts, "btts", bestOdds(odds, "btts", "No")))

  for (let h = 0; h <= 4; h++) {
    for (let a = 0; a <= 4; a++) {
      const prob = matrix[h]?.[a] ?? 0
      if (prob >= 0.04) {
        results.push(makeMarket("Marcador Exacto", `${h}-${a}`, prob, "exact_score", null))
      }
    }
  }

  return results
}
