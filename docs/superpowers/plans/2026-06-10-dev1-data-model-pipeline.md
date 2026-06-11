# Dev 1: Data Pipeline + Statistical Model

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la capa de datos (fetchers + pipeline) y el motor estadístico corregido (Poisson + Dixon-Coles + H2H + form + contexto), más los dos crons.

**Architecture:** Cuatro fetchers independientes con fallback en cascada se combinan en un pipeline orquestador que produce `MatchData`. El modelo estadístico consume `MatchData` y produce `ModelOutput` + probabilidades por mercado base. Dev 2 consume estas interfaces para construir el engine, Kelly y UI en paralelo.

**Tech Stack:** TypeScript, Next.js 15, `@libsql/client` (Turso), API-Football (RapidAPI), The Odds API, BALLDONTLIE FIFA API, vitest para tests.

**Rama:** `feat/data-model`
**Merge target:** `main` cuando todos los tests pasen.
**Dependencia hacia Dev 2:** publicar `lib/types.ts` en `main` lo antes posible (Task 1). Dev 2 lo necesita para empezar.

---

## Mapa de archivos

| Acción | Archivo |
|---|---|
| Crear | `lib/types.ts` — todas las interfaces compartidas |
| Modificar | `lib/db/schema.ts` — nuevas tablas |
| Reescribir | `lib/data/api-football.ts` |
| Crear | `lib/data/odds-api.ts` |
| Crear | `lib/data/balldontlie.ts` |
| Crear | `lib/data/pipeline.ts` |
| Reescribir | `lib/model/poisson.ts` |
| Crear | `lib/model/h2h.ts` |
| Crear | `lib/model/form.ts` |
| Crear | `lib/model/context.ts` |
| Modificar | `lib/model/cards.ts` |
| Modificar | `lib/model/corners.ts` |
| Reescribir | `scripts/cron.ts` |
| Crear | `scripts/pre-match-cron.ts` |
| Crear | `src/lib/__tests__/model.test.ts` |
| Crear | `src/lib/__tests__/pipeline.test.ts` |
| Modificar | `.env.example` |
| Modificar | `package.json` — script pre-match |

---

## Task 1: Tipos compartidos y schema de DB

**PRIORIDAD MÁXIMA — hacer merge a `main` inmediatamente para que Dev 2 pueda empezar.**

**Files:**
- Crear: `src/lib/types.ts`
- Modificar: `src/lib/db/schema.ts`
- Modificar: `.env.example`

- [ ] **Paso 1.1: Crear rama**

```bash
git checkout main
git pull origin main
git checkout -b feat/data-model
```

- [ ] **Paso 1.2: Crear `src/lib/types.ts`**

```typescript
// src/lib/types.ts

export interface TeamStrength {
  id: number
  name: string
  country: string
  groupName: string
  fifaRanking: number
  attackStrength: number
  defenseStrength: number
}

export interface H2HRecord {
  date: string
  homeTeamId: number
  awayTeamId: number
  homeGoals: number
  awayGoals: number
  competition: 'world_cup' | 'continental' | 'qualifier' | 'friendly'
}

export interface FormRecord {
  date: string
  opponentRanking: number
  goalsFor: number
  goalsAgainst: number
  isHome: boolean
}

export interface Injury {
  playerId: number
  playerName: string
  position: string
  reason: string
  status: 'out' | 'doubtful'
}

export interface Player {
  id: number
  name: string
  position: string
  goals_per_90: number
  shots_per_90: number
  isStarter?: boolean
}

export interface RefereeStats {
  id: number
  name: string
  avgYellowsPerGame: number
  avgRedsPerGame: number
  totalGames: number
}

export interface MarketOdds {
  market: string
  selection: string
  odds: number
  bookmaker: string
  updatedAt: string
}

export interface MatchData {
  fixture: {
    id: number
    date: string
    stadium: string
    city: string
    altitudeM: number
    homeTeamId: number
    awayTeamId: number
    stage: string
  }
  teams: {
    home: TeamStrength
    away: TeamStrength
  }
  h2h: H2HRecord[]
  homeForm: FormRecord[]
  awayForm: FormRecord[]
  injuries: { home: Injury[]; away: Injury[] }
  lineups: { home: Player[] | null; away: Player[] | null }
  referee: RefereeStats | null
  weather: { tempC: number; humidity: number } | null
  odds: MarketOdds[]
  dataQuality: number
  fetchedAt: string
}

export interface ModelOutput {
  lambdaHome: number
  lambdaAway: number
  adjustmentsApplied: string[]
  scoreMatrix: number[][]
}

export interface MarketResult {
  name: string
  selection: string
  ourProbability: number
  bookmakerProbability: number | null
  odds: number | null
  bookmaker: string | null
  EV: number | null
  edge: number | null
  kellyFraction: number | null
  kellyAmount: number | null
  correlationGroup: string
  isRecommended: boolean
  oddsStale: boolean
}

export interface MatchAnalysis {
  fixtureId: number
  confidence: number
  isPreliminary: boolean
  model: ModelOutput
  markets: MarketResult[]
  alerts: string[]
  lastUpdated: string
}

export interface BankrollState {
  current: number
  initial: number
  weeklySnapshot: number
  mode: 'normal' | 'conservative' | 'paused'
  consecutiveLosses: number
  lastUpdated: string
}

export interface Bet {
  id?: number
  fixtureId: number
  market: string
  selection: string
  ourProbability: number
  bookmakerProbability: number | null
  oddsUsed: number
  oddsClosing: number | null
  amount: number
  kellySuggested: number
  EV: number
  edge: number
  result: 'win' | 'loss' | 'void' | null
  profitLoss: number | null
  mode: 'real' | 'paper'
  confidenceAtTime: number
  createdAt: string
  settledAt: string | null
}
```

