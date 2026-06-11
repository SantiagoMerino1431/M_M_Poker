# Dev 2: Engine + Kelly + UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el motor de análisis (markets + EV), el sistema Kelly (criterion + portfolio + bankroll + tracker) y las 3 páginas de UI (/hoy, /partido/[id], /historial).

**Architecture:** El engine consume `MatchData` (definido por Dev 1 en `lib/types.ts`) y produce `MatchAnalysis` con todos los mercados y su EV. Kelly toma `MatchAnalysis` y calcula montos. La UI lee de la DB y permite ajuste manual antes de registrar apuestas. Dev 2 puede empezar en paralelo con Dev 1 usando datos mock — los mocks siguen exactamente las interfaces de `lib/types.ts`.

**Tech Stack:** TypeScript, Next.js 15 App Router, Tailwind, Recharts, `@libsql/client`, vitest.

**Rama:** `feat/engine-kelly-ui`
**Merge target:** `main` después de hacer merge de `feat/data-model` primero.
**Prerequisito:** `src/lib/types.ts` debe estar en `main` (lo publica Dev 1 en su Task 1). Hacer pull de main antes de empezar.

---

## Mapa de archivos

| Acción | Archivo |
|---|---|
| Crear | `src/lib/engine/markets.ts` |
| Crear | `src/lib/engine/ev.ts` |
| Crear | `src/lib/engine/analyzer.ts` |
| Crear | `src/lib/kelly/criterion.ts` |
| Crear | `src/lib/kelly/portfolio.ts` |
| Crear | `src/lib/kelly/bankroll.ts` |
| Crear | `src/lib/kelly/tracker.ts` |
| Crear | `src/lib/__tests__/engine.test.ts` |
| Crear | `src/lib/__tests__/kelly.test.ts` |
| Crear | `src/app/hoy/page.tsx` |
| Crear | `src/app/partido/[id]/page.tsx` |
| Crear | `src/app/historial/page.tsx` |
| Modificar | `src/app/layout.tsx` |
| Modificar | `src/app/page.tsx` |

---

## Task 1: Setup de rama y factory de mocks

**Files:**
- Crear: `src/lib/__tests__/fixtures/mock-match-data.ts`

- [ ] **Paso 1.1: Crear rama (esperar que Dev 1 haga push de types)**

```bash
git checkout main
git pull origin main
git checkout -b feat/engine-kelly-ui
```

- [ ] **Paso 1.2: Crear factory de mocks**

```typescript
// src/lib/__tests__/fixtures/mock-match-data.ts
import type { MatchData, MatchAnalysis, MarketResult } from "../../types"

export function makeMockMatchData(overrides: Partial<MatchData> = {}): MatchData {
  return {
    fixture: {
      id: 1,
      date: "2026-06-15T18:00:00Z",
      stadium: "MetLife Stadium",
      city: "East Rutherford",
      altitudeM: 5,
      homeTeamId: 29,
      awayTeamId: 37,
      stage: "Group H",
    },
    teams: {
      home: {
        id: 29, name: "España", country: "ESP", groupName: "H",
        fifaRanking: 1, attackStrength: 1.45, defenseStrength: 0.70,
      },
      away: {
        id: 37, name: "Argentina", country: "ARG", groupName: "J",
        fifaRanking: 2, attackStrength: 1.50, defenseStrength: 0.75,
      },
    },
    h2h: [],
    homeForm: [],
    awayForm: [],
    injuries: { home: [], away: [] },
    lineups: { home: null, away: null },
    referee: null,
    weather: { tempC: 24, humidity: 60 },
    odds: [
      { market: "h2h", selection: "España", odds: 2.10, bookmaker: "bet365", updatedAt: new Date().toISOString() },
      { market: "h2h", selection: "Draw", odds: 3.40, bookmaker: "bet365", updatedAt: new Date().toISOString() },
      { market: "h2h", selection: "Argentina", odds: 3.20, bookmaker: "bet365", updatedAt: new Date().toISOString() },
      { market: "totals", selection: "Over 2.5", odds: 1.90, bookmaker: "bet365", updatedAt: new Date().toISOString() },
      { market: "totals", selection: "Under 2.5", odds: 1.95, bookmaker: "bet365", updatedAt: new Date().toISOString() },
    ],
    dataQuality: 55,
    fetchedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makeMockMarketResult(overrides: Partial<MarketResult> = {}): MarketResult {
  return {
    name: "1X2",
    selection: "home",
    ourProbability: 0.48,
    bookmakerProbability: 0.42,
    odds: 2.10,
    bookmaker: "bet365",
    EV: 0.008,
    edge: 0.06,
    kellyFraction: 0.028,
    kellyAmount: 42,
    correlationGroup: "result",
    isRecommended: true,
    oddsStale: false,
    ...overrides,
  }
}
```

- [ ] **Paso 1.3: Commit**

```bash
git add src/lib/__tests__/fixtures/mock-match-data.ts
git commit -m "test: agregar factories de mocks para MatchData y MarketResult"
```

---

## Task 2: Motor de mercados

**Files:**
- Crear: `src/lib/engine/markets.ts`
- Crear: `src/lib/__tests__/engine.test.ts`

- [ ] **Paso 2.1: Escribir tests de markets**

