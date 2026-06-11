const BASE_URL = "https://v3.football.api-sports.io"
const WC_2026_ID = 1 // Update with actual API-Football league ID for WC 2026

async function apiFetch(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "x-rapidapi-key": process.env.RAPIDAPI_KEY!,
      "x-rapidapi-host": "v3.football.api-sports.io",
    },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function fetchFixtures(season = 2026) {
  return apiFetch(`/fixtures?league=${WC_2026_ID}&season=${season}`)
}

export async function fetchFixtureStats(fixtureId: number) {
  return apiFetch(`/fixtures/statistics?fixture=${fixtureId}`)
}

export async function fetchTeamStats(teamId: number, season = 2026) {
  return apiFetch(`/teams/statistics?league=${WC_2026_ID}&team=${teamId}&season=${season}`)
}

export async function fetchPlayerStats(fixtureId: number) {
  return apiFetch(`/fixtures/players?fixture=${fixtureId}`)
}