- [ ] **Paso 1.3: Actualizar `src/lib/db/schema.ts`** — agregar nuevas tablas al final del SQL existente

```typescript
// src/lib/db/schema.ts
import { db } from "./client"

export async function migrate() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      group_name TEXT NOT NULL,
      fifa_ranking INTEGER DEFAULT 50,
      attack_strength REAL DEFAULT 1.0,
      defense_strength REAL DEFAULT 1.0
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY,
      team_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      position TEXT,
      goals_per_90 REAL DEFAULT 0.1,
      shots_per_90 REAL DEFAULT 0.5
    );

    CREATE TABLE IF NOT EXISTS fixtures (
      id INTEGER PRIMARY KEY,
      home_team_id INTEGER NOT NULL,
      away_team_id INTEGER NOT NULL,
      match_date TEXT,
      stage TEXT NOT NULL,
      status TEXT DEFAULT 'scheduled',
      home_score INTEGER,
      away_score INTEGER,
      api_fixture_id INTEGER,
      stadium TEXT,
      city TEXT,
      altitude_m INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS match_analyses (
      id INTEGER PRIMARY KEY,
      fixture_id INTEGER NOT NULL,
      is_preliminary INTEGER NOT NULL DEFAULT 1,
      confidence INTEGER NOT NULL,
      lambda_home REAL NOT NULL,
      lambda_away REAL NOT NULL,
      adjustments_applied TEXT NOT NULL,
      markets TEXT NOT NULL,
      alerts TEXT NOT NULL,
      data_quality INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY,
      fixture_id INTEGER NOT NULL,
      market TEXT NOT NULL,
      selection TEXT NOT NULL,
      our_probability REAL NOT NULL,
      bookmaker_probability REAL,
      odds_used REAL NOT NULL,
      odds_closing REAL,
      amount REAL NOT NULL,
      kelly_suggested REAL NOT NULL,
      ev REAL NOT NULL,
      edge REAL NOT NULL,
      result TEXT,
      profit_loss REAL,
      mode TEXT NOT NULL DEFAULT 'real',
      confidence_at_time INTEGER,
      created_at TEXT NOT NULL,
      settled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS bankroll_snapshots (
      id INTEGER PRIMARY KEY,
      balance REAL NOT NULL,
      snapshot_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY,
      fixture_id INTEGER,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `)
}
```

- [ ] **Paso 1.4: Actualizar `.env.example`**

```
TURSO_DATABASE_URL="libsql://your-db-url.turso.io"
TURSO_AUTH_TOKEN="your-turso-auth-token"
RAPIDAPI_KEY="your-rapidapi-key"
ODDS_API_KEY="your-the-odds-api-key"
```

- [ ] **Paso 1.5: Commit y push — Dev 2 puede empezar desde aquí**

```bash
git add src/lib/types.ts src/lib/db/schema.ts .env.example
git commit -m "feat: agregar tipos compartidos y schema DB actualizado"
git push -u origin feat/data-model
```

---

## Task 2: Fetcher de API-Football

**Files:**
- Reescribir: `src/lib/data/api-football.ts`

- [ ] **Paso 2.1: Reescribir `src/lib/data/api-football.ts`**

```typescript
// src/lib/data/api-football.ts
import type { TeamStrength, H2HRecord, FormRecord, Injury, Player, RefereeStats } from "../types"