```typescript
// src/lib/__tests__/engine.test.ts
import { describe, it, expect } from "vitest"
import { calcAllMarkets } from "../engine/markets"
import { makeMockMatchData } from "./fixtures/mock-match-data"

describe("calcAllMarkets", () => {
  it("devuelve array no vacío de mercados", () => {
    const data = makeMockMatchData()
    const matrix = buildTestMatrix(1.4, 1.2)
    const markets = calcAllMarkets(matrix, data)
    expect(markets.length).toBeGreaterThan(10)
  })

  it("1X2 probabilities suman ~1", () => {
    const matrix = buildTestMatrix(1.4, 1.2)
    const data = makeMockMatchData()
    const markets = calcAllMarkets(matrix, data)
    const home = markets.find(m => m.name === "1X2" && m.selection === "home")!
    const draw = markets.find(m => m.name === "1X2" && m.selection === "draw")!
    const away = markets.find(m => m.name === "1X2" && m.selection === "away")!
    expect(home.ourProbability + draw.ourProbability + away.ourProbability).toBeCloseTo(1.0, 2)
  })

  it("over 2.5 tiene odds stale false cuando odds son recientes", () => {
    const data = makeMockMatchData()
    const matrix = buildTestMatrix(1.4, 1.2)
    const markets = calcAllMarkets(matrix, data)
    const over25 = markets.find(m => m.name === "Over/Under" && m.selection === "over_2.5")
    expect(over25?.oddsStale).toBe(false)
  })

  it("mercados sin cuota tienen odds null y EV null", () => {
    const data = makeMockMatchData({ odds: [] })
    const matrix = buildTestMatrix(1.4, 1.2)
    const markets = calcAllMarkets(matrix, data)
    expect(markets.every(m => m.odds === null)).toBe(true)
    expect(markets.every(m => m.EV === null)).toBe(true)
  })
})

function buildTestMatrix(lH: number, lA: number): number[][] {
  const matrix: number[][] = []
  let total = 0
  for (let h = 0; h <= 8; h++) {
    matrix[h] = []
    for (let a = 0; a <= 8; a++) {
      matrix[h][a] = poissonP(lH, h) * poissonP(lA, a)
      total += matrix[h][a]
    }
  }
  for (let h = 0; h <= 8; h++)
    for (let a = 0; a <= 8; a++)
      matrix[h][a] /= total
  return matrix
}

function poissonP(l: number, k: number): number {
  let p = Math.exp(-l)
  for (let i = 1; i <= k; i++) p *= l / i
  return p
}
```

- [ ] **Paso 2.2: Ejecutar test — debe fallar**

```bash
pnpm test src/lib/__tests__/engine.test.ts
```
Esperado: FAIL

- [ ] **Paso 2.3: Crear `src/lib/engine/markets.ts`**

```typescript
// src/lib/engine/markets.ts
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

function calcBookmakerProb(odds: number): number {
  return 1 / odds
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
```

- [ ] **Paso 2.4: Ejecutar tests — deben pasar**

```bash
pnpm test src/lib/__tests__/engine.test.ts
```
Esperado: PASS (4 tests)

- [ ] **Paso 2.5: Commit**

```bash
git add src/lib/engine/markets.ts src/lib/__tests__/engine.test.ts
git commit -m "feat: motor de mercados con EV y deteccion de odds obsoletas"
```

---

## Task 3: Cálculo de EV y analyzer completo

**Files:**
- Crear: `src/lib/engine/ev.ts`
- Crear: `src/lib/engine/analyzer.ts`

- [ ] **Paso 3.1: Crear `src/lib/engine/ev.ts`**

```typescript
// src/lib/engine/ev.ts
import type { MarketResult } from "../types"

export function applyKellyToMarkets(
  markets: MarketResult[],
  bankroll: number,
  confidenceMultiplier: number
): MarketResult[] {
  return markets.map(m => {
    if (m.EV === null || m.odds === null || !m.isRecommended) return m

    const b = m.odds - 1
    const p = m.ourProbability
    const q = 1 - p
    const rawKelly = (p * b - q) / b
    const adjusted = rawKelly * 0.5 * confidenceMultiplier
    const capped = Math.max(0.005, Math.min(0.08, adjusted))
    const amount = Math.round(bankroll * capped * 100) / 100

    return { ...m, kellyFraction: capped, kellyAmount: amount }
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

- [ ] **Paso 3.2: Crear `src/lib/engine/analyzer.ts`**

```typescript
// src/lib/engine/analyzer.ts
import type { MatchData, MatchAnalysis, ModelOutput } from "../types"
import { buildScoreMatrix, extractMatchProbabilities } from "../model/poisson"
import { calcH2HFactor } from "../model/h2h"
import { calcFormFactor } from "../model/form"
import { calcContextAdjustments } from "../model/context"
import { calcAllMarkets } from "./markets"
import { applyKellyToMarkets, rankMarkets } from "./ev"

function confidenceMultiplier(score: number): number {
  if (score >= 80) return 1.00
  if (score >= 60) return 0.75
  if (score >= 40) return 0.50
  return 0.00
}

export function analyzeMatch(data: MatchData, bankroll: number): MatchAnalysis {
  const alerts: string[] = []
  const adjustments: string[] = []

  if (!data.lineups.home || !data.lineups.away) alerts.push("Lineup no confirmado")
  if (data.odds.length === 0) alerts.push("Sin cuotas disponibles — ingresar manualmente")

  const staleOdds = data.odds.some(o => {
    const age = Date.now() - new Date(o.updatedAt).getTime()
    return age > 4 * 60 * 60 * 1000
  })
  if (staleOdds) alerts.push("Cuotas con más de 4 horas de antigüedad")

  const homeH2H = calcH2HFactor(data.h2h, data.teams.home.id)
  const awayH2H = calcH2HFactor(data.h2h, data.teams.away.id)
  const homeForm = calcFormFactor(data.homeForm)
  const awayForm = calcFormFactor(data.awayForm)

  const context = calcContextAdjustments({
    homeCountry: data.teams.home.country,
    awayCountry: data.teams.away.country,
    city: data.fixture.city,
    altitudeM: data.fixture.altitudeM,
    tempC: data.weather?.tempC ?? null,
    homeRestDays: 5,
    awayRestDays: 5,
    refereeAvgYellows: data.referee?.avgYellowsPerGame ?? null,
  })

  if (homeH2H.adjustmentDescription) adjustments.push(homeH2H.adjustmentDescription)
  if (homeForm.description) adjustments.push(`Local: ${homeForm.description}`)
  if (awayForm.description) adjustments.push(`Visitante: ${awayForm.description}`)
  adjustments.push(...context.adjustments)

  const lambdaHome =
    data.teams.home.attackStrength *
    data.teams.away.defenseStrength *
    1.4 *
    context.homeAdvantage *
    homeH2H.attackMultiplier *
    homeForm.factor *
    context.altitudeFactorHome *
    context.heatFactorHome *
    context.fatigueFactor

  const lambdaAway =
    data.teams.away.attackStrength *
    data.teams.home.defenseStrength *
    1.4 *
    awayH2H.attackMultiplier *
    awayForm.factor *
    context.heatFactorAway *
    context.fatigueFactor

  const matrix = buildScoreMatrix(lambdaHome, lambdaAway)
  const modelOutput: ModelOutput = {
    lambdaHome,
    lambdaAway,
    adjustmentsApplied: adjustments,
    scoreMatrix: matrix,
  }

  const multiplier = confidenceMultiplier(data.dataQuality)
  let markets = calcAllMarkets(matrix, data)
  markets = applyKellyToMarkets(markets, bankroll, multiplier)
  markets = rankMarkets(markets)

  return {
    fixtureId: data.fixture.id,
    confidence: data.dataQuality,
    isPreliminary: !data.lineups.home || !data.lineups.away,
    model: modelOutput,
    markets,
    alerts,
    lastUpdated: new Date().toISOString(),
  }
}
```

- [ ] **Paso 3.3: Agregar test de analyzer**

En `src/lib/__tests__/engine.test.ts`, agregar al final del archivo:

```typescript
import { analyzeMatch } from "../engine/analyzer"

