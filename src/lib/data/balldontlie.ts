import type { MarketOdds } from "../types"

const BASE = "https://api.balldontlie.io/fifa/v1"

async function bdlFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function fetchBDLOdds(homeTeam: string, awayTeam: string): Promise<MarketOdds[]> {
  const data = await bdlFetch<any>(`/odds?home_team=${encodeURIComponent(homeTeam)}&away_team=${encodeURIComponent(awayTeam)}`)
  if (!data?.data) return []

  const now = new Date().toISOString()
  return (data.data ?? []).map((o: any) => ({
    market: o.market ?? "h2h",
    selection: o.selection ?? "home",
    odds: Number(o.odds ?? 2.0),
    bookmaker: "balldontlie",
    updatedAt: now,
  }))
}
