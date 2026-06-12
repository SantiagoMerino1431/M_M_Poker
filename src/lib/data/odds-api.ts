import type { MarketOdds } from "../types"
import { matchesTeam } from "./team-names"

const BASE = "https://api.the-odds-api.com/v4"
const SPORT = "soccer_fifa_world_cup"

export async function fetchOdds(homeTeam: string, awayTeam: string): Promise<MarketOdds[]> {
  const key = process.env.ODDS_API_KEY
  if (!key) return []

  // El endpoint general solo soporta h2h y totals. btts requiere el endpoint por-evento.
  const markets = "h2h,totals"
  const url = `${BASE}/sports/${SPORT}/odds/?apiKey=${key}&regions=eu&markets=${markets}&oddsFormat=decimal`

  let data: any
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } } as RequestInit)
    if (!res.ok) return []
    data = await res.json()
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []

  // Exigir que AMBOS equipos coincidan para no enganchar el evento equivocado.
  const game = data.find((g: any) =>
    (matchesTeam(homeTeam, g.home_team) && matchesTeam(awayTeam, g.away_team)) ||
    (matchesTeam(homeTeam, g.away_team) && matchesTeam(awayTeam, g.home_team))
  )
  if (!game) return []

  const results: MarketOdds[] = []
  for (const bm of game.bookmakers ?? []) {
    const updatedAt = bm.last_update ?? new Date().toISOString()
    for (const market of bm.markets ?? []) {
      for (const outcome of market.outcomes ?? []) {
        const selection = market.key === "totals" && outcome.point != null
          ? `${outcome.name} ${outcome.point}`   // "Over 2.5"
          : outcome.name                          // "Canada" / "Draw"
        results.push({
          market: market.key,
          selection,
          odds: outcome.price,
          bookmaker: bm.key,
          updatedAt,
        })
      }
    }
  }
  return results
}

export function bestOddsFor(odds: MarketOdds[], market: string, selection: string): MarketOdds | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
  const candidates = odds.filter(o => o.market === market && norm(o.selection) === norm(selection))
  if (!candidates.length) return null
  return candidates.reduce((best, cur) => cur.odds > best.odds ? cur : best)
}