describe("analyzeMatch", () => {
  it("devuelve MatchAnalysis con todos los campos requeridos", () => {
    const data = makeMockMatchData()
    const result = analyzeMatch(data, 1000)

    expect(result.fixtureId).toBe(1)
    expect(result.confidence).toBe(55)
    expect(result.markets.length).toBeGreaterThan(5)
    expect(result.lastUpdated).toBeDefined()
  })

  it("markets recomendados tienen kellyAmount calculado", () => {
    const data = makeMockMatchData()
    const result = analyzeMatch(data, 1000)
    const recommended = result.markets.filter(m => m.isRecommended)
    for (const m of recommended) {
      expect(m.kellyAmount).not.toBeNull()
      expect(m.kellyAmount!).toBeGreaterThan(0)
    }
  })

  it("sin odds, ningún mercado es recomendado", () => {
    const data = makeMockMatchData({ odds: [] })
    const result = analyzeMatch(data, 1000)
    expect(result.markets.every(m => !m.isRecommended)).toBe(true)
  })

  it("alerta cuando lineup no está confirmado", () => {
    const data = makeMockMatchData({ lineups: { home: null, away: null } })
    const result = analyzeMatch(data, 1000)
    expect(result.alerts).toContain("Lineup no confirmado")
  })
})
```

- [ ] **Paso 3.4: Ejecutar todos los tests del engine**

```bash
pnpm test src/lib/__tests__/engine.test.ts
```
Esperado: PASS (8 tests)

- [ ] **Paso 3.5: Commit**

```bash
git add src/lib/engine/ev.ts src/lib/engine/analyzer.ts src/lib/__tests__/engine.test.ts
git commit -m "feat: analyzer completo con EV, Kelly y alertas por partido"
```

---

## Task 4: Sistema Kelly

**Files:**
- Crear: `src/lib/kelly/criterion.ts`
- Crear: `src/lib/kelly/portfolio.ts`
- Crear: `src/lib/kelly/bankroll.ts`
- Crear: `src/lib/kelly/tracker.ts`
- Crear: `src/lib/__tests__/kelly.test.ts`

- [ ] **Paso 4.1: Escribir tests de Kelly**

```typescript
// src/lib/__tests__/kelly.test.ts
import { describe, it, expect } from "vitest"
import { calcKelly } from "../kelly/criterion"
import { applyDailyLimit, detectCorrelation } from "../kelly/portfolio"
import { calcMetrics } from "../kelly/tracker"
import type { Bet } from "../types"

describe("calcKelly", () => {
  it("retorna fraccion positiva cuando hay edge real", () => {
    const result = calcKelly({ probability: 0.55, odds: 2.10, bankroll: 1000, confidence: 80 })
    expect(result.fraction).toBeGreaterThan(0)
    expect(result.amount).toBeGreaterThan(0)
  })

  it("retorna fraccion 0 cuando EV es negativo", () => {
    const result = calcKelly({ probability: 0.30, odds: 2.10, bankroll: 1000, confidence: 80 })
    expect(result.fraction).toBe(0)
    expect(result.amount).toBe(0)
  })

  it("nunca supera el 8% del bankroll", () => {
    const result = calcKelly({ probability: 0.90, odds: 2.10, bankroll: 1000, confidence: 100 })
    expect(result.amount).toBeLessThanOrEqual(80)
  })

  it("confidence bajo reduce el monto", () => {
    const high = calcKelly({ probability: 0.55, odds: 2.10, bankroll: 1000, confidence: 80 })
    const low  = calcKelly({ probability: 0.55, odds: 2.10, bankroll: 1000, confidence: 50 })
    expect(low.amount).toBeLessThan(high.amount)
  })
})

describe("applyDailyLimit", () => {
  it("reduce montos si la exposicion total supera el 15%", () => {
    const bets = [
      { amount: 80, kellyFraction: 0.08 },
      { amount: 80, kellyFraction: 0.08 },
      { amount: 80, kellyFraction: 0.08 },
    ]
    const adjusted = applyDailyLimit(bets, 1000)
    const total = adjusted.reduce((s, b) => s + b.amount, 0)
    expect(total).toBeLessThanOrEqual(150)
  })

  it("no modifica si la exposicion es menor al 15%", () => {
    const bets = [{ amount: 30, kellyFraction: 0.03 }]
    const adjusted = applyDailyLimit(bets, 1000)
    expect(adjusted[0].amount).toBe(30)
  })
})

describe("detectCorrelation", () => {
  it("detecta correlacion alta entre 1X2 y handicap del mismo partido", () => {
    const result = detectCorrelation("result", "result", 1)
    expect(result).toBe("high")
  })

  it("detecta correlacion baja entre resultado y corners", () => {
    const result = detectCorrelation("result", "corners", 1)
    expect(result).toBe("low")
  })
})

