# Betting Assistant — Plan de Corrección y Endurecimiento

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el asistente de un sistema que nunca emite recomendaciones (y que, de hacerlo, las haría invertidas) en una herramienta cuantitativamente defendible: APIs que responden, probabilidades ancladas al mercado de-viggeado, un único Kelly con controles de riesgo reales, y métricas de CLV/calibración que permitan saber si hay edge.

**Architecture:** Se respeta la arquitectura en capas existente (`lib/model` → `lib/engine` → `lib/kelly`). Los fixes se ordenan por dependencia: primero la corrección del modelo (semántica de defensa, Dixon-Coles), luego la ingesta real de cuotas, después el anclaje al mercado (de-vig + blend) que es lo que hace seguras las recomendaciones, y por último los controles de riesgo, el CLV y la calibración. Cada fase deja el sistema en estado funcional y testeable.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, Turso/LibSQL, Vitest, The Odds API, API-Football. Sin nuevas dependencias.

**Convención crítica establecida en este plan:** `defenseStrength` es un **multiplicador directo donde menor = mejor defensa** (España 0.70). El motor calcula `λ_rival = ataque_rival × defensa_propia × 1.4`. Toda fuente de datos debe producir defensa con esta semántica: `defenseStrength = goles_recibidos_por_partido / 1.4`. Esto ya lo cumplen `seed.ts` y `scripts/backtest/loaders.ts`; las fuentes a corregir son `csv-loader.ts` y `api-football.ts`.

---

## Mapa de archivos

**Fase 1 — Corrección del modelo (resultados invertidos)**
- Modify: `src/lib/data/csv-loader.ts:205-221` — `getTeamStrengthFromCSV` defensa invertida
- Modify: `src/lib/data/api-football.ts:58-71` — `fetchTeamStats` defensa invertida
- Test: `src/lib/__tests__/data-strength.test.ts` (crear)

**Fase 2 — Ingesta real de cuotas**
- Modify: `src/lib/data/odds-api.ts` — quitar `btts`, mapear nombres ES↔EN, exigir match de ambos equipos + fecha, preservar timestamp real
- Create: `src/lib/data/team-names.ts` — mapa de nombres compartido (extraído de csv-loader)
- Modify: `src/lib/data/csv-loader.ts:8-63` — reusar `team-names.ts`
- Test: `src/lib/__tests__/odds-api.test.ts` (crear)

**Fase 3 — Probabilidades ancladas al mercado**
- Create: `src/lib/model/devig.ts` — de-vig multiplicativo + consenso (mediana)
- Create: `src/lib/model/blend.ts` — blend modelo/mercado
- Modify: `src/lib/types.ts:97-111` — añadir `modelProbability`, `marketProbability` a `MarketResult`
- Modify: `src/lib/engine/markets.ts` — usar consenso de-viggeado y prob blendada para EV
- Test: `src/lib/__tests__/devig.test.ts`, `src/lib/__tests__/blend.test.ts` (crear)

**Fase 4 — Motor estadístico**
- Modify: `src/lib/model/poisson.ts` — Dixon-Coles + normalización + `extractMatchProbabilities`
- Modify: `src/lib/engine/analyzer.ts` — confidence real basado en datos + divergencia
- Modify: `src/lib/data/pipeline.ts:111-122` — `calcDataQuality` separado de confidence
- Test: `src/lib/__tests__/model.test.ts` (ya existe, hoy falla), `src/lib/__tests__/confidence.test.ts` (crear)

**Fase 5 — Kelly único y controles de riesgo**
- Modify: `src/lib/kelly/criterion.ts` — única fuente de verdad, sin floor forzado
- Modify: `src/lib/engine/ev.ts` — delegar en `calcKelly`
- Modify: `src/app/actions.ts` — `updateMarketOddsAction` y pre-match delegan en `calcKelly`; `registerBet` aplica circuit breaker + límite diario; `settleBetAction` actualiza bankroll
- Modify: `src/lib/kelly/portfolio.ts` — `applyDailyLimit` conectado
- Test: `src/lib/__tests__/kelly.test.ts` (ampliar), `src/lib/__tests__/risk-controls.test.ts` (crear)

**Fase 6 — CLV / closing odds**
- Modify: `src/app/actions.ts` — nueva `captureClosingOddsAction`
- Modify: `scripts/pre-match-cron.ts` — captura closing odds de apuestas abiertas
- Test: `src/lib/__tests__/clv.test.ts` (crear)

**Fase 7 — Señales contextuales reales**
- Modify: `src/lib/model/h2h.ts` — decaimiento temporal por meses, descartar partidos antiguos
- Modify: `src/lib/model/form.ts` — decaimiento por meses, `opponentRanking` real
- Modify: `src/lib/data/api-football.ts:93-107` / `src/lib/data/csv-loader.ts:191-202` — poblar `opponentRanking`
- Modify: `src/lib/data/pipeline.ts` / `src/lib/engine/analyzer.ts` — `restDays` reales desde fixtures
- Test: `src/lib/__tests__/h2h-decay.test.ts`, `src/lib/__tests__/form-decay.test.ts` (crear)

**Fase 8 — Cron real + calibración**
- Modify: `scripts/cron.ts` — guardar análisis real (no stubs)
- Create: `scripts/calibrate.ts` — calibración contra `data/closing_odds.csv`
- Modify: `package.json` — script `calibrate:run`

---

## FASE 1 — Corrección del modelo (prioridad máxima)

> Sin esto, habilitar las cuotas hace que el sistema recomiende las peores apuestas posibles. Por eso va primero.

### Task 1.1: Corregir semántica de defensa en CSV loader

**Files:**
- Modify: `src/lib/data/csv-loader.ts:205-221`
- Test: `src/lib/__tests__/data-strength.test.ts` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/data-strength.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { getTeamStrengthFromCSV } from "../data/csv-loader"

