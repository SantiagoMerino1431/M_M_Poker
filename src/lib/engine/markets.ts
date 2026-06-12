import type { MatchData, MarketResult, MarketOdds } from "../types"
import { devig, median } from "../model/devig"
import { blendProbability } from "../model/blend"
import { matchesTeam } from "../data/team-names"

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

function isStale(updatedAt: string): boolean {
  if (!updatedAt) return false
  return Date.now() - new Date(updatedAt).getTime() > FOUR_HOURS_MS
}

function matrixSum(matrix: number[][], pred: (h: number, a: number) => boolean): number {
  let sum = 0
  for (let h = 0; h < matrix.length; h++)
    for (let a = 0; a < matrix[h].length; a++)
      if (pred(h, a)) sum += matrix[h][a]
  return sum
}

// Mejor cuota (para ejecución) entre todos los bookmakers de una selección.
function bestOdds(odds: MarketOdds[], market: string, selectionMatch: (s: string) => boolean): MarketOdds | null {
  const candidates = odds.filter(o => o.market === market && selectionMatch(o.selection))
  if (!candidates.length) return null
  return candidates.reduce((b, c) => (c.odds > b.odds ? c : b))
}

function medianFor(odds: MarketOdds[], market: string, selMatch: (s: string) => boolean): number | null {
  const prices = odds.filter(o => o.market === market && selMatch(o.selection)).map(o => o.odds)
  return prices.length ? median(prices) : null
}

interface MakeMarketArgs {
  name: string
  selection: string
  modelProbability: number
  marketProbability: number | null
  correlationGroup: string
  odds: MarketOdds | null
}

function makeMarket(args: MakeMarketArgs): MarketResult {
  const { name, selection, modelProbability, marketProbability, correlationGroup, odds } = args
  const stale = odds ? isStale(odds.updatedAt) : false
  const ourProbability = blendProbability(modelProbability, marketProbability)
  const bmProb = odds && !stale ? 1 / odds.odds : null
  const EV = odds && !stale ? ourProbability * odds.odds - 1 : null
  const edge = marketProbability !== null ? ourProbability - marketProbability : null

  return {
    name,
    selection,
    ourProbability,
    modelProbability,
    marketProbability,
    bookmakerProbability: bmProb,
    odds: odds?.odds ?? null,
    bookmaker: odds?.bookmaker ?? null,
    EV,
    edge,
    kellyFraction: null,
    kellyAmount: null,
    correlationGroup,
    isRecommended: EV !== null && EV >= 0.08 && (edge ?? 0) >= 0.02 && (odds?.odds ?? 0) >= 1.5 && !stale,
    oddsStale: stale,
  }
}