describe("calcMetrics", () => {
  const bets: Bet[] = [
    { id: 1, fixtureId: 1, market: "1X2", selection: "home", ourProbability: 0.55, bookmakerProbability: 0.48, oddsUsed: 1.95, oddsClosing: 1.85, amount: 50, kellySuggested: 50, EV: 0.07, edge: 0.07, result: "win", profitLoss: 47.5, mode: "real", confidenceAtTime: 75, createdAt: "2026-06-11T20:00:00Z", settledAt: "2026-06-11T22:00:00Z" },
    { id: 2, fixtureId: 2, market: "Over/Under", selection: "over_2.5", ourProbability: 0.60, bookmakerProbability: 0.52, oddsUsed: 1.90, oddsClosing: 1.95, amount: 40, kellySuggested: 40, EV: 0.05, edge: 0.08, result: "loss", profitLoss: -40, mode: "real", confidenceAtTime: 70, createdAt: "2026-06-12T15:00:00Z", settledAt: "2026-06-12T17:00:00Z" },
  ]

  it("calcula ROI correctamente", () => {
    const metrics = calcMetrics(bets)
    expect(metrics.ROI).toBeCloseTo((47.5 - 40) / 90 * 100, 1)
  })

  it("calcula strike rate correctamente", () => {
    const metrics = calcMetrics(bets)
    expect(metrics.strikeRate).toBeCloseTo(0.5, 2)
  })

  it("CLV positivo cuando se apostó antes del movimiento de línea", () => {
    const metrics = calcMetrics(bets)
    expect(metrics.avgCLV).toBeGreaterThan(0)
  })
})
```

- [ ] **Paso 4.2: Ejecutar test — debe fallar**

```bash
pnpm test src/lib/__tests__/kelly.test.ts
```
Esperado: FAIL

- [ ] **Paso 4.3: Crear `src/lib/kelly/criterion.ts`**

```typescript
// src/lib/kelly/criterion.ts

export interface KellyInput {
  probability: number
  odds: number
  bankroll: number
  confidence: number
}

export interface KellyResult {
  fraction: number
  amount: number
  isNegative: boolean
}

const CONFIDENCE_MULTIPLIER: Record<string, number> = {
  high: 1.00,
  medium: 0.75,
  low: 0.50,
  none: 0.00,
}

function confidenceMultiplier(confidence: number): number {
  if (confidence >= 80) return CONFIDENCE_MULTIPLIER.high
  if (confidence >= 60) return CONFIDENCE_MULTIPLIER.medium
  if (confidence >= 40) return CONFIDENCE_MULTIPLIER.low
  return CONFIDENCE_MULTIPLIER.none
}

export function calcKelly(input: KellyInput): KellyResult {
  const { probability: p, odds, bankroll, confidence } = input
  const b = odds - 1
  const q = 1 - p
  const rawKelly = (p * b - q) / b

  if (rawKelly <= 0) return { fraction: 0, amount: 0, isNegative: rawKelly < 0 }

  const multiplier = confidenceMultiplier(confidence)
  const adjusted = rawKelly * 0.5 * multiplier
  const MIN = 0.005
  const MAX = 0.08
  const capped = Math.max(MIN, Math.min(MAX, adjusted))
  const amount = Math.round(bankroll * capped * 100) / 100

  return { fraction: capped, amount, isNegative: false }
}
```

- [ ] **Paso 4.4: Crear `src/lib/kelly/portfolio.ts`**

```typescript
// src/lib/kelly/portfolio.ts

const HIGH_CORRELATION_PAIRS = new Set([
  "result:result",
  "result:exact_score",
  "goals_ou_2.5:btts",
])

export function detectCorrelation(
  groupA: string,
  groupB: string,
  fixtureId: number
): "high" | "low" {
  if (fixtureId !== fixtureId) return "low"
  const pair = [groupA, groupB].sort().join(":")
  return HIGH_CORRELATION_PAIRS.has(pair) ? "high" : "low"
}

export function applyDailyLimit(
  bets: { amount: number; kellyFraction: number }[],
  bankroll: number
): { amount: number; kellyFraction: number }[] {
  const MAX_EXPOSURE = 0.15
  const totalAmount = bets.reduce((s, b) => s + b.amount, 0)
  const maxAllowed = bankroll * MAX_EXPOSURE

  if (totalAmount <= maxAllowed) return bets

  const scale = maxAllowed / totalAmount
  return bets.map(b => ({
    ...b,
    amount: Math.round(b.amount * scale * 100) / 100,
    kellyFraction: b.kellyFraction * scale,
  }))
}
```

- [ ] **Paso 4.5: Crear `src/lib/kelly/bankroll.ts`**

```typescript
// src/lib/kelly/bankroll.ts
import { db } from "../db/client"
import type { BankrollState } from "../types"

export async function getBankrollState(): Promise<BankrollState> {
  const rows = await db.execute(
    "SELECT * FROM bankroll_snapshots ORDER BY created_at DESC LIMIT 2"
  )
  const snapshots = rows.rows as any[]

  const current = snapshots.find(s => s.snapshot_type === "daily")?.balance ?? 1000
  const initial = snapshots.find(s => s.snapshot_type === "weekly")?.balance ?? current
  const weeklySnapshot = initial

  const lossRows = await db.execute(
    "SELECT result FROM bets WHERE mode = 'real' ORDER BY created_at DESC LIMIT 10"
  )
  const recent = (lossRows.rows as any[]).map(r => r.result)
  let consecutive = 0
  for (const r of recent) {
    if (r === "loss") consecutive++
    else break
  }

  const drawdown = (initial - current) / initial
  const mode: BankrollState["mode"] =
    consecutive >= 5 ? "paused" :
    drawdown > 0.30 ? "conservative" :
    "normal"

  return {
    current,
    initial,
    weeklySnapshot,
    mode,
    consecutiveLosses: consecutive,
    lastUpdated: new Date().toISOString(),
  }
}

export async function updateBankroll(newBalance: number, type: "daily" | "weekly" | "manual") {
  await db.execute({
    sql: "INSERT INTO bankroll_snapshots (balance, snapshot_type, created_at) VALUES (?, ?, ?)",
    args: [newBalance, type, new Date().toISOString()],
  })
}
```

- [ ] **Paso 4.6: Crear `src/lib/kelly/tracker.ts`**

```typescript
// src/lib/kelly/tracker.ts
import { db } from "../db/client"
import type { Bet } from "../types"