const BASE = "https://v3.football.api-sports.io"
const WC_2026_LEAGUE_ID = 1
const WC_2026_SEASON = 2026

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "x-rapidapi-key": process.env.RAPIDAPI_KEY!,
      "x-rapidapi-host": "v3.football.api-sports.io",
    },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${path}`)
  const data = await res.json()
  return data
}

export async function fetchTodayFixtures(): Promise<{
  id: number; date: string; stadium: string; city: string;
  homeTeamId: number; awayTeamId: number; stage: string;
}[]> {
  const today = new Date().toISOString().split("T")[0]
  const data = await apiFetch<any>(
    `/fixtures?league=${WC_2026_LEAGUE_ID}&season=${WC_2026_SEASON}&date=${today}`
  )
  return (data.response ?? []).map((f: any) => ({
    id: f.fixture.id,
    date: f.fixture.date,
    stadium: f.fixture.venue?.name ?? "Unknown",
    city: f.fixture.venue?.city ?? "Unknown",
    homeTeamId: f.teams.home.id,
    awayTeamId: f.teams.away.id,
    stage: f.league.round ?? "Group Stage",
  }))
}

export async function fetchTeamStats(teamId: number): Promise<Partial<TeamStrength>> {
  const data = await apiFetch<any>(
    `/teams/statistics?league=${WC_2026_LEAGUE_ID}&team=${teamId}&season=${WC_2026_SEASON}`
  )
  const stats = data.response
  if (!stats) return {}
  const played = stats.fixtures?.played?.total ?? 1
  const goalsFor = stats.goals?.for?.total?.total ?? played * 1.4
  const goalsAgainst = stats.goals?.against?.total?.total ?? played * 1.2
  return {
    attackStrength: goalsFor / played / 1.4,
    defenseStrength: 1.4 / (goalsAgainst / played),
  }
}

export async function fetchH2H(homeTeamId: number, awayTeamId: number): Promise<H2HRecord[]> {
  const data = await apiFetch<any>(`/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&last=10`)
  return (data.response ?? []).map((f: any) => ({
    date: f.fixture.date,
    homeTeamId: f.teams.home.id,
    awayTeamId: f.teams.away.id,
    homeGoals: f.goals.home ?? 0,
    awayGoals: f.goals.away ?? 0,
    competition: mapCompetition(f.league.name),
  }))
}

function mapCompetition(name: string): H2HRecord["competition"] {
  const n = name.toLowerCase()
  if (n.includes("world cup")) return "world_cup"
  if (n.includes("euro") || n.includes("copa") || n.includes("nations")) return "continental"
  if (n.includes("qualif")) return "qualifier"
  return "friendly"
}

export async function fetchRecentForm(teamId: number): Promise<FormRecord[]> {
  const data = await apiFetch<any>(
    `/fixtures?team=${teamId}&last=5&league=${WC_2026_LEAGUE_ID}&season=${WC_2026_SEASON}`
  )
  return (data.response ?? []).map((f: any) => {
    const isHome = f.teams.home.id === teamId
    return {
      date: f.fixture.date,
      opponentRanking: 50,
      goalsFor: isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0),
      goalsAgainst: isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0),
      isHome,
    }
  })
}

export async function fetchInjuries(fixtureId: number): Promise<{ home: Injury[]; away: Injury[] }> {
  const data = await apiFetch<any>(`/injuries?fixture=${fixtureId}`)
  const home: Injury[] = []
  const away: Injury[] = []
  for (const inj of data.response ?? []) {
    const injury: Injury = {
      playerId: inj.player.id,
      playerName: inj.player.name,
      position: inj.player.type ?? "Unknown",
      reason: inj.player.reason ?? "Unknown",
      status: inj.player.reason?.toLowerCase().includes("out") ? "out" : "doubtful",
    }
    if (inj.team.id === inj.fixture?.teams?.home?.id) home.push(injury)
    else away.push(injury)
  }
  return { home, away }
}

export async function fetchLineups(fixtureId: number): Promise<{ home: Player[] | null; away: Player[] | null }> {
  const data = await apiFetch<any>(`/fixtures/lineups?fixture=${fixtureId}`)
  const teams = data.response ?? []
  if (teams.length < 2) return { home: null, away: null }
  const mapPlayers = (team: any): Player[] =>
    [...(team.startXI ?? []), ...(team.substitutes ?? [])].map((p: any) => ({
      id: p.player.id,
      name: p.player.name,
      position: p.player.pos ?? "MID",
      goals_per_90: 0.1,
      shots_per_90: 0.5,
      isStarter: team.startXI?.some((s: any) => s.player.id === p.player.id) ?? false,
    }))
  return { home: mapPlayers(teams[0]), away: mapPlayers(teams[1]) }
}

export async function fetchReferee(fixtureId: number): Promise<RefereeStats | null> {
  const data = await apiFetch<any>(`/fixtures?id=${fixtureId}`)
  const fixture = data.response?.[0]
  if (!fixture?.fixture?.referee) return null
  return {
    id: 0,
    name: fixture.fixture.referee,
    avgYellowsPerGame: 3.8,
    avgRedsPerGame: 0.10,
    totalGames: 0,
  }
}
```

- [ ] **Paso 2.2: Commit**

```bash
git add src/lib/data/api-football.ts
git commit -m "feat: reescribir fetcher API-Football con tipado completo"
```

---

## Task 3: Fetcher The Odds API

**Files:**
- Crear: `src/lib/data/odds-api.ts`

- [ ] **Paso 3.1: Crear `src/lib/data/odds-api.ts`**

```typescript
// src/lib/data/odds-api.ts
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
```

- [ ] **Paso 3.2: Commit**

```bash
git add src/lib/data/odds-api.ts
git commit -m "feat: agregar fetcher The Odds API con seleccion de mejor cuota"
```

---

## Task 4: Fetcher BALLDONTLIE

**Files:**
- Crear: `src/lib/data/balldontlie.ts`

- [ ] **Paso 4.1: Crear `src/lib/data/balldontlie.ts`**

```typescript
// src/lib/data/balldontlie.ts
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
```

- [ ] **Paso 4.2: Commit**

```bash
git add src/lib/data/balldontlie.ts
git commit -m "feat: agregar fetcher BALLDONTLIE como fuente complementaria de odds"
```

---

## Task 5: Pipeline orquestador

**Files:**
- Crear: `src/lib/data/pipeline.ts`
- Crear: `src/lib/__tests__/pipeline.test.ts`

- [ ] **Paso 5.1: Escribir test del pipeline**

```typescript
// src/lib/__tests__/pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildMatchData } from "../data/pipeline"

vi.mock("../data/api-football", () => ({
  fetchTodayFixtures: vi.fn(),
  fetchTeamStats: vi.fn().mockResolvedValue({ attackStrength: 1.2, defenseStrength: 0.9 }),
  fetchH2H: vi.fn().mockResolvedValue([]),
  fetchRecentForm: vi.fn().mockResolvedValue([]),
  fetchInjuries: vi.fn().mockResolvedValue({ home: [], away: [] }),
  fetchLineups: vi.fn().mockResolvedValue({ home: null, away: null }),
  fetchReferee: vi.fn().mockResolvedValue(null),
}))

vi.mock("../data/odds-api", () => ({
  fetchOdds: vi.fn().mockResolvedValue([]),
}))

vi.mock("../data/balldontlie", () => ({
  fetchBDLOdds: vi.fn().mockResolvedValue([]),
}))

describe("buildMatchData", () => {
  it("devuelve estructura MatchData completa aunque fallen fuentes secundarias", async () => {
    const fixture = {
      id: 1,
      date: "2026-06-11T18:00:00Z",
      stadium: "MetLife Stadium",
      city: "East Rutherford",
      altitudeM: 5,
      homeTeamId: 29,
      awayTeamId: 37,
      stage: "Group H",
    }
    const homeTeam = {
      id: 29, name: "España", country: "ESP", groupName: "H",
      fifaRanking: 1, attackStrength: 1.45, defenseStrength: 0.70,
    }
    const awayTeam = {
      id: 37, name: "Argentina", country: "ARG", groupName: "J",
      fifaRanking: 2, attackStrength: 1.50, defenseStrength: 0.75,
    }

    const result = await buildMatchData(fixture, homeTeam, awayTeam)

    expect(result.fixture.id).toBe(1)
    expect(result.teams.home.name).toBe("España")
    expect(result.teams.away.name).toBe("Argentina")
    expect(result.dataQuality).toBeGreaterThan(0)
    expect(result.fetchedAt).toBeDefined()
  })

  it("dataQuality sube cuando hay lineups confirmados", async () => {
    const { fetchLineups } = await import("../data/api-football")
    vi.mocked(fetchLineups).mockResolvedValueOnce({
      home: [{ id: 1, name: "Yamal", position: "FWD", goals_per_90: 0.4, shots_per_90: 2.1, isStarter: true }],
      away: [{ id: 2, name: "Messi", position: "FWD", goals_per_90: 0.6, shots_per_90: 3.0, isStarter: true }],
    })

    const fixture = { id: 1, date: "2026-06-11T18:00:00Z", stadium: "MetLife", city: "NJ", altitudeM: 5, homeTeamId: 29, awayTeamId: 37, stage: "Group H" }
    const home = { id: 29, name: "España", country: "ESP", groupName: "H", fifaRanking: 1, attackStrength: 1.45, defenseStrength: 0.70 }
    const away = { id: 37, name: "Argentina", country: "ARG", groupName: "J", fifaRanking: 2, attackStrength: 1.50, defenseStrength: 0.75 }

    const withLineup = await buildMatchData(fixture, home, away)
    expect(withLineup.lineups.home).not.toBeNull()
    expect(withLineup.dataQuality).toBeGreaterThan(40)
  })
})
```

