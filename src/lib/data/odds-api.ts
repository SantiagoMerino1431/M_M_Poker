import type { MarketOdds } from "../types"

const BASE = "https://api.the-odds-api.com/v4"
const SPORT = "soccer_fifa_world_cup"

export async function fetchOdds(homeTeam: string, awayTeam: string): Promise<MarketOdds[]> {
  const key = process.env.ODDS_API_KEY
  if (!key) return []

  const markets = "h2h,totals,btts"
  const url = `${BASE}/sports/${SPORT}/odds/?apiKey=${key}&regions=eu&markets=${markets}&oddsFormat=decimal`

  let data: any
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    data = await res.json()
  } catch {
    return []
  }

  const game = (data ?? []).find((g: any) =>
    normalize(g.home_team) === normalize(homeTeam) ||
    normalize(g.away_team) === normalize(awayTeam)
  )
  if (!game) return []

  const now = new Date().toISOString()
  const results: MarketOdds[] = []

  for (const bm of game.bookmakers ?? []) {
    for (const market of bm.markets ?? []) {
      for (const outcome of market.outcomes ?? []) {
        results.push({
          market: market.key,
          selection: outcome.name,
          odds: outcome.price,
          bookmaker: bm.key,
          updatedAt: now,
        })
      }
    }
  }

  return results
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "")
}

export function bestOddsFor(odds: MarketOdds[], market: string, selection: string): MarketOdds | null {
  const candidates = odds.filter(
    o => o.market === market && normalize(o.selection) === normalize(selection)
  )
  if (!candidates.length) return null
  return candidates.reduce((best, cur) => cur.odds > best.odds ? cur : best)
}