export async function saveBet(bet: Omit<Bet, "id">): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO bets (
      fixture_id, market, selection, our_probability, bookmaker_probability,
      odds_used, odds_closing, amount, kelly_suggested, ev, edge,
      result, profit_loss, mode, confidence_at_time, created_at, settled_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      bet.fixtureId, bet.market, bet.selection,
      bet.ourProbability, bet.bookmakerProbability,
      bet.oddsUsed, bet.oddsClosing, bet.amount,
      bet.kellySuggested, bet.EV, bet.edge,
      bet.result, bet.profitLoss, bet.mode,
      bet.confidenceAtTime, bet.createdAt, bet.settledAt,
    ],
  })
  return Number(result.lastInsertRowid)
}

export async function getBets(filter?: { mode?: "real" | "paper" }): Promise<Bet[]> {
  const sql = filter?.mode
    ? "SELECT * FROM bets WHERE mode = ? ORDER BY created_at DESC"
    : "SELECT * FROM bets ORDER BY created_at DESC"
  const args = filter?.mode ? [filter.mode] : []
  const rows = await db.execute({ sql, args })
  return (rows.rows as any[]).map(rowToBet)
}

export interface BettingMetrics {
  ROI: number
  yield: number
  strikeRate: number
  avgCLV: number
  maxDrawdown: number
  totalBets: number
  totalStaked: number
  profitLoss: number
}

export function calcMetrics(bets: Bet[]): BettingMetrics {
  const settled = bets.filter(b => b.result !== null && b.profitLoss !== null)
  if (!settled.length) return { ROI: 0, yield: 0, strikeRate: 0, avgCLV: 0, maxDrawdown: 0, totalBets: 0, totalStaked: 0, profitLoss: 0 }

  const totalStaked = settled.reduce((s, b) => s + b.amount, 0)
  const profitLoss = settled.reduce((s, b) => s + (b.profitLoss ?? 0), 0)
  const wins = settled.filter(b => b.result === "win").length
  const ROI = totalStaked > 0 ? (profitLoss / totalStaked) * 100 : 0
  const strikeRate = wins / settled.length

  const clvBets = settled.filter(b => b.oddsClosing !== null)
  const avgCLV = clvBets.length
    ? clvBets.reduce((s, b) => s + (b.oddsUsed / b.oddsClosing! - 1), 0) / clvBets.length
    : 0

  let peak = 0, current = 0, maxDrawdown = 0
  for (const b of settled) {
    current += b.profitLoss ?? 0
    if (current > peak) peak = current
    const dd = peak - current
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  return {
    ROI,
    yield: settled.length > 0 ? ROI / settled.length : 0,
    strikeRate,
    avgCLV,
    maxDrawdown,
    totalBets: settled.length,
    totalStaked,
    profitLoss,
  }
}

function rowToBet(r: any): Bet {
  return {
    id: r.id, fixtureId: r.fixture_id, market: r.market, selection: r.selection,
    ourProbability: r.our_probability, bookmakerProbability: r.bookmaker_probability,
    oddsUsed: r.odds_used, oddsClosing: r.odds_closing, amount: r.amount,
    kellySuggested: r.kelly_suggested, EV: r.ev, edge: r.edge,
    result: r.result, profitLoss: r.profit_loss, mode: r.mode,
    confidenceAtTime: r.confidence_at_time, createdAt: r.created_at, settledAt: r.settled_at,
  }
}
```

- [ ] **Paso 4.7: Ejecutar todos los tests de Kelly**

```bash
pnpm test src/lib/__tests__/kelly.test.ts
```
Esperado: PASS (8 tests)

- [ ] **Paso 4.8: Commit**

```bash
git add src/lib/kelly/ src/lib/__tests__/kelly.test.ts
git commit -m "feat: sistema Kelly completo con portfolio, bankroll y tracker"
```

---

## Task 5: Server Actions para la UI

**Files:**
- Crear: `src/app/actions.ts`

- [ ] **Paso 5.1: Crear `src/app/actions.ts`**

```typescript
// src/app/actions.ts
"use server"
import { db } from "@/lib/db/client"
import { getBankrollState } from "@/lib/kelly/bankroll"
import { calcMetrics, getBets, saveBet } from "@/lib/kelly/tracker"
import type { MatchAnalysis, Bet } from "@/lib/types"

export async function getTodayAnalyses(): Promise<MatchAnalysis[]> {
  const today = new Date().toISOString().split("T")[0]
  const rows = await db.execute({
    sql: "SELECT * FROM match_analyses WHERE created_at >= ? ORDER BY confidence DESC",
    args: [`${today}T00:00:00Z`],
  })
  return (rows.rows as any[]).map(r => ({
    fixtureId: r.fixture_id,
    confidence: r.confidence,
    isPreliminary: Boolean(r.is_preliminary),
    model: { lambdaHome: r.lambda_home, lambdaAway: r.lambda_away, adjustmentsApplied: JSON.parse(r.adjustments_applied), scoreMatrix: [] },
    markets: JSON.parse(r.markets),
    alerts: JSON.parse(r.alerts),
    lastUpdated: r.created_at,
  }))
}

export async function getAnalysisForFixture(fixtureId: number): Promise<MatchAnalysis | null> {
  const rows = await db.execute({
    sql: "SELECT * FROM match_analyses WHERE fixture_id = ? ORDER BY created_at DESC LIMIT 1",
    args: [fixtureId],
  })
  const r = rows.rows[0] as any
  if (!r) return null
  return {
    fixtureId: r.fixture_id,
    confidence: r.confidence,
    isPreliminary: Boolean(r.is_preliminary),
    model: { lambdaHome: r.lambda_home, lambdaAway: r.lambda_away, adjustmentsApplied: JSON.parse(r.adjustments_applied), scoreMatrix: [] },
    markets: JSON.parse(r.markets),
    alerts: JSON.parse(r.alerts),
    lastUpdated: r.created_at,
  }
}

export async function registerBet(bet: Omit<Bet, "id">): Promise<{ id: number }> {
  const id = await saveBet(bet)
  return { id }
}

export async function getDashboardData() {
  const [bankroll, bets] = await Promise.all([
    getBankrollState(),
    getBets({ mode: "real" }),
  ])
  const metrics = calcMetrics(bets)
  const alerts = await db.execute("SELECT * FROM alerts WHERE is_read = 0 ORDER BY created_at DESC LIMIT 5")
  return { bankroll, metrics, alerts: alerts.rows }
}
```

- [ ] **Paso 5.2: Commit**

```bash
git add src/app/actions.ts
git commit -m "feat: server actions para leer analisis, bankroll y registrar apuestas"
```

---

## Task 6: Página /hoy

**Files:**
- Crear: `src/app/hoy/page.tsx`

- [ ] **Paso 6.1: Crear `src/app/hoy/page.tsx`**

```tsx
// src/app/hoy/page.tsx
import { getTodayAnalyses, getDashboardData } from "../actions"
import Link from "next/link"

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 70 ? "var(--win)" : score >= 40 ? "var(--draw)" : "var(--loss)"
  const label = score >= 70 ? "ALTO" : score >= 40 ? "MEDIO" : "BAJO"
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", background: color, color: "#000", letterSpacing: "0.08em" }}>
      {label} {score}
    </span>
  )
}