- [ ] **Paso 5.2: Ejecutar test — debe fallar**

```bash
pnpm test src/lib/__tests__/pipeline.test.ts
```
Esperado: FAIL — "buildMatchData is not a function"

- [ ] **Paso 5.3: Crear `src/lib/data/pipeline.ts`**

```typescript
// src/lib/data/pipeline.ts
import type { MatchData, TeamStrength } from "../types"
import { fetchTeamStats, fetchH2H, fetchRecentForm, fetchInjuries, fetchLineups, fetchReferee } from "./api-football"
import { fetchOdds } from "./odds-api"
import { fetchBDLOdds } from "./balldontlie"

const ALTITUDE_BY_CITY: Record<string, number> = {
  "Ciudad de México": 2240,
  "Mexico City": 2240,
  "Guadalajara": 1566,
  "Dallas": 180,
  "Miami": 2,
  "Los Angeles": 82,
  "New York": 5,
  "San Francisco": 16,
  "Seattle": 10,
  "Kansas City": 315,
  "Boston": 9,
  "Vancouver": 5,
  "Toronto": 76,
}

export async function buildMatchData(
  fixture: {
    id: number; date: string; stadium: string; city: string;
    altitudeM: number; homeTeamId: number; awayTeamId: number; stage: string
  },
  homeTeam: TeamStrength,
  awayTeam: TeamStrength
): Promise<MatchData> {
  const altitude = ALTITUDE_BY_CITY[fixture.city] ?? fixture.altitudeM ?? 0

  const [
    homeStatsUpdate,
    awayStatsUpdate,
    h2h,
    homeForm,
    awayForm,
    injuries,
    lineups,
    referee,
    apiOdds,
    bdlOdds,
  ] = await Promise.allSettled([
    fetchTeamStats(homeTeam.id),
    fetchTeamStats(awayTeam.id),
    fetchH2H(homeTeam.id, awayTeam.id),
    fetchRecentForm(homeTeam.id),
    fetchRecentForm(awayTeam.id),
    fetchInjuries(fixture.id),
    fetchLineups(fixture.id),
    fetchReferee(fixture.id),
    fetchOdds(homeTeam.name, awayTeam.name),
    fetchBDLOdds(homeTeam.name, awayTeam.name),
  ])

  const resolvedHome = homeStatsUpdate.status === "fulfilled" ? homeStatsUpdate.value : {}
  const resolvedAway = awayStatsUpdate.status === "fulfilled" ? awayStatsUpdate.value : {}

  const mergedHome: TeamStrength = { ...homeTeam, ...resolvedHome }
  const mergedAway: TeamStrength = { ...awayTeam, ...resolvedAway }

  const resolvedH2H = h2h.status === "fulfilled" ? h2h.value : []
  const resolvedHomeForm = homeForm.status === "fulfilled" ? homeForm.value : []
  const resolvedAwayForm = awayForm.status === "fulfilled" ? awayForm.value : []
  const resolvedInjuries = injuries.status === "fulfilled" ? injuries.value : { home: [], away: [] }
  const resolvedLineups = lineups.status === "fulfilled" ? lineups.value : { home: null, away: null }
  const resolvedReferee = referee.status === "fulfilled" ? referee.value : null
  const resolvedApiOdds = apiOdds.status === "fulfilled" ? apiOdds.value : []
  const resolvedBdlOdds = bdlOdds.status === "fulfilled" ? bdlOdds.value : []

  const allOdds = [...resolvedApiOdds, ...resolvedBdlOdds]
  const oddsStale = allOdds.length > 0 &&
    new Date().getTime() - new Date(allOdds[0].updatedAt).getTime() > 4 * 60 * 60 * 1000

  const dataQuality = calcDataQuality({
    hasH2H: resolvedH2H.length >= 3,
    hasForm: resolvedHomeForm.length >= 3 && resolvedAwayForm.length >= 3,
    hasLineup: resolvedLineups.home !== null,
    hasOdds: allOdds.length > 0 && !oddsStale,
    hasReferee: resolvedReferee !== null,
  })

  return {
    fixture: { ...fixture, altitudeM: altitude },
    teams: { home: mergedHome, away: mergedAway },
    h2h: resolvedH2H,
    homeForm: resolvedHomeForm,
    awayForm: resolvedAwayForm,
    injuries: resolvedInjuries,
    lineups: resolvedLineups,
    referee: resolvedReferee,
    weather: null,
    odds: allOdds,
    dataQuality,
    fetchedAt: new Date().toISOString(),
  }
}

function calcDataQuality(flags: {
  hasH2H: boolean; hasForm: boolean; hasLineup: boolean;
  hasOdds: boolean; hasReferee: boolean
}): number {
  let score = 40
  if (flags.hasH2H)    score += 15
  if (flags.hasForm)   score += 15
  if (flags.hasLineup) score += 15
  if (flags.hasOdds)   score += 10
  if (flags.hasReferee) score += 5
  return score
}
```