export function calcAllMarkets(matrix: number[][], data: MatchData): MarketResult[] {
  const { odds } = data
  const results: MarketResult[] = []
  const homeName = data.teams.home.name
  const awayName = data.teams.away.name

  // --- 1X2 ---
  const homeWin = matrixSum(matrix, (h, a) => h > a)
  const draw    = matrixSum(matrix, (h, a) => h === a)
  const awayWin = matrixSum(matrix, (h, a) => h < a)

  const homeMatch = (s: string) => matchesTeam(s, homeName)
  const awayMatch = (s: string) => matchesTeam(s, awayName)
  const drawMatch = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "") === "draw"

  // Consenso de-viggeado 1X2 (mediana por vía, normalizado a suma 1).
  const homeMed = medianFor(odds, "h2h", homeMatch)
  const drawMed = medianFor(odds, "h2h", drawMatch)
  const awayMed = medianFor(odds, "h2h", awayMatch)
  let mHome: number | null = null, mDraw: number | null = null, mAway: number | null = null
  if (homeMed && drawMed && awayMed) {
    const [ph, pd, pa] = devig([homeMed, drawMed, awayMed])
    mHome = ph; mDraw = pd; mAway = pa
  }

  results.push(makeMarket({ name: "1X2", selection: "home", modelProbability: homeWin, marketProbability: mHome, correlationGroup: "result", odds: bestOdds(odds, "h2h", homeMatch) }))
  results.push(makeMarket({ name: "1X2", selection: "draw", modelProbability: draw,    marketProbability: mDraw, correlationGroup: "result", odds: bestOdds(odds, "h2h", drawMatch) }))
  results.push(makeMarket({ name: "1X2", selection: "away", modelProbability: awayWin, marketProbability: mAway, correlationGroup: "result", odds: bestOdds(odds, "h2h", awayMatch) }))

  // --- Doble oportunidad (sin cuota de mercado; solo modelo) ---
  results.push(makeMarket({ name: "Doble Oportunidad", selection: "1X", modelProbability: homeWin + draw, marketProbability: null, correlationGroup: "double_chance", odds: null }))
  results.push(makeMarket({ name: "Doble Oportunidad", selection: "X2", modelProbability: draw + awayWin, marketProbability: null, correlationGroup: "double_chance", odds: null }))
  results.push(makeMarket({ name: "Doble Oportunidad", selection: "12", modelProbability: homeWin + awayWin, marketProbability: null, correlationGroup: "double_chance", odds: null }))

  // --- Over/Under ---
  for (const threshold of [1.5, 2.5, 3.5, 4.5]) {
    const label = `${threshold}`
    const over = matrixSum(matrix, (h, a) => h + a > threshold)
    const under = 1 - over
    const overMatch = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]/g, "") === `over${label}`
    const underMatch = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]/g, "") === `under${label}`
    const overMed = medianFor(odds, "totals", overMatch)
    const underMed = medianFor(odds, "totals", underMatch)
    let mOver: number | null = null, mUnder: number | null = null
    if (overMed && underMed) {
      const [po, pu] = devig([overMed, underMed])
      mOver = po; mUnder = pu
    }
    results.push(makeMarket({ name: "Over/Under", selection: `over_${label}`, modelProbability: over, marketProbability: mOver, correlationGroup: `goals_ou_${label}`, odds: bestOdds(odds, "totals", overMatch) }))
    results.push(makeMarket({ name: "Over/Under", selection: `under_${label}`, modelProbability: under, marketProbability: mUnder, correlationGroup: `goals_ou_${label}`, odds: bestOdds(odds, "totals", underMatch) }))
  }

  // --- BTTS (cuota solo si viene del endpoint por-evento) ---
  const btts = matrixSum(matrix, (h, a) => h > 0 && a > 0)
  const bttsYesMatch = (s: string) => s.toLowerCase() === "yes"
  const bttsNoMatch = (s: string) => s.toLowerCase() === "no"
  const yesMed = medianFor(odds, "btts", bttsYesMatch)
  const noMed = medianFor(odds, "btts", bttsNoMatch)
  let mYes: number | null = null, mNo: number | null = null
  if (yesMed && noMed) { const [py, pn] = devig([yesMed, noMed]); mYes = py; mNo = pn }
  results.push(makeMarket({ name: "BTTS", selection: "yes", modelProbability: btts, marketProbability: mYes, correlationGroup: "btts", odds: bestOdds(odds, "btts", bttsYesMatch) }))
  results.push(makeMarket({ name: "BTTS", selection: "no", modelProbability: 1 - btts, marketProbability: mNo, correlationGroup: "btts", odds: bestOdds(odds, "btts", bttsNoMatch) }))

  // --- Marcador exacto (solo modelo) ---
  for (let h = 0; h <= 4; h++) {
    for (let a = 0; a <= 4; a++) {
      const prob = matrix[h]?.[a] ?? 0
      if (prob >= 0.04) {
        results.push(makeMarket({ name: "Marcador Exacto", selection: `${h}-${a}`, modelProbability: prob, marketProbability: null, correlationGroup: "exact_score", odds: null }))
      }
    }
  }

  return results
}