function pct(n: number | null) {
  if (n === null) return "--"
  return `${(n * 100).toFixed(0)}%`
}

export default async function HoyPage() {
  const [analyses, dashboard] = await Promise.all([
    getTodayAnalyses(),
    getDashboardData(),
  ])

  const { bankroll, metrics } = dashboard
  const dailyExposure = analyses
    .flatMap(a => a.markets)
    .filter(m => m.isRecommended && m.kellyAmount)
    .reduce((s, m) => s + (m.kellyAmount ?? 0), 0)

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, marginBottom: 40 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            Bankroll
          </div>
          <div className="stat-number" style={{ fontSize: 36, color: "var(--accent)", marginBottom: 4 }}>
            ${bankroll.current.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            {metrics.ROI >= 0 ? "+" : ""}{metrics.ROI.toFixed(1)}% ROI · {metrics.totalBets} apuestas
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Exposure hoy: <span style={{ color: "var(--text)" }}>${dailyExposure.toFixed(0)}</span>
            {" / "}
            <span style={{ color: dailyExposure > bankroll.current * 0.15 ? "var(--loss)" : "var(--text-muted)" }}>
              máx ${(bankroll.current * 0.15).toFixed(0)}
            </span>
          </div>
          {bankroll.mode !== "normal" && (
            <div style={{ marginTop: 12, padding: "8px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid var(--loss)", fontSize: 11, color: "var(--loss)" }}>
              {bankroll.mode === "paused" ? "SISTEMA EN PAUSA — 5 pérdidas consecutivas" : "MODO CONSERVADOR — drawdown > 30%"}
            </div>
          )}
        </div>

        <div>
          <p style={{ fontSize: 12, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
            Partidos del día · {new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="stat-number" style={{ fontSize: "clamp(32px, 5vw, 56px)" }}>
            Análisis <span style={{ color: "var(--accent)" }}>Hoy</span>
          </h1>
        </div>
      </div>

      {analyses.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>--</div>
          <p>No hay partidos analizados hoy. El cron corre a las 08:00 AM.</p>
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {analyses.map(analysis => {
          const bestMarket = analysis.markets.find(m => m.isRecommended)
          const evColor = bestMarket?.EV && bestMarket.EV >= 0.05 ? "var(--win)" : "var(--draw)"

          return (
            <Link key={analysis.fixtureId} href={`/partido/${analysis.fixtureId}`}
              style={{ textDecoration: "none", display: "block" }}>
              <div style={{
                background: "var(--surface)",
                border: `1px solid ${bestMarket ? "var(--border)" : "var(--border)"}`,
                borderLeft: bestMarket ? `3px solid ${evColor}` : "3px solid var(--border)",
                padding: "16px 20px",
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                alignItems: "center",
                gap: 16,
                cursor: "pointer",
                transition: "background 0.1s",
              }}>
                <div>
                  <div className="stat-number" style={{ fontSize: 18, textTransform: "uppercase", marginBottom: 4 }}>
                    Fixture #{analysis.fixtureId}
                  </div>
                  {analysis.alerts.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--draw)" }}>
                      {analysis.alerts[0]}
                    </div>
                  )}
                </div>
                <ConfidenceBadge score={analysis.confidence} />
                {bestMarket ? (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                      {bestMarket.name} · {bestMarket.selection}
                    </div>
                    <div className="stat-number" style={{ fontSize: 22, color: evColor }}>
                      EV +{pct(bestMarket.EV)}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Sin mercados recomendados</div>
                )}
                {bestMarket?.kellyAmount && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Kelly</div>
                    <div className="stat-number" style={{ fontSize: 20 }}>${bestMarket.kellyAmount}</div>
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Paso 6.2: Commit**

```bash
git add src/app/hoy/page.tsx
git commit -m "feat: pagina /hoy con dashboard de bankroll y partidos rankeados por EV"
```

---

## Task 7: Página /partido/[id]

**Files:**
- Crear: `src/app/partido/[id]/page.tsx`

- [ ] **Paso 7.1: Crear `src/app/partido/[id]/page.tsx`**

```tsx
// src/app/partido/[id]/page.tsx
import { getAnalysisForFixture, registerBet } from "../../actions"
import { notFound } from "next/navigation"

function pct(n: number | null) {
  if (n === null) return "--"
  return `${(n * 100).toFixed(1)}%`
}

function evColor(ev: number | null) {
  if (ev === null) return "var(--text-muted)"
  if (ev >= 0.05) return "var(--win)"
  if (ev >= 0.03) return "var(--draw)"
  return "var(--text-muted)"
}

export default async function PartidoPage({ params }: { params: { id: string } }) {
  const fixtureId = Number(params.id)
  const analysis = await getAnalysisForFixture(fixtureId)
  if (!analysis) notFound()

  const recommended = analysis.markets.filter(m => m.isRecommended)
  const others = analysis.markets.filter(m => !m.isRecommended && m.EV !== null)

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Fixture #{analysis.fixtureId}
          </span>
          <span style={{ fontSize: 10, padding: "2px 8px", background: analysis.isPreliminary ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)", color: analysis.isPreliminary ? "var(--draw)" : "var(--win)" }}>
            {analysis.isPreliminary ? "PRELIMINAR" : "FINAL"}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Actualizado: {new Date(analysis.lastUpdated).toLocaleTimeString("es")}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {analysis.alerts.map((alert, i) => (
            <div key={i} style={{ fontSize: 11, padding: "4px 10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "var(--draw)" }}>
              {alert}
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
          Modelo estadístico
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Goles esperados local</div>
            <div className="stat-number" style={{ fontSize: 32, color: "var(--accent)" }}>
              {analysis.model.lambdaHome.toFixed(2)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Goles esperados visitante</div>
            <div className="stat-number" style={{ fontSize: 32 }}>
              {analysis.model.lambdaAway.toFixed(2)}
            </div>
          </div>
        </div>
        {analysis.model.adjustmentsApplied.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {analysis.model.adjustmentsApplied.map((adj, i) => (
              <span key={i} style={{ fontSize: 10, padding: "2px 6px", background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                {adj}
              </span>
            ))}
          </div>
        )}
      </div>

      {recommended.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 className="stat-number" style={{ fontSize: 22, textTransform: "uppercase", marginBottom: 12, color: "var(--win)" }}>
            Mercados recomendados
          </h2>
          <div style={{ display: "grid", gap: 6 }}>
            {recommended.map((m, i) => (
              <div key={i} style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderLeft: "3px solid var(--win)",
                padding: "14px 16px",
                display: "grid",
                gridTemplateColumns: "1fr repeat(5, auto)",
                alignItems: "center",
                gap: 16,
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {m.name} — {m.selection}
                  </div>
                  {m.bookmaker && (
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      {m.bookmaker} · cuota {m.odds}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Prob. modelo</div>
                  <div className="stat-number" style={{ fontSize: 18 }}>{pct(m.ourProbability)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Prob. bm</div>
                  <div className="stat-number" style={{ fontSize: 18, color: "var(--text-muted)" }}>{pct(m.bookmakerProbability)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Edge</div>
                  <div className="stat-number" style={{ fontSize: 18, color: "var(--win)" }}>+{pct(m.edge)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>EV</div>
                  <div className="stat-number" style={{ fontSize: 18, color: evColor(m.EV) }}>+{pct(m.EV)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Kelly</div>
                  <div className="stat-number" style={{ fontSize: 20, color: "var(--accent)" }}>${m.kellyAmount}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 className="stat-number" style={{ fontSize: 18, textTransform: "uppercase", marginBottom: 10, color: "var(--text-muted)" }}>
            Otros mercados calculados
          </h2>
          <div style={{ display: "grid", gap: 4 }}>
            {others.slice(0, 8).map((m, i) => (
              <div key={i} style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                padding: "10px 16px",
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                alignItems: "center",
                gap: 12,
                opacity: 0.65,
              }}>
                <div style={{ fontSize: 12 }}>{m.name} — {m.selection}</div>
                <div className="stat-number" style={{ fontSize: 16 }}>{pct(m.ourProbability)}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.odds ? `@${m.odds}` : "--"}</div>
                <div className="stat-number" style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  EV {m.EV !== null ? `${(m.EV * 100).toFixed(1)}%` : "--"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
          Registrar apuesta
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Selecciona un mercado arriba y usa el botón "Apostar" para registrar. La UI interactiva de confirmación requiere "use client" — conectar con el componente RegisterBetForm.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Paso 7.2: Commit**

```bash
git add "src/app/partido/[id]/page.tsx"
git commit -m "feat: pagina de analisis por partido con modelo, mercados y Kelly"
```

---

## Task 8: Página /historial

**Files:**
- Crear: `src/app/historial/page.tsx`

- [ ] **Paso 8.1: Crear `src/app/historial/page.tsx`**

```tsx
// src/app/historial/page.tsx
import { getBets } from "@/lib/kelly/tracker"
import { calcMetrics } from "@/lib/kelly/tracker"

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "16px 20px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
        {label}
      </div>
      <div className="stat-number" style={{ fontSize: 28, color: "var(--accent)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default async function HistorialPage() {
  const [realBets, paperBets] = await Promise.all([
    getBets({ mode: "real" }),
    getBets({ mode: "paper" }),
  ])

  const realMetrics = calcMetrics(realBets)
  const paperMetrics = calcMetrics(paperBets)

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 12, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
          Apuestas reales · {realMetrics.totalBets} registradas
        </p>
        <h1 className="stat-number" style={{ fontSize: "clamp(32px, 5vw, 56px)" }}>
          Track <span style={{ color: "var(--accent)" }}>Record</span>
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 40 }}>
        <KPICard label="ROI" value={`${realMetrics.ROI >= 0 ? "+" : ""}${realMetrics.ROI.toFixed(1)}%`} />
        <KPICard label="Strike Rate" value={`${(realMetrics.strikeRate * 100).toFixed(0)}%`} sub={`${realMetrics.totalBets} apuestas`} />
        <KPICard label="P/L Total" value={`${realMetrics.profitLoss >= 0 ? "+" : ""}$${realMetrics.profitLoss.toFixed(0)}`} />
        <KPICard label="CLV Promedio" value={`${(realMetrics.avgCLV * 100).toFixed(2)}%`} sub="Cierre de línea" />
        <KPICard label="Drawdown Máx" value={`$${realMetrics.maxDrawdown.toFixed(0)}`} />
      </div>

      {paperMetrics.totalBets > 0 && (
        <div style={{ background: "rgba(232,255,60,0.05)", border: "1px solid rgba(232,255,60,0.2)", padding: "14px 20px", marginBottom: 32 }}>
          <span style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Paper Trading · {paperMetrics.totalBets} simulaciones
          </span>
          <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 16 }}>
            ROI simulado: {paperMetrics.ROI >= 0 ? "+" : ""}{paperMetrics.ROI.toFixed(1)}% · Strike: {(paperMetrics.strikeRate * 100).toFixed(0)}%
          </span>
        </div>
      )}

      <div style={{ marginBottom: 32 }}>
        <h2 className="stat-number" style={{ fontSize: 20, textTransform: "uppercase", marginBottom: 12 }}>
          Historial de apuestas
        </h2>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto auto", gap: 12, padding: "8px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Fixture</span><span>Mercado</span><span>Cuota</span><span>Monto</span><span>EV</span><span>Resultado</span>
          </div>
          {realBets.slice(0, 20).map(bet => (
            <div key={bet.id} style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto auto auto auto",
              gap: 12,
              padding: "10px 16px",
              borderBottom: "1px solid var(--border)",
              borderLeft: `3px solid ${bet.result === "win" ? "var(--win)" : bet.result === "loss" ? "var(--loss)" : "var(--border)"}`,
            }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>#{bet.fixtureId}</span>
              <span style={{ fontSize: 13 }}>{bet.market} · {bet.selection}</span>
              <span className="stat-number" style={{ fontSize: 16 }}>{bet.oddsUsed}</span>
              <span className="stat-number" style={{ fontSize: 16 }}>${bet.amount}</span>
              <span style={{ fontSize: 12, color: bet.EV >= 0.03 ? "var(--win)" : "var(--text-muted)" }}>
                +{(bet.EV * 100).toFixed(1)}%
              </span>
              <span className="stat-number" style={{
                fontSize: 16,
                color: bet.result === "win" ? "var(--win)" : bet.result === "loss" ? "var(--loss)" : "var(--text-muted)",
              }}>
                {bet.result === "win" ? `+$${bet.profitLoss?.toFixed(0)}` :
                 bet.result === "loss" ? `-$${bet.amount}` : "PEND."}
              </span>
            </div>
          ))}
          {realBets.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Sin apuestas registradas aún. Comienza con paper trading en /partido/[id].
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Paso 8.2: Commit**

```bash
git add src/app/historial/page.tsx
git commit -m "feat: pagina historial con KPIs, CLV, drawdown y tabla de apuestas"
```

---

## Task 9: Navbar y redirección home

**Files:**
- Modificar: `src/app/layout.tsx`
- Modificar: `src/app/page.tsx`

- [ ] **Paso 9.1: Actualizar `src/app/layout.tsx`** — agregar navbar

Leer el archivo primero, luego reemplazar la sección del `<body>`:

```tsx
// src/app/layout.tsx
import type { Metadata } from "next"
import { Barlow_Condensed } from "next/font/google"
import "./globals.css"
import Link from "next/link"

const barlowCondensed = Barlow_Condensed({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-display",
})

export const metadata: Metadata = {
  title: "Betting Assistant · Mundial 2026",
  description: "Análisis y gestión de apuestas partido a partido",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={barlowCondensed.variable}>
        <nav style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "var(--surface)", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 0,
          padding: "0 24px", height: 48,
        }}>
          <Link href="/hoy" style={{
            textDecoration: "none",
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: 14, textTransform: "uppercase", letterSpacing: "0.08em",
            color: "var(--text)", padding: "0 16px", height: "100%",
            display: "flex", alignItems: "center",
          }}>
            HOY
          </Link>
          <Link href="/grupos" style={{
            textDecoration: "none",
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: 14, textTransform: "uppercase", letterSpacing: "0.08em",
            color: "var(--text-muted)", padding: "0 16px", height: "100%",
            display: "flex", alignItems: "center",
          }}>
            GRUPOS
          </Link>
          <Link href="/historial" style={{
            textDecoration: "none",
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: 14, textTransform: "uppercase", letterSpacing: "0.08em",
            color: "var(--text-muted)", padding: "0 16px", height: "100%",
            display: "flex", alignItems: "center",
          }}>
            HISTORIAL
          </Link>
        </nav>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Paso 9.2: Actualizar `src/app/page.tsx`** — redirigir a /hoy

```tsx
// src/app/page.tsx
import { redirect } from "next/navigation"

export default function HomePage() {
  redirect("/hoy")
}
```

- [ ] **Paso 9.3: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx
git commit -m "feat: navbar con navegacion HOY/GRUPOS/HISTORIAL y redirect root a /hoy"
```

---

## Task 10: Tests finales, push y PR

- [ ] **Paso 10.1: Ejecutar todos los tests**

```bash
pnpm test
```
Esperado: todos en PASS

- [ ] **Paso 10.2: Build de producción**

```bash
pnpm build
```
Esperado: sin errores de TypeScript ni de build

- [ ] **Paso 10.3: Push y abrir PR**

```bash
git push origin feat/engine-kelly-ui
```

Abrir PR en GitHub:
- Title: `feat: engine de análisis + sistema Kelly + UI completa`
- Base: `main`
- Description: engine de mercados con EV, Kelly fraccionado con portfolio, tracker de apuestas, páginas /hoy /partido /historial
- Nota en PR: **Hacer merge de `feat/data-model` primero, luego este PR**

---

## Orden de merge

```
1. feat/data-model   → main   (Dev 1 termina primero o en paralelo)
2. feat/engine-kelly-ui → main  (después de que feat/data-model esté en main)
```

Si Dev 2 termina antes: hacer `git merge main` en la rama para traer los cambios de Dev 1 antes de abrir el PR final.

---

## Resumen de commits esperados

```
test: agregar factories de mocks para MatchData y MarketResult      (Task 1)
feat: motor de mercados con EV y deteccion de odds obsoletas        (Task 2)
feat: analyzer completo con EV, Kelly y alertas por partido         (Task 3)
feat: sistema Kelly completo con portfolio, bankroll y tracker      (Task 4)
feat: server actions para leer analisis, bankroll y registrar apuestas (Task 5)
feat: pagina /hoy con dashboard de bankroll y partidos por EV       (Task 6)
feat: pagina de analisis por partido con modelo, mercados y Kelly   (Task 7)
feat: pagina historial con KPIs, CLV, drawdown y tabla              (Task 8)
feat: navbar y redirect root a /hoy                                 (Task 9)
```