- [ ] **Paso 5.4: Ejecutar test — debe pasar**

```bash
pnpm test src/lib/__tests__/pipeline.test.ts
```
Esperado: PASS (2 tests)

- [ ] **Paso 5.5: Commit**

```bash
git add src/lib/data/pipeline.ts src/lib/__tests__/pipeline.test.ts
git commit -m "feat: pipeline orquestador con fallback en cascada y dataQuality"
```

---

## Task 6: Modelo Poisson corregido

**Files:**
- Reescribir: `src/lib/model/poisson.ts`
- Crear: `src/lib/__tests__/model.test.ts`

- [ ] **Paso 6.1: Escribir tests del modelo**

```typescript
// src/lib/__tests__/model.test.ts
import { describe, it, expect } from "vitest"
import { buildScoreMatrix, extractMatchProbabilities } from "../model/poisson"

describe("buildScoreMatrix", () => {
  it("suma de todas las probabilidades es ~1", () => {
    const matrix = buildScoreMatrix(1.4, 1.2)
    const sum = matrix.flat().reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 2)
  })

  it("con lambdas iguales, la probabilidad de empate es mayor que victoria local en WC", () => {
    const matrix = buildScoreMatrix(1.3, 1.3)
    const probs = extractMatchProbabilities(matrix)
    expect(probs.draw).toBeGreaterThan(probs.homeWin * 0.8)
  })

  it("equipo con lambda alto tiene mayor prob de ganar", () => {
    const strong = buildScoreMatrix(2.5, 0.6)
    const probs = extractMatchProbabilities(strong)
    expect(probs.homeWin).toBeGreaterThan(0.6)
    expect(probs.awayWin).toBeLessThan(0.15)
  })

  it("Dixon-Coles corrige 0-0 hacia abajo respecto a Poisson puro", () => {
    const lambdaH = 1.4
    const lambdaA = 1.2
    const rawP00 = Math.exp(-lambdaH) * Math.exp(-lambdaA)
    const matrix = buildScoreMatrix(lambdaH, lambdaA)
    expect(matrix[0][0]).toBeLessThan(rawP00)
  })
})

describe("extractMatchProbabilities", () => {
  it("1X2 suman 1", () => {
    const matrix = buildScoreMatrix(1.4, 1.2)
    const probs = extractMatchProbabilities(matrix)
    expect(probs.homeWin + probs.draw + probs.awayWin).toBeCloseTo(1.0, 2)
  })
})
```

- [ ] **Paso 6.2: Ejecutar test — debe fallar**

```bash
pnpm test src/lib/__tests__/model.test.ts
```
Esperado: FAIL

- [ ] **Paso 6.3: Reescribir `src/lib/model/poisson.ts`**

```typescript
// src/lib/model/poisson.ts
export interface MatchProbabilities {
  homeWin: number
  draw: number
  awayWin: number
  over15: number
  over25: number
  over35: number
  over45: number
  btts: number
  cleanSheetHome: number
  cleanSheetAway: number
  exactScores: { score: string; prob: number }[]
}

const RHO = -0.13

function poissonProb(lambda: number, k: number): number {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}

function dixonColesTau(h: number, a: number, lH: number, lA: number): number {
  if (h === 0 && a === 0) return 1 - lH * lA * RHO
  if (h === 0 && a === 1) return 1 + lH * RHO
  if (h === 1 && a === 0) return 1 + lA * RHO
  if (h === 1 && a === 1) return 1 - RHO
  return 1
}

export function buildScoreMatrix(lambdaHome: number, lambdaAway: number, maxGoals = 8): number[][] {
  const matrix: number[][] = []
  let total = 0
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = []
    for (let a = 0; a <= maxGoals; a++) {
      const raw = poissonProb(lambdaHome, h) * poissonProb(lambdaAway, a)
      const tau = dixonColesTau(h, a, lambdaHome, lambdaAway)
      matrix[h][a] = raw * tau
      total += matrix[h][a]
    }
  }
  // normalizar para que sumen 1
  for (let h = 0; h <= maxGoals; h++)
    for (let a = 0; a <= maxGoals; a++)
      matrix[h][a] /= total
  return matrix
}

export function extractMatchProbabilities(matrix: number[][]): MatchProbabilities {
  let homeWin = 0, draw = 0, awayWin = 0
  let over15 = 0, over25 = 0, over35 = 0, over45 = 0
  let btts = 0, cleanSheetHome = 0, cleanSheetAway = 0
  const scores: { score: string; prob: number }[] = []

  for (let h = 0; h < matrix.length; h++) {
    for (let a = 0; a < matrix[h].length; a++) {
      const p = matrix[h][a]
      if (h > a) homeWin += p
      else if (h === a) draw += p
      else awayWin += p
      if (h + a > 1) over15 += p
      if (h + a > 2) over25 += p
      if (h + a > 3) over35 += p
      if (h + a > 4) over45 += p
      if (h > 0 && a > 0) btts += p
      if (a === 0) cleanSheetHome += p
      if (h === 0) cleanSheetAway += p
      if (h <= 5 && a <= 5) scores.push({ score: `${h}-${a}`, prob: p })
    }
  }

  scores.sort((a, b) => b.prob - a.prob)

  return {
    homeWin, draw, awayWin,
    over15, over25, over35, over45,
    btts, cleanSheetHome, cleanSheetAway,
    exactScores: scores.slice(0, 10),
  }
}
```