describe("getTeamStrengthFromCSV — convención de defensa (menor = mejor)", () => {
  it("una selección que concede poco tiene defenseStrength bajo (<1)", () => {
    // Bosnia concede ~0.7 goles/partido en el CSV -> defensa fuerte -> valor bajo
    const bosnia = getTeamStrengthFromCSV("Bosnia y Herzegovina")
    expect(bosnia).not.toBeNull()
    expect(bosnia!.defenseStrength).toBeLessThan(1.0)
  })

  it("una selección que concede mucho tiene defenseStrength alto (>1)", () => {
    // Paraguay concede bastante -> defensa débil -> valor alto
    const paraguay = getTeamStrengthFromCSV("Paraguay")
    expect(paraguay).not.toBeNull()
    expect(paraguay!.defenseStrength).toBeGreaterThan(1.0)
  })

  it("attackStrength sigue siendo mayor = mejor ataque", () => {
    const s = getTeamStrengthFromCSV("Estados Unidos")
    expect(s).not.toBeNull()
    expect(s!.attackStrength).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/data-strength.test.ts`
Expected: FAIL — hoy `defenseStrength` de Bosnia da ~0.72 (parece bajo) pero por la razón equivocada; el test de Paraguay (`>1.0`) falla porque hoy concede→`1.4/conceded` da <1.

- [ ] **Step 3: Implementar el fix**

En `src/lib/data/csv-loader.ts`, reemplazar el bloque `return` de `getTeamStrengthFromCSV` (líneas 216-220):

```typescript
  const LEAGUE_AVG = 1.4
  return {
    attackStrength:  Math.max(0.5, Math.min(2.0, avgScored   / LEAGUE_AVG)),
    // Convención: menor = mejor defensa. Goles recibidos por partido sobre la media.
    defenseStrength: Math.max(0.5, Math.min(2.0, avgConceded / LEAGUE_AVG)),
  }
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run src/lib/__tests__/data-strength.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/csv-loader.ts src/lib/__tests__/data-strength.test.ts
git commit -m "fix(model): corregir semantica invertida de defenseStrength en CSV loader"
```

### Task 1.2: Corregir semántica de defensa en API-Football

**Files:**
- Modify: `src/lib/data/api-football.ts:58-71`
- Test: `src/lib/__tests__/api-football-strength.test.ts` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/api-football-strength.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

beforeEach(() => { vi.resetModules() })

describe("fetchTeamStats — defensa menor = mejor", () => {
  it("equipo que concede 0.5 goles/partido produce defenseStrength < 1", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          fixtures: { played: { total: 10 } },
          goals: { for: { total: { total: 20 } }, against: { total: { total: 5 } } },
        },
      }),
    }))
    process.env.RAPIDAPI_KEY = "test"
    const { fetchTeamStats } = await import("../data/api-football")
    const s = await fetchTeamStats(1)
    // concede 0.5/partido -> 0.5/1.4 ~= 0.36 -> defensa fuerte (<1)
    expect(s.defenseStrength!).toBeLessThan(1.0)
    // marca 2.0/partido -> 2.0/1.4 ~= 1.43 -> ataque fuerte (>1)
    expect(s.attackStrength!).toBeGreaterThan(1.0)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/api-football-strength.test.ts`
Expected: FAIL — hoy `defenseStrength = 1.4 / 0.5 = 2.8` (>1, invertido).

- [ ] **Step 3: Implementar el fix**

En `src/lib/data/api-football.ts`, reemplazar el `return` de `fetchTeamStats` (líneas 67-70):

```typescript
  return {
    attackStrength: goalsFor / played / 1.4,
    // Convención: menor = mejor defensa. Goles recibidos por partido sobre la media.
    defenseStrength: (goalsAgainst / played) / 1.4,
  }
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run src/lib/__tests__/api-football-strength.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/api-football.ts src/lib/__tests__/api-football-strength.test.ts
git commit -m "fix(model): corregir semantica invertida de defenseStrength en API-Football"
```

### Task 1.3: Verificación de cordura modelo vs mercado

**Files:**
- Test: `src/lib/__tests__/sanity-vs-market.test.ts` (crear)

- [ ] **Step 1: Escribir el test de cordura**

Crear `src/lib/__tests__/sanity-vs-market.test.ts`. Usa fuerzas reales del seed y confirma que el favorito del modelo coincide con el del mercado:

```typescript
import { describe, it, expect } from "vitest"
import { buildScoreMatrix } from "../model/poisson"
import { calcAllMarkets } from "../engine/markets"
import { makeMockMatchData } from "./fixtures/mock-match-data"

describe("cordura: el favorito del modelo coincide con el del mercado", () => {
  it("Canadá (def fuerte) es favorito sobre Bosnia, no al revés", () => {
    // Fuerzas del seed: Canadá atk 0.95 def 1.05 ; Bosnia atk 0.85 def 1.10
    const data = makeMockMatchData({
      teams: {
        home: { id: 5, name: "Canadá", country: "CAN", groupName: "B", fifaRanking: 43, attackStrength: 0.95, defenseStrength: 1.05 },
        away: { id: 6, name: "Bosnia y Herzegovina", country: "BIH", groupName: "B", fifaRanking: 70, attackStrength: 0.85, defenseStrength: 1.10 },
      },
      odds: [],
    })
    const lambdaHome = data.teams.home.attackStrength * data.teams.away.defenseStrength * 1.4
    const lambdaAway = data.teams.away.attackStrength * data.teams.home.defenseStrength * 1.4
    const matrix = buildScoreMatrix(lambdaHome, lambdaAway)
    const markets = calcAllMarkets(matrix, data)
    const home = markets.find(m => m.name === "1X2" && m.selection === "home")!
    const away = markets.find(m => m.name === "1X2" && m.selection === "away")!
    expect(home.modelProbability).toBeGreaterThan(away.modelProbability)
  })
})
```

> Nota: `modelProbability` se añade en la Fase 3. Si esta tarea se ejecuta antes de la 3, usar `ourProbability` y actualizar a `modelProbability` en la 3.

- [ ] **Step 2: Correr el test**

Run: `pnpm vitest run src/lib/__tests__/sanity-vs-market.test.ts`
Expected: PASS (tras Fase 1 el modelo ya no invierte el favorito).

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/sanity-vs-market.test.ts
git commit -m "test(model): cordura favorito modelo vs mercado"
```

---

## FASE 2 — Ingesta real de cuotas

### Task 2.1: Extraer mapa de nombres compartido

**Files:**
- Create: `src/lib/data/team-names.ts`
- Modify: `src/lib/data/csv-loader.ts:8-63`
- Test: `src/lib/__tests__/team-names.test.ts` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/team-names.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { toEnglish, toSpanish, matchesTeam } from "../data/team-names"

describe("team-names", () => {
  it("traduce español a inglés", () => {
    expect(toEnglish("Estados Unidos")).toBe("United States")
    expect(toEnglish("Canadá")).toBe("Canada")
  })

  it("matchesTeam empareja variantes ES/EN y de la API", () => {
    expect(matchesTeam("Canadá", "Canada")).toBe(true)
    expect(matchesTeam("Estados Unidos", "USA")).toBe(true)
    expect(matchesTeam("Bosnia y Herzegovina", "Bosnia & Herzegovina")).toBe(true)
    expect(matchesTeam("Canadá", "Bosnia & Herzegovina")).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/team-names.test.ts`
Expected: FAIL — "Cannot find module '../data/team-names'".

- [ ] **Step 3: Crear `src/lib/data/team-names.ts`**

```typescript
// Mapa único de nombres de selección entre el español de la DB, el inglés de los CSV
// y las variantes de las APIs externas (The Odds API, API-Football).

const EN_TO_ES: Record<string, string> = {
  "Mexico": "México", "South Africa": "Sudáfrica", "South Korea": "República de Corea",
  "Czech Republic": "Chequia", "Canada": "Canadá", "Bosnia and Herzegovina": "Bosnia y Herzegovina",
  "Qatar": "Catar", "Switzerland": "Suiza", "Brazil": "Brasil", "Morocco": "Marruecos",
  "Haiti": "Haití", "Scotland": "Escocia", "United States": "Estados Unidos", "Paraguay": "Paraguay",
  "Australia": "Australia", "Turkey": "Turquía", "Germany": "Alemania", "Curaçao": "Curazao",
  "Ivory Coast": "Costa de Marfil", "Ecuador": "Ecuador", "Netherlands": "Países Bajos",
  "Japan": "Japón", "Sweden": "Suecia", "Tunisia": "Túnez", "Belgium": "Bélgica", "Egypt": "Egipto",
  "Iran": "RI de Irán", "New Zealand": "Nueva Zelanda", "Spain": "España",
  "Cape Verde": "Islas de Cabo Verde", "Saudi Arabia": "Arabia Saudí", "Uruguay": "Uruguay",
  "France": "Francia", "Senegal": "Senegal", "Iraq": "Irak", "Norway": "Noruega",
  "Argentina": "Argentina", "Algeria": "Argelia", "Austria": "Austria", "Jordan": "Jordania",
  "Portugal": "Portugal", "DR Congo": "RD Congo", "Uzbekistan": "Uzbekistán", "Colombia": "Colombia",
  "England": "Inglaterra", "Croatia": "Croacia", "Ghana": "Ghana", "Panama": "Panamá",
}

// Alias de las APIs hacia su forma inglesa canónica del mapa de arriba.
const API_ALIASES: Record<string, string> = {
  "usa": "united states",
  "bosnia & herzegovina": "bosnia and herzegovina",
  "bosniaherzegovina": "bosniaandherzegovina",
  "south korea": "south korea",
  "ivory coast": "ivory coast",
  "côte d'ivoire": "ivory coast",
  "cote divoire": "ivory coast",
  "türkiye": "turkey",
  "czechia": "czech republic",
}

const ES_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_ES).map(([en, es]) => [es, en])
)

export function toSpanish(name: string): string { return EN_TO_ES[name] ?? name }
export function toEnglish(name: string): string { return ES_TO_EN[name] ?? name }

// Normaliza a minúsculas sin acentos ni símbolos, conservando solo letras.
export function normName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "").replace(/[^a-z]/g, "")
}

function canonical(name: string): string {
  // Nombre español conocido -> su forma inglesa canónica.
  if (ES_TO_EN[name]) return normName(ES_TO_EN[name])
  // Si no, aplica alias de API (USA, Bosnia &, etc.) y normaliza.
  const lower = name.toLowerCase().trim()
  const aliased = API_ALIASES[lower] ?? lower
  return normName(aliased)
}

// True si dos nombres (en cualquier idioma/variante) refieren a la misma selección.
export function matchesTeam(a: string, b: string): boolean {
  return canonical(a) === canonical(b)
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run src/lib/__tests__/team-names.test.ts`
Expected: PASS

- [ ] **Step 5: Refactor csv-loader para reusar el mapa**

En `src/lib/data/csv-loader.ts`, eliminar el `EN_TO_ES`/`ES_TO_EN`/`toSpanish`/`toEnglish`/`normName` locales (líneas 8-67) e importar del módulo nuevo:

```typescript
import { toSpanish, toEnglish, normName } from "./team-names"
```

Correr toda la suite para asegurar que no se rompió csv-loader:

Run: `pnpm vitest run`
Expected: PASS (mismos resultados que antes de este refactor, salvo los tests ya fallidos preexistentes de Fase 4).

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/team-names.ts src/lib/data/csv-loader.ts src/lib/__tests__/team-names.test.ts
git commit -m "refactor(data): mapa de nombres de seleccion compartido y reusable"
```

### Task 2.2: Arreglar fetchOdds (mercado btts inválido + matching + timestamp)

**Files:**
- Modify: `src/lib/data/odds-api.ts`
- Test: `src/lib/__tests__/odds-api.test.ts` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/odds-api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const SAMPLE = [
  {
    home_team: "Canada", away_team: "Bosnia & Herzegovina",
    commence_time: "2026-06-12T19:00:00Z",
    bookmakers: [
      { key: "pinnacle", last_update: "2026-06-12T17:00:00Z", markets: [
        { key: "h2h", outcomes: [
          { name: "Canada", price: 1.85 }, { name: "Bosnia & Herzegovina", price: 4.40 }, { name: "Draw", price: 3.35 },
        ]},
        { key: "totals", outcomes: [
          { name: "Over", price: 2.10, point: 2.5 }, { name: "Under", price: 1.70, point: 2.5 },
        ]},
      ]},
    ],
  },
  {
    home_team: "USA", away_team: "Paraguay", commence_time: "2026-06-13T01:00:00Z",
    bookmakers: [{ key: "pinnacle", last_update: "2026-06-12T23:00:00Z", markets: [
      { key: "h2h", outcomes: [{ name: "USA", price: 2.10 }, { name: "Paraguay", price: 3.92 }, { name: "Draw", price: 3.25 }] },
    ]}],
  },
]

beforeEach(() => {
  process.env.ODDS_API_KEY = "test"
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => SAMPLE }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe("fetchOdds", () => {
  it("no pide el mercado btts al endpoint general", async () => {
    const { fetchOdds } = await import("../data/odds-api")
    await fetchOdds("Canadá", "Bosnia y Herzegovina")
    const url = (globalThis.fetch as any).mock.calls[0][0] as string
    expect(url).toContain("markets=h2h,totals")
    expect(url).not.toContain("btts")
  })

  it("empareja por nombre ES contra evento EN y devuelve cuotas", async () => {
    const { fetchOdds } = await import("../data/odds-api")
    const odds = await fetchOdds("Canadá", "Bosnia y Herzegovina")
    expect(odds.length).toBeGreaterThan(0)
    const home = odds.find(o => o.market === "h2h" && o.selection === "Canada")
    expect(home?.odds).toBe(1.85)
  })

  it("traduce las selecciones totals a 'Over 2.5' / 'Under 2.5'", async () => {
    const { fetchOdds } = await import("../data/odds-api")
    const odds = await fetchOdds("Canadá", "Bosnia y Herzegovina")
    expect(odds.some(o => o.market === "totals" && o.selection === "Over 2.5")).toBe(true)
  })

  it("usa el last_update real del bookmaker, no Date.now()", async () => {
    const { fetchOdds } = await import("../data/odds-api")
    const odds = await fetchOdds("Canadá", "Bosnia y Herzegovina")
    expect(odds[0].updatedAt).toBe("2026-06-12T17:00:00Z")
  })

  it("no empareja el evento equivocado cuando solo coincide un equipo", async () => {
    const { fetchOdds } = await import("../data/odds-api")
    // Paraguay aparece en USA vs Paraguay; pedir 'Turquía vs Paraguay' no debe matchear ese evento
    const odds = await fetchOdds("Turquía", "Paraguay")
    expect(odds.length).toBe(0)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/odds-api.test.ts`
Expected: FAIL — hoy pide `btts`, no empareja ES/EN, y sella con `Date.now()`.

- [ ] **Step 3: Reescribir `src/lib/data/odds-api.ts`**

```typescript
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
    const res = await fetch(url, { next: { revalidate: 3600 } })
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
```

> Nota: `markets.ts:bestOdds` ya normaliza con `replace(/[^a-z0-9]/g,"")`, por lo que `"Canada"` matchea contra `data.teams.home.name` solo si ese nombre es el inglés. Para que el matching de selección 1X2 funcione con la DB en español, la Fase 3 (Task 3.3) ajusta `markets.ts` para emparejar selecciones por `matchesTeam`. Hasta entonces, la búsqueda de cuota 1X2 local puede no resolver; los tests de esta tarea validan solo el fetch.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run src/lib/__tests__/odds-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/odds-api.ts src/lib/__tests__/odds-api.test.ts
git commit -m "fix(odds): quitar btts del endpoint general, matchear nombres ES/EN y exigir ambos equipos"
```

---

## FASE 3 — Probabilidades ancladas al mercado

### Task 3.1: De-vig y consenso de mercado

**Files:**
- Create: `src/lib/model/devig.ts`
- Test: `src/lib/__tests__/devig.test.ts` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/devig.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { devig, median, consensusOdds } from "../model/devig"

describe("devig", () => {
  it("las probabilidades de-viggeadas suman 1", () => {
    const probs = devig([1.85, 3.35, 4.40])
    const sum = probs.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 6)
  })

  it("elimina el overround proporcionalmente (favorito sigue siendo favorito)", () => {
    const probs = devig([1.85, 3.35, 4.40])
    expect(probs[0]).toBeGreaterThan(probs[1])
    expect(probs[1]).toBeGreaterThan(probs[2])
    // Sin vig, la prob del favorito es menor que la implícita cruda (1/1.85=0.54)
    expect(probs[0]).toBeLessThan(1 / 1.85)
  })
})

describe("median", () => {
  it("calcula la mediana de un set impar", () => {
    expect(median([2.0, 1.85, 1.9])).toBe(1.9)
  })
  it("calcula la mediana de un set par", () => {
    expect(median([1.8, 1.9, 2.0, 2.2])).toBeCloseTo(1.95, 6)
  })
})

describe("consensusOdds", () => {
  it("agrega cuotas de varios bookmakers por selección (mediana)", () => {
    const odds = [
      { market: "h2h", selection: "Canada", odds: 1.80, bookmaker: "a", updatedAt: "" },
      { market: "h2h", selection: "Canada", odds: 1.90, bookmaker: "b", updatedAt: "" },
      { market: "h2h", selection: "Canada", odds: 1.85, bookmaker: "c", updatedAt: "" },
    ]
    const c = consensusOdds(odds, "h2h", ["Canada"])
    expect(c.get("Canada")).toBe(1.85)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/devig.test.ts`
Expected: FAIL — "Cannot find module '../model/devig'".

- [ ] **Step 3: Crear `src/lib/model/devig.ts`**

```typescript
import type { MarketOdds } from "../types"

// De-vig multiplicativo (proporcional): normaliza las probabilidades implícitas
// para que sumen 1, repartiendo el margen del bookmaker de forma proporcional.
export function devig(oddsSet: number[]): number[] {
  const implied = oddsSet.map(o => 1 / o)
  const overround = implied.reduce((s, p) => s + p, 0)
  if (overround <= 0) return implied
  return implied.map(p => p / overround)
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Cuota de consenso (mediana entre bookmakers) por selección, usando matching laxo
// de nombre de selección (minúsculas, solo alfanumérico) para tolerar variantes.
function normSel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function consensusOdds(
  odds: MarketOdds[],
  market: string,
  selections: string[],
): Map<string, number> {
  const result = new Map<string, number>()
  for (const sel of selections) {
    const target = normSel(sel)
    const prices = odds
      .filter(o => o.market === market && normSel(o.selection) === target)
      .map(o => o.odds)
    if (prices.length > 0) result.set(sel, median(prices))
  }
  return result
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run src/lib/__tests__/devig.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/model/devig.ts src/lib/__tests__/devig.test.ts
git commit -m "feat(model): de-vig multiplicativo y consenso de mercado por mediana"
```

### Task 3.2: Blend modelo/mercado

**Files:**
- Create: `src/lib/model/blend.ts`
- Test: `src/lib/__tests__/blend.test.ts` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/blend.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { blendProbability, MODEL_WEIGHT } from "../model/blend"

describe("blendProbability", () => {
  it("sin prob de mercado, devuelve la del modelo", () => {
    expect(blendProbability(0.62, null)).toBe(0.62)
  })

  it("mezcla hacia el mercado con el peso configurado", () => {
    const blended = blendProbability(0.62, 0.50)
    const expected = MODEL_WEIGHT * 0.62 + (1 - MODEL_WEIGHT) * 0.50
    expect(blended).toBeCloseTo(expected, 6)
  })

  it("el peso del modelo es conservador (<= 0.5)", () => {
    expect(MODEL_WEIGHT).toBeLessThanOrEqual(0.5)
    expect(MODEL_WEIGHT).toBeGreaterThan(0)
  })

  it("reduce el edge aparente: el blend queda entre modelo y mercado", () => {
    const blended = blendProbability(0.70, 0.50)
    expect(blended).toBeLessThan(0.70)
    expect(blended).toBeGreaterThan(0.50)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/blend.test.ts`
Expected: FAIL — "Cannot find module '../model/blend'".

- [ ] **Step 3: Crear `src/lib/model/blend.ts`**

```typescript
// Peso del modelo en la mezcla con el consenso de-viggeado del mercado.
// El consenso de 20+ bookmakers es el mejor predictor público; un modelo
// amateur debe anclarse a él y apostar solo una fracción del desacuerdo.
// Calibrable contra data/closing_odds.csv (ver scripts/calibrate.ts).
export const MODEL_WEIGHT = 0.35

export function blendProbability(modelProb: number, marketProb: number | null): number {
  if (marketProb === null) return modelProb
  return MODEL_WEIGHT * modelProb + (1 - MODEL_WEIGHT) * marketProb
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run src/lib/__tests__/blend.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/model/blend.ts src/lib/__tests__/blend.test.ts
git commit -m "feat(model): blend modelo/mercado con peso conservador y configurable"
```

### Task 3.3: Integrar de-vig + blend en el cálculo de mercados

**Files:**
- Modify: `src/lib/types.ts:97-111`
- Modify: `src/lib/engine/markets.ts`
- Test: `src/lib/__tests__/markets-blend.test.ts` (crear)

- [ ] **Step 1: Añadir campos a `MarketResult`**

En `src/lib/types.ts`, dentro de `interface MarketResult`, añadir tras `ourProbability`:

```typescript
  ourProbability: number          // prob usada para EV (blended con mercado)
  modelProbability: number        // prob cruda del modelo (debug/UI)
  marketProbability: number | null // consenso de-viggeado del mercado
```

- [ ] **Step 2: Escribir el test que falla**

Crear `src/lib/__tests__/markets-blend.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { calcAllMarkets } from "../engine/markets"
import { makeMockMatchData } from "./fixtures/mock-match-data"
import { buildScoreMatrix } from "../model/poisson"

describe("calcAllMarkets — blend con mercado", () => {
  it("1X2 expone modelProbability, marketProbability y ourProbability blended", () => {
    const data = makeMockMatchData()  // trae cuotas h2h España/Draw/Argentina
    const matrix = buildScoreMatrix(1.5, 1.2)
    const markets = calcAllMarkets(matrix, data)
    const home = markets.find(m => m.name === "1X2" && m.selection === "home")!
    expect(home.modelProbability).toBeGreaterThan(0)
    expect(home.marketProbability).not.toBeNull()
    // ourProbability queda entre modelo y mercado
    const lo = Math.min(home.modelProbability, home.marketProbability!)
    const hi = Math.max(home.modelProbability, home.marketProbability!)
    expect(home.ourProbability).toBeGreaterThanOrEqual(lo - 1e-9)
    expect(home.ourProbability).toBeLessThanOrEqual(hi + 1e-9)
  })

  it("marketProbability de las 3 vías 1X2 suma ~1 (de-viggeado)", () => {
    const data = makeMockMatchData()
    const matrix = buildScoreMatrix(1.5, 1.2)
    const markets = calcAllMarkets(matrix, data)
    const h = markets.find(m => m.name === "1X2" && m.selection === "home")!.marketProbability!
    const d = markets.find(m => m.name === "1X2" && m.selection === "draw")!.marketProbability!
    const a = markets.find(m => m.name === "1X2" && m.selection === "away")!.marketProbability!
    expect(h + d + a).toBeCloseTo(1.0, 6)
  })

  it("sin cuotas, ourProbability == modelProbability y no recomienda", () => {
    const data = makeMockMatchData({ odds: [] })
    const matrix = buildScoreMatrix(1.5, 1.2)
    const markets = calcAllMarkets(matrix, data)
    const home = markets.find(m => m.name === "1X2" && m.selection === "home")!
    expect(home.marketProbability).toBeNull()
    expect(home.ourProbability).toBe(home.modelProbability)
    expect(markets.every(m => !m.isRecommended)).toBe(true)
  })
})
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/markets-blend.test.ts`
Expected: FAIL — `markets.ts` aún no produce `modelProbability`/`marketProbability`.

- [ ] **Step 4: Reescribir `src/lib/engine/markets.ts`**

```typescript
import type { MatchData, MarketResult, MarketOdds } from "../types"
import { devig, consensusOdds, median } from "../model/devig"
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

function medianFor(odds: MarketOdds[], market: string, selMatch: (s: string) => boolean): number | null {
  const prices = odds.filter(o => o.market === market && selMatch(o.selection)).map(o => o.odds)
  return prices.length ? median(prices) : null
}
```

> `consensusOdds` queda disponible para otros usos pero aquí usamos el helper local `medianFor` con matchers (más flexible para nombres de selección por equipo). Ambos comparten `median`.

- [ ] **Step 5: Actualizar el mock y los tests afectados**

En `src/lib/__tests__/fixtures/mock-match-data.ts`, dentro de `makeMockMarketResult`, añadir los campos nuevos tras `ourProbability: 0.48,`:

```typescript
    ourProbability: 0.48,
    modelProbability: 0.50,
    marketProbability: 0.45,
```

En `src/lib/__tests__/sanity-vs-market.test.ts` (Task 1.3), confirmar que usa `modelProbability` (ya escrito así).

- [ ] **Step 6: Correr la suite de mercados**

Run: `pnpm vitest run src/lib/__tests__/markets-blend.test.ts src/lib/__tests__/engine.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/engine/markets.ts src/lib/__tests__/markets-blend.test.ts src/lib/__tests__/fixtures/mock-match-data.ts
git commit -m "feat(engine): EV sobre prob blended con consenso de-viggeado; matching de selecciones por nombre de equipo"
```

---

## FASE 4 — Motor estadístico

### Task 4.1: Dixon-Coles + normalización + extractMatchProbabilities

**Files:**
- Modify: `src/lib/model/poisson.ts`
- Test: `src/lib/__tests__/model.test.ts` (ya existe, hoy falla)

- [ ] **Step 1: Confirmar los tests que fallan hoy**

Run: `pnpm vitest run src/lib/__tests__/model.test.ts`
Expected: FAIL — `extractMatchProbabilities is not a function` y `matrix[0][0]` no supera Poisson puro (no hay Dixon-Coles).

- [ ] **Step 2: Modificar `src/lib/model/poisson.ts`**

Añadir la constante, el ajuste tau, normalización en `buildScoreMatrix`, y exportar `extractMatchProbabilities`. Reemplazar `buildScoreMatrix` (líneas 45-54) por:

```typescript
export const DIXON_COLES_RHO = -0.13

// Factor de dependencia de Dixon-Coles para corregir la sub-estimación de
// marcadores bajos del Poisson independiente.
function dixonColesTau(h: number, a: number, lambdaH: number, lambdaA: number, rho: number): number {
  if (h === 0 && a === 0) return 1 - lambdaH * lambdaA * rho
  if (h === 0 && a === 1) return 1 + lambdaH * rho
  if (h === 1 && a === 0) return 1 + lambdaA * rho
  if (h === 1 && a === 1) return 1 - rho
  return 1
}

export function buildScoreMatrix(lambdaHome: number, lambdaAway: number, maxGoals = 8): number[][] {
  const matrix: number[][] = []
  let total = 0
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = []
    for (let a = 0; a <= maxGoals; a++) {
      const base = poissonProb(lambdaHome, h) * poissonProb(lambdaAway, a)
      const adjusted = base * dixonColesTau(h, a, lambdaHome, lambdaAway, DIXON_COLES_RHO)
      matrix[h][a] = adjusted
      total += adjusted
    }
  }
  // Normalizar para que la matriz sume 1 tras el ajuste y el truncamiento.
  for (let h = 0; h <= maxGoals; h++)
    for (let a = 0; a <= maxGoals; a++)
      matrix[h][a] /= total
  return matrix
}

export interface MatchProbabilities {
  homeWin: number
  draw: number
  awayWin: number
}

export function extractMatchProbabilities(matrix: number[][]): MatchProbabilities {
  let homeWin = 0, draw = 0, awayWin = 0
  for (let h = 0; h < matrix.length; h++) {
    for (let a = 0; a < matrix[h].length; a++) {
      const p = matrix[h][a]
      if (h > a) homeWin += p
      else if (h === a) draw += p
      else awayWin += p
    }
  }
  return { homeWin, draw, awayWin }
}
```

> `predictMatch` (líneas 56-99) puede seguir usando `buildScoreMatrix`; ahora hereda Dixon-Coles automáticamente. No requiere cambios.

- [ ] **Step 3: Correr el test y verificar que pasa**

Run: `pnpm vitest run src/lib/__tests__/model.test.ts`
Expected: PASS (los 6 casos, incluidos los dos que fallaban).

- [ ] **Step 4: Commit**

```bash
git add src/lib/model/poisson.ts
git commit -m "feat(model): Dixon-Coles (rho=-0.13) con normalizacion y extractMatchProbabilities"
```

### Task 4.2: Confidence real (datos + cordura vs mercado)

**Files:**
- Modify: `src/lib/data/pipeline.ts:111-122` (renombrar a dataQuality puro)
- Modify: `src/lib/engine/analyzer.ts`
- Test: `src/lib/__tests__/confidence.test.ts` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/confidence.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { calcConfidence } from "../engine/analyzer"

describe("calcConfidence", () => {
  it("sin divergencia, confidence ~= dataQuality", () => {
    expect(calcConfidence(70, 0.03)).toBe(70)
  })

  it("divergencia grande vs mercado penaliza fuerte (puede caer bajo 40)", () => {
    // 25 puntos de divergencia en 1X2 -> probable bug o ruido
    expect(calcConfidence(55, 0.25)).toBeLessThan(40)
  })

  it("nunca devuelve fuera de [0,100]", () => {
    expect(calcConfidence(100, 0)).toBeLessThanOrEqual(100)
    expect(calcConfidence(40, 0.9)).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/confidence.test.ts`
Expected: FAIL — `calcConfidence` no existe.

- [ ] **Step 3: Implementar en `src/lib/engine/analyzer.ts`**

Añadir export y usarlo. Tras los imports, añadir:

```typescript
// Confidence = calidad de datos penalizada por divergencia modelo/mercado.
// Una divergencia grande en 1X2 casi nunca es "valor": suele ser ruido o bug,
// así que reduce la confianza y, por la regla <40, puede bloquear la recomendación.
export function calcConfidence(dataQuality: number, maxDivergence1x2: number): number {
  let confidence = dataQuality
  if (maxDivergence1x2 > 0.20) confidence -= 30
  else if (maxDivergence1x2 > 0.12) confidence -= 15
  else if (maxDivergence1x2 > 0.08) confidence -= 5
  return Math.max(0, Math.min(100, confidence))
}
```

Luego, dentro de `analyzeMatch`, después de calcular `markets` con `calcAllMarkets` (línea 80) y antes de `applyKellyToMarkets`, calcular la divergencia y el confidence real:

```typescript
  let markets = calcAllMarkets(matrix, data)

  // Divergencia máxima entre modelo y mercado en las 3 vías 1X2.
  const oneX2 = markets.filter(m => m.name === "1X2" && m.marketProbability !== null)
  const maxDivergence = oneX2.reduce(
    (mx, m) => Math.max(mx, Math.abs(m.modelProbability - (m.marketProbability ?? m.modelProbability))),
    0,
  )
  const confidence = calcConfidence(data.dataQuality, maxDivergence)

  const multiplier = confidenceMultiplier(confidence)
  markets = applyKellyToMarkets(markets, bankroll, multiplier, trialMode)
  markets = rankMarkets(markets)
```

Y en el `return`, cambiar `confidence: data.dataQuality` por `confidence`:

```typescript
  return {
    fixtureId: data.fixture.id,
    confidence,
    isPreliminary: !data.lineups.home || !data.lineups.away,
    model: modelOutput,
    markets,
    alerts,
    lastUpdated: new Date().toISOString(),
  }
```

> El campo `data.dataQuality` ya es la "calidad de datos" pura producida por `calcDataQuality` en pipeline.ts; no requiere renombre. El comentario de la línea 111-122 de pipeline.ts se actualiza para aclarar que es solo disponibilidad de datos.

- [ ] **Step 4: Ajustar el test de engine que fija confidence=55**

En `src/lib/__tests__/engine.test.ts:68`, el caso "devuelve MatchAnalysis con todos los campos requeridos" usa `makeMockMatchData()` con cuotas de mercado. Con confidence ahora dependiente de divergencia, reemplazar la aserción rígida:

```typescript
    expect(result.confidence).toBe(55)
```

por:

```typescript
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(100)
```

- [ ] **Step 5: Correr los tests**

Run: `pnpm vitest run src/lib/__tests__/confidence.test.ts src/lib/__tests__/engine.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine/analyzer.ts src/lib/data/pipeline.ts src/lib/__tests__/confidence.test.ts src/lib/__tests__/engine.test.ts
git commit -m "feat(engine): confidence real basado en calidad de datos y cordura vs mercado"
```

---

## FASE 5 — Kelly único y controles de riesgo

### Task 5.1: Kelly único sin floor forzado

**Files:**
- Modify: `src/lib/kelly/criterion.ts`
- Modify: `src/lib/engine/ev.ts`
- Test: `src/lib/__tests__/kelly.test.ts` (ampliar)

- [ ] **Step 1: Escribir/ampliar el test que falla**

En `src/lib/__tests__/kelly.test.ts`, añadir dentro de `describe("calcKelly", ...)`:

```typescript
  it("edge minúsculo produce fracción pequeña, no un piso de 0.5%", () => {
    // prob 0.51, odds 2.0 -> raw kelly ~0.02 ; con half 0.5 y conf 1 -> ~0.01
    const result = calcKelly({ probability: 0.51, odds: 2.0, bankroll: 100000, confidence: 80 })
    expect(result.fraction).toBeLessThan(0.02)
    expect(result.fraction).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/kelly.test.ts`
Expected: FAIL — hoy `Math.max(0.005, ...)` fuerza piso de 0.005.

- [ ] **Step 3: Modificar `src/lib/kelly/criterion.ts`**

Quitar el piso `MIN`. Reemplazar el bloque final de `calcKelly` (líneas 30-41) por:

```typescript
  const multiplier = confidenceMultiplier(confidence)

  // Half-Kelly (50%) salvo en modo prueba (primeros partidos), tope 8% / 0.5%.
  const halfKelly = trialMode ? 0.05 : 0.5
  const MAX = trialMode ? 0.005 : 0.08

  const adjusted = rawKelly * halfKelly * multiplier
  const capped = Math.min(MAX, Math.max(0, adjusted))
  const amount = Math.round(bankroll * capped)

  return { fraction: capped, amount, isNegative: false }
```

- [ ] **Step 4: Hacer que `ev.ts` delegue en `calcKelly`**

Reescribir `src/lib/engine/ev.ts`:

```typescript
import type { MarketResult } from "../types"
import { calcKelly } from "../kelly/criterion"

// confidenceMultiplier ya está dentro de calcKelly; aquí pasamos un confidence
// equivalente al multiplicador recibido para no duplicar la escala.
function multiplierToConfidence(mult: number): number {
  if (mult >= 1.0) return 80
  if (mult >= 0.75) return 60
  if (mult >= 0.5) return 40
  return 0
}

export function applyKellyToMarkets(
  markets: MarketResult[],
  bankroll: number,
  confidenceMultiplier: number,
  trialMode = false,
): MarketResult[] {
  const confidence = multiplierToConfidence(confidenceMultiplier)
  return markets.map(m => {
    if (m.EV === null || m.odds === null || !m.isRecommended) return m
    const k = calcKelly({ probability: m.ourProbability, odds: m.odds, bankroll, confidence, trialMode })
    return { ...m, kellyFraction: k.fraction, kellyAmount: k.amount }
  })
}

export function rankMarkets(markets: MarketResult[]): MarketResult[] {
  return [...markets].sort((a, b) => {
    if (a.isRecommended && !b.isRecommended) return -1
    if (!a.isRecommended && b.isRecommended) return 1
    return (b.EV ?? -Infinity) - (a.EV ?? -Infinity)
  })
}
```

- [ ] **Step 5: Correr la suite Kelly + engine**

Run: `pnpm vitest run src/lib/__tests__/kelly.test.ts src/lib/__tests__/engine.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/kelly/criterion.ts src/lib/engine/ev.ts src/lib/__tests__/kelly.test.ts
git commit -m "refactor(kelly): fuente unica de Kelly sin piso forzado; ev.ts delega en calcKelly"
```

### Task 5.2: Circuit breaker + límite diario en el registro de apuestas

**Files:**
- Modify: `src/app/actions.ts` (`registerBet`)
- Modify: `src/lib/kelly/portfolio.ts` (mantener `applyDailyLimit`, ya testeado)
- Test: `src/lib/__tests__/risk-controls.test.ts` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/risk-controls.test.ts` (prueba la lógica pura, sin DB):

```typescript
import { describe, it, expect } from "vitest"
import { checkBetAllowed } from "../kelly/portfolio"

describe("checkBetAllowed", () => {
  it("bloquea apuestas reales en modo paused", () => {
    const r = checkBetAllowed({ mode: "paused", bankroll: 100000, todayRealStaked: 0, newAmount: 5000, betMode: "real" })
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/pausa/i)
  })

  it("permite apuestas paper aunque esté paused", () => {
    const r = checkBetAllowed({ mode: "paused", bankroll: 100000, todayRealStaked: 0, newAmount: 5000, betMode: "paper" })
    expect(r.allowed).toBe(true)
  })

  it("recorta el monto si excede el 15% de exposición diaria", () => {
    const r = checkBetAllowed({ mode: "normal", bankroll: 100000, todayRealStaked: 13000, newAmount: 5000, betMode: "real" })
    expect(r.allowed).toBe(true)
    expect(r.adjustedAmount).toBe(2000) // 15000 max - 13000 ya apostado
  })

  it("permite el monto completo si hay margen", () => {
    const r = checkBetAllowed({ mode: "normal", bankroll: 100000, todayRealStaked: 0, newAmount: 5000, betMode: "real" })
    expect(r.adjustedAmount).toBe(5000)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/risk-controls.test.ts`
Expected: FAIL — `checkBetAllowed` no existe.

- [ ] **Step 3: Implementar en `src/lib/kelly/portfolio.ts`**

Añadir al final del archivo:

```typescript
export interface BetCheckInput {
  mode: "normal" | "conservative" | "paused"
  bankroll: number
  todayRealStaked: number
  newAmount: number
  betMode: "real" | "paper"
}

export interface BetCheckResult {
  allowed: boolean
  adjustedAmount: number
  reason?: string
}

const MAX_DAILY_EXPOSURE = 0.15

export function checkBetAllowed(input: BetCheckInput): BetCheckResult {
  const { mode, bankroll, todayRealStaked, newAmount, betMode } = input

  // Paper no consume bankroll ni riesgo real.
  if (betMode === "paper") return { allowed: true, adjustedAmount: newAmount }

  if (mode === "paused") {
    return { allowed: false, adjustedAmount: 0, reason: "Sistema en pausa por 5 pérdidas consecutivas" }
  }

  const maxAllowed = bankroll * MAX_DAILY_EXPOSURE
  const remaining = Math.max(0, maxAllowed - todayRealStaked)
  if (remaining <= 0) {
    return { allowed: false, adjustedAmount: 0, reason: "Límite de exposición diaria (15%) alcanzado" }
  }
  if (newAmount > remaining) {
    return { allowed: true, adjustedAmount: Math.round(remaining), reason: "Monto recortado al límite de exposición diaria" }
  }
  return { allowed: true, adjustedAmount: newAmount }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run src/lib/__tests__/risk-controls.test.ts`
Expected: PASS

- [ ] **Step 5: Conectar en `registerBet` (`src/app/actions.ts`)**

Reemplazar `registerBet` (líneas 77-80) por:

```typescript
export async function registerBet(bet: Omit<Bet, "id">): Promise<{ ok: boolean; id?: number; message?: string }> {
  const { getBankrollState } = await import("@/lib/kelly/bankroll")
  const { checkBetAllowed } = await import("@/lib/kelly/portfolio")
  const state = await getBankrollState(bet.userId)

  // Exposición real ya comprometida hoy (apuestas reales sin liquidar o de hoy).
  const today = new Date().toISOString().split("T")[0]
  const stakedRow = await db.execute({
    sql: `SELECT COALESCE(SUM(amount),0) AS s FROM bets
          WHERE mode='real' AND created_at >= ? ${bet.userId != null ? "AND user_id = ?" : ""}`,
    args: bet.userId != null ? [`${today}T00:00:00Z`, bet.userId] : [`${today}T00:00:00Z`],
  })
  const todayRealStaked = Number((stakedRow.rows[0] as any).s ?? 0)

  const check = checkBetAllowed({
    mode: state.mode,
    bankroll: state.current,
    todayRealStaked,
    newAmount: bet.amount,
    betMode: bet.mode,
  })
  if (!check.allowed) return { ok: false, message: check.reason }

  const id = await saveBet({ ...bet, amount: check.adjustedAmount })
  return { ok: true, id, message: check.reason }
}
```

- [ ] **Step 6: Actualizar los dos llamadores de `registerBet`**

En `src/components/BetModal.tsx` (líneas 24-48), capturar el resultado:

```typescript
  const handleConfirm = () => {
    startTransition(async () => {
      const res = await registerBet({ /* ...campos iguales... */ })
      if (!res.ok) { setMessage(res.message ?? "Apuesta rechazada"); return }
      setMessage(
        res.message
          ? `Registrada con ajuste — $${amount.toLocaleString("es-CO")} COP (${res.message})`
          : `Apuesta registrada — $${amount.toLocaleString("es-CO")} COP`,
      )
      timerRef.current = setTimeout(() => onClose(true), 1500)
    })
  }
```

En `src/components/MarketBettingCard.tsx` (`handleConfirmBet`, líneas 69-97), tras el `await registerBet(...)`:

```typescript
    const res = await registerBet({ /* ...campos iguales... */ })
    setConfirming(null)
    if (!res.ok) { alert(res.message ?? "Apuesta rechazada por control de riesgo"); return }
    setRegistering(null)
    setRegistered(prev => new Map(prev).set(key, mode))
```

- [ ] **Step 7: Correr suite + typecheck**

Run: `pnpm vitest run && pnpm exec tsc --noEmit`
Expected: PASS / sin errores de tipos.

- [ ] **Step 8: Commit**

```bash
git add src/lib/kelly/portfolio.ts src/app/actions.ts src/components/BetModal.tsx src/components/MarketBettingCard.tsx src/lib/__tests__/risk-controls.test.ts
git commit -m "feat(risk): circuit breaker y limite de exposicion diaria aplicados al registrar apuestas"
```

### Task 5.3: settleBet actualiza el bankroll

**Files:**
- Modify: `src/app/actions.ts` (`settleBetAction`)
- Test: `src/lib/__tests__/settle-bankroll.test.ts` (crear, prueba pura del cálculo)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/settle-bankroll.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { nextBalanceAfterSettle } from "../kelly/bankroll"

describe("nextBalanceAfterSettle", () => {
  it("suma la ganancia neta en un win", () => {
    expect(nextBalanceAfterSettle(100000, "win", 5000, 1.9)).toBe(100000 + Math.round(5000 * 0.9))
  })
  it("resta el stake en un loss", () => {
    expect(nextBalanceAfterSettle(100000, "loss", 5000, 1.9)).toBe(95000)
  })
  it("no cambia en void", () => {
    expect(nextBalanceAfterSettle(100000, "void", 5000, 1.9)).toBe(100000)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/settle-bankroll.test.ts`
Expected: FAIL — `nextBalanceAfterSettle` no existe.

- [ ] **Step 3: Implementar en `src/lib/kelly/bankroll.ts`**

Añadir export:

```typescript
export function nextBalanceAfterSettle(
  current: number,
  result: "win" | "loss" | "void",
  amount: number,
  oddsUsed: number,
): number {
  if (result === "win") return current + Math.round(amount * (oddsUsed - 1))
  if (result === "loss") return current - amount
  return current
}
```

- [ ] **Step 4: Conectar en `settleBetAction` (`src/app/actions.ts`)**

Tras el `UPDATE bets ...` (línea 387-390), y solo para apuestas reales, registrar un snapshot diario nuevo:

```typescript
    await db.execute({
      sql: `UPDATE bets SET result = ?, profit_loss = ?, settled_at = ? WHERE id = ?`,
      args: [result, profitLoss, new Date().toISOString(), betId],
    })

    if (bet.mode === "real") {
      const { getBankrollState, nextBalanceAfterSettle, updateBankroll } = await import("@/lib/kelly/bankroll")
      const state = await getBankrollState(bet.user_id ?? undefined)
      const nextBalance = nextBalanceAfterSettle(state.current, result, bet.amount, bet.odds_used)
      await updateBankroll(nextBalance, "daily", bet.user_id ?? undefined)
    }
```

- [ ] **Step 5: Correr suite + typecheck**

Run: `pnpm vitest run src/lib/__tests__/settle-bankroll.test.ts && pnpm exec tsc --noEmit`
Expected: PASS / sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/kelly/bankroll.ts src/app/actions.ts src/lib/__tests__/settle-bankroll.test.ts
git commit -m "feat(bankroll): settle de apuestas reales actualiza el bankroll (Kelly dimensiona sobre saldo real)"
```

---

## FASE 6 — CLV / closing odds

### Task 6.1: Captura de closing odds

**Files:**
- Modify: `src/app/actions.ts` (nueva `captureClosingOddsAction`)
- Modify: `scripts/pre-match-cron.ts`
- Test: `src/lib/__tests__/clv.test.ts` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/clv.test.ts` (prueba la función pura de selección de cuota de cierre por apuesta):

```typescript
import { describe, it, expect } from "vitest"
import { closingOddsForBet } from "../kelly/metrics"
import type { MarketOdds } from "../types"

const closing: MarketOdds[] = [
  { market: "h2h", selection: "Canada", odds: 1.75, bookmaker: "a", updatedAt: "" },
  { market: "h2h", selection: "Canada", odds: 1.80, bookmaker: "b", updatedAt: "" },
  { market: "totals", selection: "Over 2.5", odds: 2.05, bookmaker: "a", updatedAt: "" },
]

describe("closingOddsForBet", () => {
  it("devuelve la mediana de cierre para 1X2 home por nombre de equipo", () => {
    const o = closingOddsForBet(closing, "1X2", "home", "Canadá", "Bosnia y Herzegovina")
    expect(o).toBeCloseTo(1.775, 3)
  })
  it("devuelve la cuota de cierre para Over 2.5", () => {
    const o = closingOddsForBet(closing, "Over/Under", "over_2.5", "Canadá", "Bosnia y Herzegovina")
    expect(o).toBe(2.05)
  })
  it("null cuando no hay cuota de cierre para esa selección", () => {
    const o = closingOddsForBet(closing, "BTTS", "yes", "Canadá", "Bosnia y Herzegovina")
    expect(o).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/clv.test.ts`
Expected: FAIL — `closingOddsForBet` no existe.

- [ ] **Step 3: Implementar en `src/lib/kelly/metrics.ts`**

Añadir (reusa `median` de devig y `matchesTeam`):

```typescript
import type { MarketOdds } from "../types"
import { median } from "../model/devig"
import { matchesTeam } from "../data/team-names"

export function closingOddsForBet(
  closing: MarketOdds[],
  market: string,
  selection: string,
  homeName: string,
  awayName: string,
): number | null {
  let matcher: (o: MarketOdds) => boolean
  if (market === "1X2") {
    if (selection === "home") matcher = o => o.market === "h2h" && matchesTeam(o.selection, homeName)
    else if (selection === "away") matcher = o => o.market === "h2h" && matchesTeam(o.selection, awayName)
    else matcher = o => o.market === "h2h" && o.selection.toLowerCase().replace(/[^a-z]/g, "") === "draw"
  } else if (market === "Over/Under") {
    const label = selection.replace("over_", "Over ").replace("under_", "Under ").replace("_", " ").replace(/\s+/g, " ").trim()
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]/g, "")
    matcher = o => o.market === "totals" && norm(o.selection) === norm(label)
  } else if (market === "BTTS") {
    matcher = o => o.market === "btts" && o.selection.toLowerCase() === (selection === "yes" ? "yes" : "no")
  } else {
    return null
  }
  const prices = closing.filter(matcher).map(o => o.odds)
  return prices.length ? median(prices) : null
}
```

> El `import` de `Bet` existente en metrics.ts se mantiene; añadir estos nuevos imports al tope sin duplicar.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run src/lib/__tests__/clv.test.ts`
Expected: PASS

- [ ] **Step 5: Añadir `captureClosingOddsAction` a `src/app/actions.ts`**

```typescript
export async function captureClosingOddsAction(fixtureId: number): Promise<{ ok: boolean; updated: number; message: string }> {
  try {
    const { fetchOdds } = await import("@/lib/data/odds-api")
    const { closingOddsForBet } = await import("@/lib/kelly/metrics")

    const fx = await db.execute({
      sql: `SELECT ht.name AS home, at.name AS away FROM fixtures f
            JOIN teams ht ON ht.id = f.home_team_id JOIN teams at ON at.id = f.away_team_id
            WHERE f.id = ?`,
      args: [fixtureId],
    })
    const row = fx.rows[0] as any
    if (!row) return { ok: false, updated: 0, message: "Fixture no encontrado" }

    const closing = await fetchOdds(row.home, row.away)
    if (closing.length === 0) return { ok: true, updated: 0, message: "Sin cuotas de cierre disponibles" }

    const bets = await db.execute({
      sql: `SELECT id, market, selection FROM bets WHERE fixture_id = ? AND odds_closing IS NULL`,
      args: [fixtureId],
    })

    let updated = 0
    for (const b of bets.rows as any[]) {
      const oc = closingOddsForBet(closing, b.market, b.selection, row.home, row.away)
      if (oc != null) {
        await db.execute({ sql: `UPDATE bets SET odds_closing = ? WHERE id = ?`, args: [oc, b.id] })
        updated++
      }
    }
    return { ok: true, updated, message: `${updated} apuesta(s) con cuota de cierre` }
  } catch (err: any) {
    return { ok: false, updated: 0, message: err?.message ?? "Error capturando closing odds" }
  }
}
```

- [ ] **Step 6: Invocar en el pre-match cron**

En `scripts/pre-match-cron.ts`, dentro del bucle `for (const fixture of targets)`, tras `fetchOdds` (línea 55-59), añadir la captura de cierre para apuestas abiertas:

```typescript
    // Captura de closing odds para CLV (apuestas ya registradas en este fixture).
    const { closingOddsForBet } = await import("../src/lib/kelly/metrics")
    const openBets = await db.execute({
      sql: `SELECT id, market, selection FROM bets WHERE fixture_id = ? AND odds_closing IS NULL`,
      args: [fixture.id],
    })
    let clvUpdated = 0
    for (const b of openBets.rows as any[]) {
      const oc = closingOddsForBet(odds, b.market, b.selection, home.name, away.name)
      if (oc != null) {
        await db.execute({ sql: `UPDATE bets SET odds_closing = ? WHERE id = ?`, args: [oc, b.id] })
        clvUpdated++
      }
    }
    if (clvUpdated > 0) console.log(`[pre-match] ${clvUpdated} cuota(s) de cierre capturadas (fixture ${fixture.id})`)
```

- [ ] **Step 7: Correr suite + typecheck**

Run: `pnpm vitest run && pnpm exec tsc --noEmit`
Expected: PASS / sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/lib/kelly/metrics.ts src/app/actions.ts scripts/pre-match-cron.ts src/lib/__tests__/clv.test.ts
git commit -m "feat(clv): captura de closing odds en pre-match para medir CLV desde la primera apuesta"
```

---

## FASE 7 — Señales contextuales reales

### Task 7.1: H2H con decaimiento temporal por meses

**Files:**
- Modify: `src/lib/model/h2h.ts`
- Test: `src/lib/__tests__/h2h-decay.test.ts` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/h2h-decay.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { calcH2HFactor } from "../model/h2h"
import type { H2HRecord } from "../types"

const now = new Date()
function monthsAgo(m: number): string {
  const d = new Date(now); d.setMonth(d.getMonth() - m); return d.toISOString()
}

describe("calcH2HFactor — decaimiento temporal", () => {
  it("un partido de hace 90 años no mueve el multiplicador", () => {
    const ancient: H2HRecord[] = [
      { date: "1930-07-17T00:00:00Z", homeTeamId: 1, awayTeamId: 2, homeGoals: 0, awayGoals: 3, competition: "world_cup" },
    ]
    const f = calcH2HFactor(ancient, 1)
    expect(f.attackMultiplier).toBeCloseTo(1.0, 2)
  })

  it("victorias recientes pesan y suben el multiplicador del ganador", () => {
    const recent: H2HRecord[] = [
      { date: monthsAgo(2), homeTeamId: 1, awayTeamId: 2, homeGoals: 3, awayGoals: 0, competition: "continental" },
      { date: monthsAgo(6), homeTeamId: 1, awayTeamId: 2, homeGoals: 2, awayGoals: 1, competition: "continental" },
      { date: monthsAgo(10), homeTeamId: 2, awayTeamId: 1, homeGoals: 0, awayGoals: 2, competition: "friendly" },
    ]
    const f = calcH2HFactor(recent, 1)
    expect(f.attackMultiplier).toBeGreaterThan(1.0)
  })

  it("respeta el cap ±15%", () => {
    const all: H2HRecord[] = Array.from({ length: 5 }, (_, i) => ({
      date: monthsAgo(i + 1), homeTeamId: 1, awayTeamId: 2, homeGoals: 5, awayGoals: 0, competition: "world_cup" as const,
    }))
    const f = calcH2HFactor(all, 1)
    expect(f.attackMultiplier).toBeLessThanOrEqual(1.15)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/h2h-decay.test.ts`
Expected: FAIL — hoy `calcH2HFactor` no aplica decaimiento por fecha (el partido de 1930 cuenta full por ser world_cup).

- [ ] **Step 3: Reescribir `src/lib/model/h2h.ts`**

```typescript
import type { H2HRecord } from "../types"

export interface H2HFactor {
  attackMultiplier: number
  adjustmentDescription: string
}

function monthsBetween(dateIso: string, ref = new Date()): number {
  const d = new Date(dateIso)
  if (isNaN(d.getTime())) return 9999
  return (ref.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
}

export function calcH2HFactor(records: H2HRecord[], teamId: number): H2HFactor {
  if (!records.length) return { attackMultiplier: 1.0, adjustmentDescription: "" }

  // Ordenar por fecha desc y tomar los más recientes.
  const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)

  let wins = 0, matches = 0
  for (const r of sorted) {
    const months = monthsBetween(r.date)
    // Decaimiento temporal: e^(-0.1 * meses). Un partido de hace años pesa ~0.
    const timeWeight = Math.exp(-0.1 * months)
    if (timeWeight < 0.01) continue // descarta partidos demasiado antiguos
    const compWeight = r.competition === "world_cup" ? 1.5 : r.competition === "continental" ? 1.2 : 1.0
    const weight = timeWeight * compWeight

    const isHome = r.homeTeamId === teamId
    const goalsFor = isHome ? r.homeGoals : r.awayGoals
    const goalsAgainst = isHome ? r.awayGoals : r.homeGoals
    wins += goalsFor > goalsAgainst ? weight : 0
    matches += weight
  }

  if (matches < 0.05) return { attackMultiplier: 1.0, adjustmentDescription: "" }

  const winRate = wins / matches
  let multiplier = 1.0
  if (winRate >= 0.7) multiplier = 1.10
  else if (winRate >= 0.5) multiplier = 1.05
  else if (winRate <= 0.2) multiplier = 0.90
  else if (winRate <= 0.4) multiplier = 0.95

  multiplier = Math.max(0.85, Math.min(1.15, multiplier))
  const desc = multiplier !== 1.0
    ? `H2H ponderado: ${(winRate * 100).toFixed(0)}% wins → x${multiplier.toFixed(2)}`
    : ""
  return { attackMultiplier: multiplier, adjustmentDescription: desc }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run src/lib/__tests__/h2h-decay.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/model/h2h.ts src/lib/__tests__/h2h-decay.test.ts
git commit -m "feat(model): H2H con decaimiento temporal por meses y descarte de partidos antiguos"
```

### Task 7.2: Form con decaimiento por meses y opponentRanking real

**Files:**
- Modify: `src/lib/model/form.ts`
- Modify: `src/lib/data/api-football.ts:93-107`
- Modify: `src/lib/data/csv-loader.ts:191-202`
- Test: `src/lib/__tests__/form-decay.test.ts` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/form-decay.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { calcFormFactor } from "../model/form"
import type { FormRecord } from "../types"

const now = new Date()
function monthsAgo(m: number): string {
  const d = new Date(now); d.setMonth(d.getMonth() - m); return d.toISOString()
}

describe("calcFormFactor — decaimiento por meses + opponentRanking real", () => {
  it("buena forma reciente sube el factor", () => {
    const recs: FormRecord[] = [
      { date: monthsAgo(1), opponentRanking: 10, goalsFor: 3, goalsAgainst: 0, isHome: true },
      { date: monthsAgo(2), opponentRanking: 15, goalsFor: 2, goalsAgainst: 0, isHome: false },
      { date: monthsAgo(3), opponentRanking: 20, goalsFor: 2, goalsAgainst: 1, isHome: true },
    ]
    expect(calcFormFactor(recs).factor).toBeGreaterThan(1.0)
  })

  it("ganarle a rivales fuertes (ranking bajo) pesa más que a débiles", () => {
    const vsStrong: FormRecord[] = [{ date: monthsAgo(1), opponentRanking: 3, goalsFor: 2, goalsAgainst: 0, isHome: true }]
    const vsWeak: FormRecord[] = [{ date: monthsAgo(1), opponentRanking: 120, goalsFor: 2, goalsAgainst: 0, isHome: true }]
    expect(calcFormFactor(vsStrong).factor).toBeGreaterThanOrEqual(calcFormFactor(vsWeak).factor)
  })

  it("mala racha reciente baja el factor", () => {
    const recs: FormRecord[] = [
      { date: monthsAgo(1), opponentRanking: 50, goalsFor: 0, goalsAgainst: 2, isHome: true },
      { date: monthsAgo(2), opponentRanking: 50, goalsFor: 0, goalsAgainst: 3, isHome: false },
    ]
    expect(calcFormFactor(recs).factor).toBeLessThan(1.0)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/form-decay.test.ts`
Expected: FAIL — hoy el decaimiento es por índice, no por fecha; el test vsStrong/vsWeak puede pasar por casualidad pero el de decaimiento por meses no está garantizado.

- [ ] **Step 3: Reescribir `src/lib/model/form.ts`**

```typescript
import type { FormRecord } from "../types"

export interface FormFactor {
  factor: number
  description: string
}

function monthsBetween(dateIso: string, ref = new Date()): number {
  const d = new Date(dateIso)
  if (isNaN(d.getTime())) return 0
  return (ref.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
}

export function calcFormFactor(records: FormRecord[]): FormFactor {
  if (!records.length) return { factor: 1.0, description: "" }

  const recent = [...records]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6)

  let weightedScore = 0
  let totalWeight = 0
  for (const r of recent) {
    // Decaimiento temporal por meses (coherente con CLAUDE.md).
    const weight = Math.exp(-0.1 * monthsBetween(r.date))
    const scored = r.goalsFor > 0 ? 1 : 0
    const won = r.goalsFor > r.goalsAgainst ? 1 : 0
    const drew = r.goalsFor === r.goalsAgainst ? 0.5 : 0
    // opponentRanking real: ganar a un top (ranking bajo) vale más.
    const opponentFactor = 1 + (50 - r.opponentRanking) * 0.005

    weightedScore += (won + drew + scored * 0.3) * opponentFactor * weight
    totalWeight += weight
  }
  if (totalWeight === 0) return { factor: 1.0, description: "" }

  const normalizedScore = weightedScore / totalWeight
  let factor = 1.0
  let description = ""
  if (normalizedScore >= 1.5) { factor = 1.08; description = "Buena forma reciente" }
  else if (normalizedScore >= 1.0) { factor = 1.03 }
  else if (normalizedScore <= 0.3) { factor = 0.92; description = "Mala racha reciente" }
  else if (normalizedScore <= 0.6) { factor = 0.97 }

  return { factor, description }
}
```

- [ ] **Step 4: Poblar `opponentRanking` real en las fuentes**

En `src/lib/data/api-football.ts`, `fetchRecentForm` (líneas 93-107) — pasar el ranking del rival desde la tabla `teams` cuando exista. Reemplazar el cuerpo por una versión que consulta el ranking:

```typescript
export async function fetchRecentForm(teamId: number): Promise<FormRecord[]> {
  const data = await apiFetch<any>(
    `/fixtures?team=${teamId}&last=6&league=${WC_2026_LEAGUE_ID}&season=${WC_2026_SEASON}`
  )
  const { db } = await import("../db/client")
  return Promise.all((data.response ?? []).map(async (f: any) => {
    const isHome = f.teams.home.id === teamId
    const opponentId = isHome ? f.teams.away.id : f.teams.home.id
    let opponentRanking = 50
    try {
      const r = await db.execute({ sql: "SELECT fifa_ranking FROM teams WHERE id = ?", args: [opponentId] })
      opponentRanking = Number((r.rows[0] as any)?.fifa_ranking ?? 50)
    } catch { /* sin DB disponible: neutral */ }
    return {
      date: f.fixture.date,
      opponentRanking,
      goalsFor: isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0),
      goalsAgainst: isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0),
      isHome,
    }
  }))
}
```

En `src/lib/data/csv-loader.ts`, `loadTeamFormRecords` (líneas 191-202): el CSV `teams_form.csv` no trae rival por fila (son medias móviles), así que `opponentRanking` se mantiene neutral (50) pero documentado. Añadir comentario sobre la fila 197:

```typescript
    opponentRanking: 50, // teams_form.csv son medias móviles sin rival por fila; neutral a propósito
```

- [ ] **Step 5: Correr el test y la suite**

Run: `pnpm vitest run src/lib/__tests__/form-decay.test.ts && pnpm vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/model/form.ts src/lib/data/api-football.ts src/lib/data/csv-loader.ts src/lib/__tests__/form-decay.test.ts
git commit -m "feat(model): form con decaimiento por meses y opponentRanking real desde la DB"
```

### Task 7.3: Rest days reales desde el calendario

**Files:**
- Modify: `src/lib/data/pipeline.ts`
- Modify: `src/lib/engine/analyzer.ts:34-43`
- Test: `src/lib/__tests__/rest-days.test.ts` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/rest-days.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { restDaysFromFixtures } from "../data/pipeline"

describe("restDaysFromFixtures", () => {
  it("calcula los días desde el último partido", () => {
    const prev = "2026-06-08T18:00:00Z"
    const current = "2026-06-12T18:00:00Z"
    expect(restDaysFromFixtures(prev, current)).toBe(4)
  })
  it("devuelve un valor neutral alto si no hay partido previo", () => {
    expect(restDaysFromFixtures(null, "2026-06-12T18:00:00Z")).toBeGreaterThanOrEqual(5)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run src/lib/__tests__/rest-days.test.ts`
Expected: FAIL — `restDaysFromFixtures` no existe.

- [ ] **Step 3: Implementar en `src/lib/data/pipeline.ts`**

Añadir export:

```typescript
export function restDaysFromFixtures(previousMatchDate: string | null, currentMatchDate: string): number {
  if (!previousMatchDate) return 5 // neutral: sin dato, no penaliza
  const prev = new Date(previousMatchDate).getTime()
  const cur = new Date(currentMatchDate).getTime()
  if (isNaN(prev) || isNaN(cur)) return 5
  return Math.round((cur - prev) / (1000 * 60 * 60 * 24))
}
```

Y dentro de `buildMatchData`, calcular el descanso real consultando el partido anterior de cada equipo y añadirlo a `MatchData`. Tras resolver `fixture` (antes del `return`), añadir:

```typescript
  const { db } = await import("../db/client")
  async function lastMatchDateBefore(teamId: number, date: string): Promise<string | null> {
    try {
      const r = await db.execute({
        sql: `SELECT match_date FROM fixtures
              WHERE (home_team_id = ? OR away_team_id = ?) AND match_date < ?
              ORDER BY match_date DESC LIMIT 1`,
        args: [teamId, teamId, date],
      })
      return (r.rows[0] as any)?.match_date ?? null
    } catch { return null }
  }
  const homeRestDays = restDaysFromFixtures(await lastMatchDateBefore(homeTeam.id, fixture.date), fixture.date)
  const awayRestDays = restDaysFromFixtures(await lastMatchDateBefore(awayTeam.id, fixture.date), fixture.date)
```

Añadir `restDays` a `MatchData`. En `src/lib/types.ts`, dentro de `interface MatchData`, tras `fetchedAt: string`:

```typescript
  restDays?: { home: number; away: number }
```

Y en el objeto `return` de `buildMatchData`:

```typescript
    fetchedAt: new Date().toISOString(),
    restDays: { home: homeRestDays, away: awayRestDays },
```

- [ ] **Step 4: Usar rest days reales en el analyzer**

En `src/lib/engine/analyzer.ts`, en `calcContextAdjustments` (líneas 34-43), reemplazar los `homeRestDays: 5 / awayRestDays: 5` hardcodeados:

```typescript
    homeRestDays: data.restDays?.home ?? 5,
    awayRestDays: data.restDays?.away ?? 5,
```

- [ ] **Step 5: Correr el test y la suite**

Run: `pnpm vitest run src/lib/__tests__/rest-days.test.ts && pnpm vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/pipeline.ts src/lib/engine/analyzer.ts src/lib/types.ts src/lib/__tests__/rest-days.test.ts
git commit -m "feat(model): descanso real desde el calendario en lugar de 5 dias hardcodeados"
```

---

## FASE 8 — Cron real + calibración

### Task 8.1: cron diario guarda análisis real (no stubs)

**Files:**
- Modify: `scripts/cron.ts`

- [ ] **Step 1: Reescribir `scripts/cron.ts`**

El cron debe ejecutar el pipeline + analyzer completo y persistir los mercados, replicando lo que hace `runDailyCronAction` en actions.ts pero como script. Reemplazar `saveAnalysisStub` y el bucle por análisis real:

```typescript
import { db } from "../src/lib/db/client"
import { migrate } from "../src/lib/db/schema"
import { seed } from "../src/lib/db/seed"
import { fetchTodayFixtures } from "../src/lib/data/api-football"
import { buildMatchData } from "../src/lib/data/pipeline"
import { analyzeMatch } from "../src/lib/engine/analyzer"
import { getBankrollState } from "../src/lib/kelly/bankroll"
import type { TeamStrength } from "../src/lib/types"

async function getTeamStrengths(): Promise<Map<number, TeamStrength>> {
  const result = await db.execute("SELECT * FROM teams")
  const map = new Map<number, TeamStrength>()
  for (const row of result.rows as any[]) {
    map.set(row.id, {
      id: row.id, name: row.name, country: row.country, groupName: row.group_name,
      fifaRanking: row.fifa_ranking, attackStrength: row.attack_strength, defenseStrength: row.defense_strength,
    })
  }
  return map
}

async function saveAnalysis(fixtureId: number, analysis: any, dataQuality: number, home: string, away: string) {
  const ts = new Date().toISOString()
  const existing = await db.execute({ sql: "SELECT id FROM match_analyses WHERE fixture_id = ? ORDER BY created_at DESC LIMIT 1", args: [fixtureId] })
  const argsCommon = [
    analysis.isPreliminary ? 1 : 0, analysis.confidence,
    analysis.model.lambdaHome, analysis.model.lambdaAway,
    JSON.stringify(analysis.model.adjustmentsApplied),
    JSON.stringify(analysis.markets), JSON.stringify(analysis.alerts),
    dataQuality, home, away, ts,
  ]
  if (existing.rows.length > 0) {
    await db.execute({
      sql: `UPDATE match_analyses SET is_preliminary=?, confidence=?, lambda_home=?, lambda_away=?,
            adjustments_applied=?, markets=?, alerts=?, data_quality=?, home_team=?, away_team=?, created_at=? WHERE id=?`,
      args: [...argsCommon, (existing.rows[0] as any).id],
    })
    await db.execute({ sql: "DELETE FROM match_analyses WHERE fixture_id = ? AND id != ?", args: [fixtureId, (existing.rows[0] as any).id] })
  } else {
    await db.execute({
      sql: `INSERT INTO match_analyses (is_preliminary, confidence, lambda_home, lambda_away,
            adjustments_applied, markets, alerts, data_quality, home_team, away_team, created_at, fixture_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [...argsCommon, fixtureId],
    })
  }
}

async function run() {
  console.log("[cron] Iniciando pipeline diario...")
  await migrate()
  await seed()
  const teams = await getTeamStrengths()
  const bankroll = await getBankrollState()
  const fixtures = await fetchTodayFixtures()
  console.log(`[cron] ${fixtures.length} partidos hoy`)

  for (const fixture of fixtures) {
    const home = teams.get(fixture.homeTeamId)
    const away = teams.get(fixture.awayTeamId)
    if (!home || !away) { console.warn(`[cron] Equipos no encontrados: ${fixture.homeTeamId} vs ${fixture.awayTeamId}`); continue }
    try {
      const matchData = await buildMatchData(fixture, home, away)
      const analysis = analyzeMatch(matchData, bankroll.current, bankroll.trialMode)
      await saveAnalysis(fixture.id, analysis, matchData.dataQuality, home.name, away.name)
      const recs = analysis.markets.filter((m: any) => m.isRecommended).length
      console.log(`[cron] ${home.name} vs ${away.name} — conf ${analysis.confidence}, ${recs} recomendacion(es)`)
    } catch (err) {
      console.error(`[cron] Error en fixture ${fixture.id}:`, err)
    }
  }
  console.log("[cron] Pipeline diario completado")
  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Verificar que corre sin errores (con .env.local real)**

Run: `pnpm cron:run`
Expected: imprime los 2 partidos de hoy con su confidence y conteo de recomendaciones; sin excepciones.

- [ ] **Step 3: Commit**

```bash
git add scripts/cron.ts
git commit -m "fix(cron): el cron diario ejecuta el analisis completo y persiste mercados reales"
```

### Task 8.2: Script de calibración contra closing_odds.csv

**Files:**
- Create: `scripts/calibrate.ts`
- Modify: `package.json` (script `calibrate:run`)

- [ ] **Step 1: Crear `scripts/calibrate.ts`**

Reusa la infraestructura del backtest (`scripts/backtest/`), ejecuta el modelo sobre los partidos históricos disponibles y reporta calibración (predicho vs real por decil) y Brier score, además del impacto del `MODEL_WEIGHT` actual. El objetivo es validar w antes de habilitar dinero real.

```typescript
import path from "path"
import { loadAll, buildMatchData } from "./backtest/builder"
import { analyzeMatch } from "../src/lib/engine/analyzer"
import { resolveMarket } from "./backtest/resolver"

const DATA = path.resolve(process.cwd(), "data")

interface Bucket { total: number; wins: number; sumPred: number }

async function main() {
  console.log("=== CALIBRACIÓN DEL MODELO ===\n")
  const loaders = loadAll(DATA)
  const matches = loaders.matches

  const buckets: Bucket[] = Array.from({ length: 10 }, () => ({ total: 0, wins: 0, sumPred: 0 }))
  let brierSum = 0, brierN = 0

  for (const match of matches) {
    const md = buildMatchData(match.home, match.away, match.date, match.fixtureId, loaders, match.stage)
    const analysis = analyzeMatch(md, 100000)

    // Calibrar sobre 1X2 (las 3 vías) usando ourProbability (blended).
    for (const sel of ["home", "draw", "away"] as const) {
      const m = analysis.markets.find(mk => mk.name === "1X2" && mk.selection === sel)
      if (!m) continue
      const p = m.ourProbability
      const result = resolveMarket("1X2", sel, match.homeScore, match.awayScore)
      const won = result === "win" ? 1 : 0
      const decile = Math.min(9, Math.floor(p * 10))
      buckets[decile].total++
      buckets[decile].wins += won
      buckets[decile].sumPred += p
      brierSum += (p - won) ** 2
      brierN++
    }
  }

  console.log("Decil  | Predicho medio | Real    | N")
  console.log("-------|----------------|---------|----")
  buckets.forEach((b, i) => {
    if (b.total === 0) return
    const pred = (b.sumPred / b.total * 100).toFixed(1)
    const real = (b.wins / b.total * 100).toFixed(1)
    console.log(`${`${i*10}-${(i+1)*10}%`.padEnd(7)}| ${pred.padEnd(15)}| ${real.padEnd(8)}| ${b.total}`)
  })
  console.log(`\nBrier score (1X2): ${(brierSum / brierN).toFixed(4)}  (menor es mejor; 0.20 es buen objetivo)`)
  console.log("Si 'Predicho' supera sistemáticamente a 'Real', el modelo está sobreconfiado: bajar MODEL_WEIGHT en src/lib/model/blend.ts")
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Añadir script en `package.json`**

En la sección `scripts`, tras `"backtest:run": ...`, añadir:

```json
    "calibrate:run": "tsx --env-file=.env.local scripts/calibrate.ts"
```

- [ ] **Step 3: Verificar que corre**

Run: `pnpm calibrate:run`
Expected: imprime la tabla de calibración por decil y el Brier score sin excepciones.

- [ ] **Step 4: Commit**

```bash
git add scripts/calibrate.ts package.json
git commit -m "feat(calibration): script de calibracion (deciles + Brier) para validar el modelo y MODEL_WEIGHT"
```

---

## Cierre: verificación integral

### Task 9.1: Suite completa verde + corrida en vivo

- [ ] **Step 1: Toda la suite pasa**

Run: `pnpm vitest run`
Expected: 0 failed. (Incluye los tests que hoy fallan: model.test.ts Dixon-Coles/extractMatchProbabilities y pipeline.test.ts; si el de `mockResolvedValueOnce` sigue fallando por la API de vitest, ajustar a `vi.mocked(fetchLineups, true)` o reasignar el mock directamente — corregir en este paso.)

- [ ] **Step 2: Typecheck limpio**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Corrida en vivo de los 2 partidos de hoy**

Run: `pnpm cron:run`
Expected: Canadá favorito sobre Bosnia (modelProbability home > away), USA favorito moderado sobre Paraguay, cuotas presentes (>0 entradas), y confidence coherente. Las recomendaciones, si las hay, deben tener EV calculado sobre prob blended y respetar el cap de Kelly.

- [ ] **Step 4: Limpieza de archivos temporales**

```bash
rm -f odds_headers.tmp odds_today.tmp.json
git add -A && git commit -m "chore: limpieza de archivos temporales de auditoria"
```

---

## Self-Review (cobertura del diagnóstico)

| Hallazgo de la auditoría | Tarea |
|---|---|
| fetchOdds roto (btts) | 2.2 |
| Matching de nombres ES/EN | 2.1, 2.2 |
| defenseStrength invertida | 1.1, 1.2, 1.3 |
| No se quita el vig / mejor cuota sesgada | 3.1, 3.3 |
| Modelo no anclado al mercado | 3.2, 3.3 |
| Dixon-Coles inexistente + matriz sin normalizar | 4.1 |
| Confidence = disponibilidad de datos (gate <40 inalcanzable) | 4.2 |
| Tres implementaciones de Kelly | 5.1 |
| applyDailyLimit/detectCorrelation muertos + circuit breaker | 5.2 |
| settleBet no actualiza bankroll | 5.3 |
| oddsClosing nunca capturado (CLV=0) | 6.1 |
| restDays hardcodeado | 7.3 |
| opponentRanking hardcodeado | 7.2 |
| H2H sin decaimiento temporal (partido de 1930) | 7.1 |
| form con decaimiento por índice, no por meses | 7.2 |
| cron.ts guarda stubs | 8.1 |
| Falta calibración / validación de edge | 8.2, 6.1 |

**Pendiente consciente (YAGNI por ahora, documentado para fase posterior):** de-vig por método de Shin (se usa multiplicativo, suficiente para empezar); BTTS por endpoint por-evento de The Odds API (cuesta créditos extra; el código ya soporta sus cuotas si se inyectan); `detectCorrelation` se mantiene testeado pero su uso real (bloquear apuestas correlacionadas simultáneas) se difiere hasta tener volumen.