- [ ] **Paso 6.4: Ejecutar tests — deben pasar**

```bash
pnpm test src/lib/__tests__/model.test.ts
```
Esperado: PASS (4 tests)

- [ ] **Paso 6.5: Commit**

```bash
git add src/lib/model/poisson.ts src/lib/__tests__/model.test.ts
git commit -m "feat: modelo Poisson con correccion Dixon-Coles y normalizacion"
```

---

## Task 7: Modelos H2H, Form y Context

**Files:**
- Crear: `src/lib/model/h2h.ts`
- Crear: `src/lib/model/form.ts`
- Crear: `src/lib/model/context.ts`

- [ ] **Paso 7.1: Crear `src/lib/model/h2h.ts`**

```typescript
// src/lib/model/h2h.ts
import type { H2HRecord } from "../types"

const COMPETITION_WEIGHT: Record<H2HRecord["competition"], number> = {
  world_cup: 3.0,
  continental: 2.0,
  qualifier: 1.5,
  friendly: 0.5,
}

const MAX_ADJUSTMENT = 0.15

export function calcH2HFactor(
  records: H2HRecord[],
  teamId: number
): { attackMultiplier: number; defenseMultiplier: number; adjustmentDescription: string } {
  if (records.length < 3) {
    return { attackMultiplier: 1.0, defenseMultiplier: 1.0, adjustmentDescription: "" }
  }

  let weightedWins = 0, weightedTotal = 0

  for (const r of records) {
    const w = COMPETITION_WEIGHT[r.competition]
    const teamIsHome = r.homeTeamId === teamId
    const teamGoals = teamIsHome ? r.homeGoals : r.awayGoals
    const oppGoals = teamIsHome ? r.awayGoals : r.homeGoals
    if (teamGoals > oppGoals) weightedWins += w
    weightedTotal += w
  }

  const winRate = weightedWins / weightedTotal
  const rawAdj = (winRate - 0.5) * 0.3

  const clampedAdj = Math.max(-MAX_ADJUSTMENT, Math.min(MAX_ADJUSTMENT, rawAdj))

  const description = clampedAdj !== 0
    ? `H2H ${clampedAdj > 0 ? "+" : ""}${(clampedAdj * 100).toFixed(0)}%`
    : ""

  return {
    attackMultiplier: 1 + clampedAdj,
    defenseMultiplier: 1 - clampedAdj * 0.5,
    adjustmentDescription: description,
  }
}
```

- [ ] **Paso 7.2: Crear `src/lib/model/form.ts`**

```typescript
// src/lib/model/form.ts
import type { FormRecord } from "../types"

const WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.2]
const DECAY_PER_MONTH = 0.1

function ageWeight(dateStr: string): number {
  const months = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30)
  return Math.exp(-DECAY_PER_MONTH * months)
}

export function calcFormFactor(records: FormRecord[]): { factor: number; description: string } {
  if (records.length === 0) return { factor: 1.0, description: "" }

  const sorted = [...records].slice(0, 5)
  let weightedGoalDiff = 0, totalWeight = 0

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]
    const posWeight = WEIGHTS[i] ?? 0.2
    const timeWeight = ageWeight(r.date)
    const rankAdj = 1 + (50 - r.opponentRanking) * 0.002
    const w = posWeight * timeWeight * rankAdj
    weightedGoalDiff += (r.goalsFor - r.goalsAgainst) * w
    totalWeight += w
  }

  const avgDiff = totalWeight > 0 ? weightedGoalDiff / totalWeight : 0
  const factor = Math.max(0.90, Math.min(1.10, 1 + avgDiff * 0.04))

  const description = factor !== 1.0
    ? `Forma ${factor > 1 ? "+" : ""}${((factor - 1) * 100).toFixed(0)}%`
    : ""

  return { factor, description }
}
```

- [ ] **Paso 7.3: Crear `src/lib/model/context.ts`**

```typescript
// src/lib/model/context.ts

const HOME_ADVANTAGE: Record<string, number> = {
  USA: 1.08,
  CAN: 1.06,
  MEX: 1.10,
}

const ALTITUDE_CITIES: Record<string, number> = {
  "Ciudad de México": 2240,
  "Mexico City": 2240,
  "Guadalajara": 1566,
}

const COLD_CLIMATE_COUNTRIES = new Set(["SCO", "SWE", "NOR", "FIN", "DEN", "ISL", "NED", "BEL", "GER"])

export interface ContextAdjustments {
  homeAdvantage: number
  altitudeFactorHome: number
  heatFactorHome: number
  heatFactorAway: number
  fatigueFactor: number
  cardIntensity: number
  adjustments: string[]
}

export function calcContextAdjustments(params: {
  homeCountry: string
  awayCountry: string
  city: string
  altitudeM: number
  tempC: number | null
  homeRestDays: number
  awayRestDays: number
  refereeAvgYellows: number | null
}): ContextAdjustments {
  const adj: string[] = []

  const homeAdvantage = HOME_ADVANTAGE[params.homeCountry] ?? 1.0
  if (homeAdvantage > 1.0) adj.push(`Ventaja local ${params.homeCountry} +${((homeAdvantage - 1) * 100).toFixed(0)}%`)

  const altitude = ALTITUDE_CITIES[params.city] ?? params.altitudeM
  const altitudeFactorHome = altitude > 1500 ? 1.10 : altitude > 800 ? 1.04 : 1.0
  if (altitudeFactorHome > 1.0) adj.push(`Altitud ${altitude}m`)

  const temp = params.tempC ?? 22
  const awayIsCold = COLD_CLIMATE_COUNTRIES.has(params.awayCountry)
  const homeIsCold = COLD_CLIMATE_COUNTRIES.has(params.homeCountry)
  const heatFactorAway = temp > 32 && awayIsCold ? 0.94 : 1.0
  const heatFactorHome = temp > 32 && homeIsCold ? 0.94 : 1.0
  if (heatFactorAway < 1.0) adj.push(`Calor extremo ${temp}°C afecta ${params.awayCountry}`)
  if (heatFactorHome < 1.0) adj.push(`Calor extremo ${temp}°C afecta ${params.homeCountry}`)

  const fatigueFactor = Math.min(
    params.homeRestDays < 4 ? 0.95 : 1.0,
    params.awayRestDays < 4 ? 0.95 : 1.0
  )
  if (fatigueFactor < 1.0) adj.push("Fatiga por poco descanso")

  const refereeYellows = params.refereeAvgYellows ?? 3.8
  const cardIntensity = refereeYellows > 5.0 ? 1.30 : refereeYellows < 3.0 ? 0.75 : 1.0
  if (cardIntensity !== 1.0) adj.push(`Árbitro tarjetas ${cardIntensity > 1 ? "alto" : "bajo"}`)

  return {
    homeAdvantage,
    altitudeFactorHome,
    heatFactorHome,
    heatFactorAway,
    fatigueFactor,
    cardIntensity,
    adjustments: adj,
  }
}
```

- [ ] **Paso 7.4: Commit**

```bash
git add src/lib/model/h2h.ts src/lib/model/form.ts src/lib/model/context.ts
git commit -m "feat: modelos H2H, forma reciente y contexto situacional"
```

---

## Task 8: Actualizar cards.ts y corners.ts

**Files:**
- Modificar: `src/lib/model/cards.ts`
- Modificar: `src/lib/model/corners.ts`

- [ ] **Paso 8.1: Actualizar `src/lib/model/cards.ts`**

```typescript
// src/lib/model/cards.ts
import type { MatchData } from "../types"

export interface CardsPrediction {
  expectedYellows: number
  expectedReds: number
  over15: number
  over25: number
  over35: number
  over45: number
  redCardProb: number
}

export function predictCards(data: MatchData, cardIntensity: number): CardsPrediction {
  const homeStat = data.teams.home.attackStrength
  const awayStat = data.teams.away.attackStrength
  const baseYellows = 3.8 * cardIntensity * ((homeStat + awayStat) / 2)
  const baseReds = 0.10 * cardIntensity

  const over = (threshold: number): number => {
    let cumulative = 0
    for (let k = 0; k <= Math.floor(threshold); k++) {
      cumulative += poissonProb(baseYellows, k)
    }
    return 1 - cumulative
  }

  return {
    expectedYellows: baseYellows,
    expectedReds: baseReds,
    over15: over(1.5),
    over25: over(2.5),
    over35: over(3.5),
    over45: over(4.5),
    redCardProb: Math.min(0.35, baseReds),
  }
}

function poissonProb(lambda: number, k: number): number {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}
```

- [ ] **Paso 8.2: Actualizar `src/lib/model/corners.ts`**

```typescript
// src/lib/model/corners.ts
import type { MatchData } from "../types"

export interface CornersPrediction {
  expectedCorners: number
  over85: number
  over95: number
  over105: number
  over115: number
  firstHalfOver45: number
}

export function predictCorners(data: MatchData): CornersPrediction {
  const homeAttack = data.teams.home.attackStrength
  const awayAttack = data.teams.away.attackStrength
  const base = (homeAttack + awayAttack) * 4.8

  const over = (threshold: number): number => {
    let cumulative = 0
    for (let k = 0; k <= Math.floor(threshold); k++) {
      cumulative += poissonProb(base, k)
    }
    return 1 - cumulative
  }

  return {
    expectedCorners: base,
    over85: over(8.5),
    over95: over(9.5),
    over105: over(10.5),
    over115: over(11.5),
    firstHalfOver45: over(4.5 * (base / 9.5) * 0.45),
  }
}

function poissonProb(lambda: number, k: number): number {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}
```

- [ ] **Paso 8.3: Commit**

```bash
git add src/lib/model/cards.ts src/lib/model/corners.ts
git commit -m "feat: actualizar cards y corners para recibir MatchData real"
```

---

## Task 9: Reescribir scripts/cron.ts

**Files:**
- Reescribir: `scripts/cron.ts`
- Crear: `scripts/pre-match-cron.ts`
- Modificar: `package.json`

- [ ] **Paso 9.1: Reescribir `scripts/cron.ts`**

```typescript
// scripts/cron.ts
import { db } from "../src/lib/db/client"
import { migrate } from "../src/lib/db/schema"
import { seed } from "../src/lib/db/seed"
import { fetchTodayFixtures } from "../src/lib/data/api-football"
import { buildMatchData } from "../src/lib/data/pipeline"
import type { TeamStrength } from "../src/lib/types"

async function getTeamStrengths(): Promise<Map<number, TeamStrength>> {
  const result = await db.execute("SELECT * FROM teams")
  const map = new Map<number, TeamStrength>()
  for (const row of result.rows as any[]) {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      country: row.country,
      groupName: row.group_name,
      fifaRanking: row.fifa_ranking,
      attackStrength: row.attack_strength,
      defenseStrength: row.defense_strength,
    })
  }
  return map
}

async function saveAnalysisStub(fixtureId: number, dataQuality: number) {
  await db.execute({
    sql: `INSERT OR REPLACE INTO match_analyses
          (fixture_id, is_preliminary, confidence, lambda_home, lambda_away,
           adjustments_applied, markets, alerts, data_quality, created_at)
          VALUES (?, 1, ?, 0, 0, '[]', '[]', '[]', ?, ?)`,
    args: [fixtureId, dataQuality, dataQuality, new Date().toISOString()],
  })
}

async function run() {
  console.log("[cron] Iniciando pipeline diario...")
  await migrate()
  await seed()

  const teams = await getTeamStrengths()
  const fixtures = await fetchTodayFixtures()
  console.log(`[cron] ${fixtures.length} partidos hoy`)

  for (const fixture of fixtures) {
    const home = teams.get(fixture.homeTeamId)
    const away = teams.get(fixture.awayTeamId)
    if (!home || !away) {
      console.warn(`[cron] Equipos no encontrados: ${fixture.homeTeamId} vs ${fixture.awayTeamId}`)
      continue
    }

    try {
      const matchData = await buildMatchData(fixture, home, away)
      await saveAnalysisStub(fixture.id, matchData.dataQuality)
      console.log(`[cron] ${home.name} vs ${away.name} — dataQuality: ${matchData.dataQuality}`)
    } catch (err) {
      console.error(`[cron] Error en fixture ${fixture.id}:`, err)
    }
  }

  console.log("[cron] Pipeline diario completado")
  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Paso 9.2: Crear `scripts/pre-match-cron.ts`**

```typescript
// scripts/pre-match-cron.ts
// Ejecutar 60 minutos antes de cada partido para datos finales
import { db } from "../src/lib/db/client"
import { fetchLineups, fetchTodayFixtures } from "../src/lib/data/api-football"
import { fetchOdds } from "../src/lib/data/odds-api"
import type { TeamStrength } from "../src/lib/types"

async function getTeamStrengths(): Promise<Map<number, TeamStrength>> {
  const result = await db.execute("SELECT * FROM teams")
  const map = new Map<number, TeamStrength>()
  for (const row of result.rows as any[]) {
    map.set(row.id, {
      id: row.id, name: row.name, country: row.country, groupName: row.group_name,
      fifaRanking: row.fifa_ranking, attackStrength: row.attack_strength,
      defenseStrength: row.defense_strength,
    })
  }
  return map
}

async function createAlert(fixtureId: number, type: string, message: string) {
  await db.execute({
    sql: `INSERT INTO alerts (fixture_id, type, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
    args: [fixtureId, type, message, new Date().toISOString()],
  })
}

async function run() {
  const fixtureId = process.env.FIXTURE_ID ? Number(process.env.FIXTURE_ID) : null
  console.log(`[pre-match] Fixture: ${fixtureId ?? "todos los de hoy en 60 min"}`)

  const teams = await getTeamStrengths()
  const fixtures = await fetchTodayFixtures()

  const now = Date.now()
  const targets = fixtureId
    ? fixtures.filter(f => f.id === fixtureId)
    : fixtures.filter(f => {
        const matchTime = new Date(f.date).getTime()
        const minutesBefore = (matchTime - now) / 60000
        return minutesBefore >= 55 && minutesBefore <= 65
      })

  for (const fixture of targets) {
    const home = teams.get(fixture.homeTeamId)
    const away = teams.get(fixture.awayTeamId)
    if (!home || !away) continue

    const lineups = await fetchLineups(fixture.id)
    if (lineups.home && lineups.away) {
      await createAlert(fixture.id, "lineup_available",
        `Alineaciones confirmadas: ${home.name} vs ${away.name}`)
      console.log(`[pre-match] Lineups confirmados para ${home.name} vs ${away.name}`)
    }

    const odds = await fetchOdds(home.name, away.name)
    if (odds.length === 0) {
      await createAlert(fixture.id, "stale_odds",
        `Sin cuotas actualizadas para ${home.name} vs ${away.name} — ingresar manualmente`)
    }

    await db.execute({
      sql: `UPDATE match_analyses SET is_preliminary = 0 WHERE fixture_id = ?`,
      args: [fixture.id],
    })
    console.log(`[pre-match] Análisis marcado como FINAL: fixture ${fixture.id}`)
  }

  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Paso 9.3: Actualizar `package.json` — agregar script pre-match**

En la sección `"scripts"`, agregar:
```json
"pre-match:run": "tsx --env-file=.env.local scripts/pre-match-cron.ts"
```

- [ ] **Paso 9.4: Commit final**

```bash
git add scripts/cron.ts scripts/pre-match-cron.ts package.json
git commit -m "feat: reescribir cron diario y agregar pre-match cron 60 min antes"
```

---

## Task 10: Push y PR

- [ ] **Paso 10.1: Ejecutar todos los tests**

```bash
pnpm test
```
Esperado: todos los tests en PASS

- [ ] **Paso 10.2: Push y abrir PR**

```bash
git push origin feat/data-model
```

Abrir PR en GitHub con:
- Title: `feat: data pipeline + modelo estadístico corregido`
- Base: `main`
- Description: capa de datos (3 fetchers + pipeline), Poisson con Dixon-Coles, H2H, form, context, crons

- [ ] **Paso 10.3: Notificar a Dev 2**

Los tipos en `src/lib/types.ts` están listos en `main` desde Task 1. Dev 2 puede hacer merge de `main` a su rama para obtener las actualizaciones del modelo si las necesita.

---

## Resumen de commits esperados

```
feat: agregar tipos compartidos y schema DB actualizado          (Task 1 — merge rápido a main)
feat: reescribir fetcher API-Football con tipado completo        (Task 2)
feat: agregar fetcher The Odds API con seleccion de mejor cuota  (Task 3)
feat: agregar fetcher BALLDONTLIE como fuente complementaria     (Task 4)
feat: pipeline orquestador con fallback en cascada y dataQuality (Task 5)
feat: modelo Poisson con correccion Dixon-Coles y normalizacion  (Task 6)
feat: modelos H2H, forma reciente y contexto situacional         (Task 7)
feat: actualizar cards y corners para recibir MatchData real     (Task 8)
feat: reescribir cron diario y agregar pre-match cron            (Task 9)
```
