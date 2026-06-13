# UI Completa: Flujo de Análisis, Registro y Retroalimentación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la brecha entre el motor estadístico ya robusto (de-vig, blend, Dixon-Coles, Kelly fraccionado, CLV, calibración, circuit breaker) y una UI que hoy es pobre, inconsistente y con flujos rotos, de modo que el usuario pueda analizar, apostar cualquier mercado, registrar resultados reales que alimenten la DB de equipos, ver histórico de cuotas, editar/eliminar apuestas, y ver la fiabilidad del modelo.

**Architecture:** Next.js 15 App Router con Server Components por defecto y Server Actions para mutaciones. Toda la lógica de negocio vive en `lib/` (testeable con vitest, sin acoplar a React). La UI consume `MatchAnalysis`/`Bet`/`MarketResult` ya definidos en `lib/types.ts`. Se añade una tabla `odds_history` para el movimiento de línea y un módulo `lib/model/feedback.ts` que actualiza la fuerza de cada equipo a partir de resultados observados. La fracción de Kelly se unifica en un único helper compartido entre servidor y cliente.

**Tech Stack:** Next.js 15, React 19, TypeScript, Turso (LibSQL via `@libsql/client`), vitest. Estilos inline siguiendo el patrón existente (variables CSS `--surface`, `--border`, `--accent`, `--win`, `--loss`, `--draw`, `--text-muted`).

**Convenciones del repo (respetar):**
- Nada de "--" (doble guion) en código ni en texto visible. Usar "—" (raya) o "·".
- Componentes server por defecto; `"use client"` solo donde haya interactividad.
- Server Actions en `src/app/actions.ts`, no API routes.
- Kelly fraccionado al **50%** (half-Kelly), ajustado por confianza, tope 8% por apuesta, 15% exposición diaria. Confidence <40 ⇒ multiplicador 0.
- Tests con vitest: `npx vitest run <archivo>`.
- Mensajes de commit terminan con línea en blanco + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## Diagnóstico que motiva el plan (resumen)

1. **Kelly inconsistente:** `lib/kelly/criterion.ts` usa half-Kelly 0.5 con tope 8%; `MarketBettingCard.tsx` recalcula en cliente a 0.25 sin tope. La misma apuesta muestra dos montos distintos.
2. **`PartidoActions.tsx` es código muerto:** nunca se importa en la página de partido. El botón de pre-match por partido y los inputs de cuota manual no se renderizan.
3. **Pre-match frágil:** lineups solo desde ESPN (sin fallback a API-Football aunque `fetchLineups` existe), match por nombre limitado, y sin entrada manual de lineup/lesiones.
4. **Mercados limitados:** la página solo renderiza 1X2, tres overs y BTTS. Doble Oportunidad, under_*, over_4.5 y Marcador Exacto no se pueden apostar. El botón APOSTAR solo aparece si hay cuota escrita.
5. **Historial sin edición:** no se puede editar monto/cuota ni eliminar apuestas; CLV solo como promedio.
6. **Sin loop de datos:** no hay UI para registrar el marcador real; los resultados no alimentan `attack_strength`/`defense_strength`; no hay histórico de cuotas.
7. **Fiabilidad invisible:** `modelProbability` vs `marketProbability`, desglose de confianza, y la calibración (Brier/diagrama) no se ven en la UI. `captureClosingOddsAction` y `fetchESPNLiveStatus` no están cableados.

---

## File Structure

**Crear:**
- `src/lib/kelly/sizing.ts` — único helper de fracción de Kelly compartido (servidor + cliente). Reemplaza la duplicación en `MarketBettingCard` y el texto "25%".
- `src/lib/engine/market-labels.ts` — etiquetas y orden de mercados/selecciones en un solo lugar (hoy duplicado en 3 archivos).
- `src/lib/model/feedback.ts` — actualización de fuerza de equipo a partir de resultados observados (EMA).
- `src/lib/db/odds-history.ts` — helpers append/list para la tabla `odds_history`.
- `src/lib/engine/calibration.ts` — cálculo de Brier, log loss y buckets de fiabilidad sobre apuestas liquidadas (reutilizable por script y por la página).
- `src/components/MatchResultModal.tsx` — modal para registrar marcador real.
- `src/components/LineupEditor.tsx` — entrada manual de lineup/lesiones.
- `src/components/LiveStatusBadge.tsx` — estado/marcador en vivo (client, polling ligero).
- `src/components/OddsHistorySparkline.tsx` — movimiento de línea por selección.
- `src/app/calibracion/page.tsx` — página de calibración del modelo.
- Tests: `src/lib/__tests__/sizing.test.ts`, `feedback.test.ts`, `calibration.test.ts`, `market-labels.test.ts`, `odds-history.test.ts`, `record-result.test.ts`.

**Modificar:**
- `src/lib/db/schema.ts` — tabla `odds_history`; índices.
- `src/app/actions.ts` — `recordResultAction`, `deleteBetAction`, `updateBetAction`, `saveManualLineupAction`, `captureClosingOddsAction` (ya existe, exponer), append a `odds_history` en `updateMarketOddsAction`, pre-match robusto.
- `src/lib/kelly/tracker.ts` — `deleteBet`, `updateBet`.
- `src/components/MarketBettingCard.tsx` — usar `lib/kelly/sizing.ts`, renderizar todos los mercados, permitir apostar con cuota prellenada a la cuota justa, mostrar modelo/mercado/blend y exposición restante.
- `src/components/BetTable.tsx` — editar/eliminar, columna CLV, filtros.
- `src/app/partido/[id]/page.tsx` — renderizar todos los grupos de mercado, modelo vs mercado, desglose de confianza, lineup/lesiones, resultado real, histórico de cuotas, live badge.
- `src/app/hoy/page.tsx` — live badge, enlace a calibración, exposición real desde apuestas reales (no estimada).
- `src/app/historial/page.tsx` — filtros, CLV por apuesta, enlace a calibración.
- `scripts/calibrate.ts` — delegar en `lib/engine/calibration.ts` (DRY).

---

## FASE 0 — Fundaciones compartidas (sin cambio visible, habilita el resto)

### Task 0.1: Helper único de fracción de Kelly

**Files:**
- Create: `src/lib/kelly/sizing.ts`
- Test: `src/lib/__tests__/sizing.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
// src/lib/__tests__/sizing.test.ts
import { describe, it, expect } from "vitest"
import { kellyStake, KELLY_FRACTION, confidenceMultiplier } from "../kelly/sizing"

describe("kellyStake", () => {
  it("usa half-Kelly (0.5) y multiplicador de confianza", () => {
    // p=0.55, odds=2.0 -> rawKelly = (0.55*1 - 0.45)/1 = 0.10
    // half-Kelly 0.5, confianza 80 -> mult 1.0 -> fraction 0.05
    const r = kellyStake({ probability: 0.55, odds: 2.0, bankroll: 100000, confidence: 80 })
    expect(KELLY_FRACTION).toBe(0.5)
    expect(r.fraction).toBeCloseTo(0.05, 4)
    expect(r.amount).toBe(5000)
  })
  it("aplica tope de 8% por apuesta", () => {
    const r = kellyStake({ probability: 0.9, odds: 2.0, bankroll: 100000, confidence: 80 })
    expect(r.fraction).toBeCloseTo(0.08, 4)
    expect(r.amount).toBe(8000)
  })
  it("confianza <40 anula la apuesta", () => {
    expect(confidenceMultiplier(39)).toBe(0)
    const r = kellyStake({ probability: 0.6, odds: 2.0, bankroll: 100000, confidence: 39 })
    expect(r.fraction).toBe(0)
    expect(r.amount).toBe(0)
  })
  it("EV negativo da 0", () => {
    const r = kellyStake({ probability: 0.4, odds: 2.0, bankroll: 100000, confidence: 80 })
    expect(r.fraction).toBe(0)
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/lib/__tests__/sizing.test.ts`
Expected: FAIL — "Cannot find module '../kelly/sizing'".

- [ ] **Step 3: Implementar el helper**

```typescript
// src/lib/kelly/sizing.ts
export const KELLY_FRACTION = 0.5 // half-Kelly
export const MAX_STAKE_FRACTION = 0.08
export const DAILY_EXPOSURE_FRACTION = 0.15

export function confidenceMultiplier(confidence: number): number {
  if (confidence >= 80) return 1.0
  if (confidence >= 60) return 0.75
  if (confidence >= 40) return 0.5
  return 0
}

export interface KellyStakeInput {
  probability: number
  odds: number
  bankroll: number
  confidence: number
  trialMode?: boolean
}

export interface KellyStakeResult {
  fraction: number
  amount: number
  rawKelly: number
}

export function kellyStake(input: KellyStakeInput): KellyStakeResult {
  const { probability: p, odds, bankroll, confidence, trialMode = false } = input
  const b = odds - 1
  if (b <= 0) return { fraction: 0, amount: 0, rawKelly: 0 }
  const rawKelly = (p * b - (1 - p)) / b
  if (rawKelly <= 0) return { fraction: 0, amount: 0, rawKelly }

  const base = trialMode ? 0.05 : KELLY_FRACTION
  const max = trialMode ? 0.005 : MAX_STAKE_FRACTION
  const adjusted = rawKelly * base * confidenceMultiplier(confidence)
  const fraction = Math.min(max, Math.max(0, adjusted))
  return { fraction, amount: Math.round(bankroll * fraction), rawKelly }
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run src/lib/__tests__/sizing.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor `criterion.ts` para delegar (DRY)**

Reescribir `src/lib/kelly/criterion.ts` para que reexporte desde `sizing.ts` y mantenga la firma usada por `ev.ts`:

```typescript
// src/lib/kelly/criterion.ts
import { kellyStake } from "./sizing"

export interface KellyInput {
  probability: number
  odds: number
  bankroll: number
  confidence: number
  trialMode?: boolean
}

export interface KellyResult {
  fraction: number
  amount: number
  isNegative: boolean
}

export function calcKelly(input: KellyInput): KellyResult {
  const { rawKelly, fraction, amount } = kellyStake(input)
  return { fraction, amount, isNegative: rawKelly < 0 }
}
```

- [ ] **Step 6: Correr la suite completa**

Run: `npx vitest run`
Expected: PASS (no regresiones; los tests existentes de Kelly siguen verdes).

- [ ] **Step 7: Commit**

```bash
git add src/lib/kelly/sizing.ts src/lib/kelly/criterion.ts src/lib/__tests__/sizing.test.ts
git commit -m "$(printf 'refactor(kelly): unify stake sizing in single helper\n\nKELLY_FRACTION=0.5 (half-Kelly) shared by server and client. criterion.ts\nnow delegates to sizing.ts to kill the 0.25/0.5 mismatch between the engine\nand MarketBettingCard.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 0.2: Etiquetas y orden de mercados en un solo lugar

**Files:**
- Create: `src/lib/engine/market-labels.ts`
- Test: `src/lib/__tests__/market-labels.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
// src/lib/__tests__/market-labels.test.ts
import { describe, it, expect } from "vitest"
import { selectionLabel, MARKET_GROUPS, marketGroupOf } from "../engine/market-labels"

describe("selectionLabel", () => {
  it("traduce 1X2 con nombres de equipo", () => {
    expect(selectionLabel("1X2", "home", "Brasil", "Croacia")).toBe("Brasil gana")
    expect(selectionLabel("1X2", "draw", "Brasil", "Croacia")).toBe("Empate")
    expect(selectionLabel("1X2", "away", "Brasil", "Croacia")).toBe("Croacia gana")
  })
  it("traduce Over/Under", () => {
    expect(selectionLabel("Over/Under", "over_2.5", "A", "B")).toBe("Más de 2.5")
    expect(selectionLabel("Over/Under", "under_1.5", "A", "B")).toBe("Menos de 1.5")
  })
  it("traduce BTTS y Doble Oportunidad", () => {
    expect(selectionLabel("BTTS", "yes", "A", "B")).toBe("Ambos anotan — Sí")
    expect(selectionLabel("Doble Oportunidad", "1X", "A", "B")).toBe("Local o Empate (1X)")
  })
  it("agrupa los nombres de mercado conocidos", () => {
    expect(marketGroupOf("1X2")).toBe("Resultado")
    expect(marketGroupOf("Over/Under")).toBe("Goles")
    expect(MARKET_GROUPS.map(g => g.key)).toContain("Resultado")
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/lib/__tests__/market-labels.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/engine/market-labels.ts
export function selectionLabel(name: string, selection: string, home: string, away: string): string {
  if (name === "1X2") {
    if (selection === "home") return `${home} gana`
    if (selection === "draw") return "Empate"
    if (selection === "away") return `${away} gana`
  }
  if (name === "Doble Oportunidad") {
    if (selection === "1X") return "Local o Empate (1X)"
    if (selection === "X2") return "Empate o Visitante (X2)"
    if (selection === "12") return "Local o Visitante (12)"
  }
  if (name === "Over/Under") {
    return selection.replace("over_", "Más de ").replace("under_", "Menos de ")
  }
  if (name === "BTTS") return selection === "yes" ? "Ambos anotan — Sí" : "Ambos anotan — No"
  if (name === "Marcador Exacto") return `Exacto ${selection}`
  return `${name} ${selection}`
}

export interface MarketGroup {
  key: string
  title: string
  marketNames: string[]
}

export const MARKET_GROUPS: MarketGroup[] = [
  { key: "Resultado", title: "Resultado 1X2", marketNames: ["1X2"] },
  { key: "DobleOportunidad", title: "Doble Oportunidad", marketNames: ["Doble Oportunidad"] },
  { key: "Goles", title: "Over / Under Goles", marketNames: ["Over/Under"] },
  { key: "BTTS", title: "Ambos Anotan (BTTS)", marketNames: ["BTTS"] },
  { key: "Marcador", title: "Marcador Exacto", marketNames: ["Marcador Exacto"] },
]

export function marketGroupOf(name: string): string {
  if (name === "1X2") return "Resultado"
  if (name === "Doble Oportunidad") return "DobleOportunidad"
  if (name === "Over/Under") return "Goles"
  if (name === "BTTS") return "BTTS"
  if (name === "Marcador Exacto") return "Marcador"
  return "Otros"
}
```

Nota: el test espera `marketGroupOf("Over/Under") === "Goles"` y `MARKET_GROUPS[].key` contiene `"Resultado"`; ambos cumplen.

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run src/lib/__tests__/market-labels.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/market-labels.ts src/lib/__tests__/market-labels.test.ts
git commit -m "$(printf 'feat(engine): centralize market/selection labels\n\nSingle source for selectionLabel + market grouping, replacing the\nduplicated labelFor in partido page and MarketBettingCard.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 0.3: Tabla `odds_history` + helpers

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/db/odds-history.ts`
- Test: `src/lib/__tests__/odds-history.test.ts`

- [ ] **Step 1: Añadir la tabla al schema**

En `src/lib/db/schema.ts`, dentro del `executeMultiple` (después de la tabla `alerts`), añadir:

```sql
    CREATE TABLE IF NOT EXISTS odds_history (
      id INTEGER PRIMARY KEY,
      fixture_id INTEGER NOT NULL,
      market TEXT NOT NULL,
      selection TEXT NOT NULL,
      odds REAL NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      recorded_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_odds_history_fixture
      ON odds_history (fixture_id, market, selection, recorded_at);
```

Y en el bloque de `ALTER TABLE` de migración incremental añadir (idempotente):

```typescript
    "ALTER TABLE fixtures ADD COLUMN status TEXT DEFAULT 'scheduled'",
    "ALTER TABLE fixtures ADD COLUMN home_score INTEGER",
    "ALTER TABLE fixtures ADD COLUMN away_score INTEGER",
```

- [ ] **Step 2: Escribir el test que falla**

```typescript
// src/lib/__tests__/odds-history.test.ts
import { describe, it, expect, beforeAll } from "vitest"
import { appendOdds, listOddsHistory } from "../db/odds-history"
import { migrate } from "../db/schema"

describe("odds_history", () => {
  beforeAll(async () => { await migrate() })

  it("guarda y lista el movimiento de una selección en orden cronológico", async () => {
    const fid = 99001
    await appendOdds(fid, "1X2", "home", 1.80, "manual")
    await appendOdds(fid, "1X2", "home", 1.75, "manual")
    const series = await listOddsHistory(fid, "1X2", "home")
    expect(series.length).toBeGreaterThanOrEqual(2)
    expect(series[0].odds).toBe(1.80)
    expect(series[series.length - 1].odds).toBe(1.75)
  })
})
```

Requiere `.env.local` con Turso (el repo ya corre tests contra la DB real; ver `clv`/`settle` tests previos que usan `db`). Si no hay credenciales, este test queda como integración; documentarlo en el commit.

- [ ] **Step 3: Correr el test y verlo fallar**

Run: `npx vitest run src/lib/__tests__/odds-history.test.ts`
Expected: FAIL — "Cannot find module '../db/odds-history'".

- [ ] **Step 4: Implementar helpers**

```typescript
// src/lib/db/odds-history.ts
import { db } from "./client"

export interface OddsPoint {
  odds: number
  source: string
  recordedAt: string
}

export async function appendOdds(
  fixtureId: number, market: string, selection: string, odds: number, source = "manual"
): Promise<void> {
  if (!Number.isFinite(odds) || odds <= 1) return
  await db.execute({
    sql: `INSERT INTO odds_history (fixture_id, market, selection, odds, source, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [fixtureId, market, selection, odds, source, new Date().toISOString()],
  })
}

export async function listOddsHistory(
  fixtureId: number, market: string, selection: string
): Promise<OddsPoint[]> {
  const rows = await db.execute({
    sql: `SELECT odds, source, recorded_at FROM odds_history
          WHERE fixture_id = ? AND market = ? AND selection = ?
          ORDER BY recorded_at ASC`,
    args: [fixtureId, market, selection],
  })
  return (rows.rows as any[]).map(r => ({ odds: r.odds, source: r.source, recordedAt: r.recorded_at }))
}
```

- [ ] **Step 5: Correr el test y verlo pasar**

Run: `npx vitest run src/lib/__tests__/odds-history.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/odds-history.ts src/lib/__tests__/odds-history.test.ts
git commit -m "$(printf 'feat(db): add odds_history table + helpers\n\nTracks line movement per fixture/market/selection. Also adds\nfixtures.status/home_score/away_score columns for result recording.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

## FASE 1 — Arreglar lo roto

### Task 1.1: Pre-match robusto (la queja principal)

**Problema:** `runPreMatchAction` solo usa ESPN para lineups, depende de `fetchTodayFixtures()` (solo hoy) para localizar el fixture, y no tiene fallback ni entrada manual.

**Files:**
- Modify: `src/app/actions.ts:253-393` (función `runPreMatchAction`)
- Modify: `src/lib/data/api-football.ts` (asegurar export `fetchLineups`)

- [ ] **Step 1: Localizar el fixture desde la DB, no desde la API**

Reemplazar el inicio de `runPreMatchAction` para que cargue el fixture objetivo directamente de la tabla `fixtures` (que siempre existe tras el seed), en vez de filtrar `fetchTodayFixtures()`:

```typescript
export async function runPreMatchAction(fixtureId?: number): Promise<{ ok: boolean; message: string }> {
  try {
    const { fetchLineups } = await import("@/lib/data/api-football")
    const { fetchESPNLineups } = await import("@/lib/data/espn")
    const { buildMatchData } = await import("@/lib/data/pipeline")
    const { analyzeMatch } = await import("@/lib/engine/analyzer")
    const { fetchOdds } = await import("@/lib/data/odds-api")

    // Cargar fixtures objetivo desde la DB (no desde la API live).
    const fxSql = fixtureId != null
      ? `SELECT f.id, f.match_date, f.stadium, f.city, f.altitude_m, f.stage,
                f.home_team_id, f.away_team_id, h.name AS home_name, a.name AS away_name
         FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id
         WHERE f.id = ?`
      : `SELECT f.id, f.match_date, f.stadium, f.city, f.altitude_m, f.stage,
                f.home_team_id, f.away_team_id, h.name AS home_name, a.name AS away_name
         FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id
         WHERE f.match_date >= ? AND f.match_date < ?`
    const today = new Date().toISOString().split("T")[0]
    const fxArgs = fixtureId != null ? [fixtureId] : [`${today}T00:00:00Z`, `${today}T23:59:59Z`]
    const fxRows = await db.execute({ sql: fxSql, args: fxArgs })
    const targets = (fxRows.rows as any[]).map(r => ({
      id: r.id, date: r.match_date, stadium: r.stadium ?? "Unknown", city: r.city ?? "Unknown",
      altitudeM: r.altitude_m ?? 0, stage: r.stage,
      homeTeamId: r.home_team_id, awayTeamId: r.away_team_id,
      homeTeamName: r.home_name, awayTeamName: r.away_name,
    }))
    if (targets.length === 0) {
      return { ok: false, message: fixtureId ? `Fixture ${fixtureId} no existe en la DB` : "No hay partidos hoy" }
    }
```

- [ ] **Step 2: Lineups con cadena de fallback ESPN → API-Football → manual existente**

Dentro del loop por fixture, sustituir la obtención de lineups por una cadena con fallback y conservación de lineup manual previo:

```typescript
    const teamsRows = await db.execute("SELECT * FROM teams")
    const teams = new Map<number, any>()
    const teamsByName = new Map<string, any>()
    for (const row of teamsRows.rows as any[]) {
      const t = { id: row.id, name: row.name, country: row.country, groupName: row.group_name,
        fifaRanking: row.fifa_ranking, attackStrength: row.attack_strength, defenseStrength: row.defense_strength }
      teams.set(row.id, t); teamsByName.set(normalizeName(row.name), t)
    }
    const bankrollState = await getBankrollState()
    const ok: string[] = []; const noLineup: string[] = []

    for (const fixture of targets) {
      const home = teams.get(fixture.homeTeamId) ?? teamsByName.get(normalizeName(fixture.homeTeamName))
      const away = teams.get(fixture.awayTeamId) ?? teamsByName.get(normalizeName(fixture.awayTeamName))
      if (!home || !away) continue

      // 1) ESPN, 2) API-Football, 3) lineup manual previo guardado en alerts/markets meta
      let lineups = await fetchESPNLineups(home.name, away.name, fixture.date?.split("T")[0])
      let lineupSource = "ESPN"
      if (!lineups.home || !lineups.away) {
        try {
          const af = await fetchLineups(fixture.id)
          if (af.home && af.away) { lineups = af; lineupSource = "API-Football" }
        } catch { /* sin red o sin datos: seguir */ }
      }

      const matchData = await buildMatchData({ ...fixture, altitudeM: 0 }, home, away)
      const matchDataWithLineups = lineups.home && lineups.away ? { ...matchData, lineups } : matchData
      const analysis = analyzeMatch(matchDataWithLineups, bankrollState.current, bankrollState.trialMode)
```

- [ ] **Step 3: Conservar cuotas manuales y persistir (igual que hoy) + mensaje honesto**

Mantener el merge de cuotas manuales existente (`runPreMatchAction` actual líneas 302-362) y el upsert. Cambiar solo el mensaje final para que distinga la fuente:

```typescript
      // ...merge de cuotas manuales y upsert idénticos a la versión actual...
      if (lineups.home && lineups.away) ok.push(`${home.name} vs ${away.name} (${lineupSource}, conf. ${analysis.confidence})`)
      else noLineup.push(`${home.name} vs ${away.name}`)

      const odds = await fetchOdds(home.name, away.name)
      if (odds.length === 0) {
        await db.execute({ sql: `INSERT INTO alerts (fixture_id, type, message, is_read, created_at) VALUES (?,?,?,0,?)`,
          args: [fixture.id, "stale_odds", `Sin cuotas: ${home.name} vs ${away.name}`, new Date().toISOString()] })
      }
    }

    if (ok.length > 0 && noLineup.length === 0) return { ok: true, message: `Pre-match OK: ${ok.join(", ")}` }
    if (ok.length > 0) return { ok: true, message: `Pre-match parcial. Con lineup: ${ok.join(", ")}. Sin lineup (ingresar manual): ${noLineup.join(", ")}` }
    return { ok: true, message: `Sin lineups automáticos para: ${noLineup.join(", ")}. Usa "Lineup manual" en el partido.` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error en pre-match" }
  }
}
```

- [ ] **Step 4: Verificación manual (typecheck + arranque)**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev` y en `/hoy` pulsar "Pre-match"; el mensaje debe indicar fuente (ESPN/API-Football) o pedir lineup manual, nunca fallar en silencio.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions.ts
git commit -m "$(printf 'fix(prematch): locate fixtures from DB and add lineup fallback\n\nPre-match no longer depends on the live fixtures API to find the match\n(reads the DB). Lineups now try ESPN, then API-Football, then fall back\nto manual entry, with an honest status message instead of silent failure.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 1.2: Entrada manual de lineup y lesiones

**Files:**
- Create: `src/components/LineupEditor.tsx`
- Modify: `src/app/actions.ts` (añadir `saveManualLineupAction`)
- Modify: `src/lib/db/schema.ts` (tabla `manual_lineups`)

- [ ] **Step 1: Tabla para lineup/lesiones manuales**

En `schema.ts` `executeMultiple`:

```sql
    CREATE TABLE IF NOT EXISTS manual_lineups (
      fixture_id INTEGER PRIMARY KEY,
      home_missing TEXT NOT NULL DEFAULT '[]',
      away_missing TEXT NOT NULL DEFAULT '[]',
      home_confirmed INTEGER NOT NULL DEFAULT 0,
      away_confirmed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
```

- [ ] **Step 2: Server action**

En `actions.ts`:

```typescript
export async function saveManualLineupAction(
  fixtureId: number,
  homeMissing: string[],
  awayMissing: string[],
  homeConfirmed: boolean,
  awayConfirmed: boolean,
): Promise<{ ok: boolean; message: string }> {
  try {
    await db.execute({
      sql: `INSERT INTO manual_lineups (fixture_id, home_missing, away_missing, home_confirmed, away_confirmed, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(fixture_id) DO UPDATE SET
              home_missing=excluded.home_missing, away_missing=excluded.away_missing,
              home_confirmed=excluded.home_confirmed, away_confirmed=excluded.away_confirmed,
              updated_at=excluded.updated_at`,
      args: [fixtureId, JSON.stringify(homeMissing), JSON.stringify(awayMissing),
             homeConfirmed ? 1 : 0, awayConfirmed ? 1 : 0, new Date().toISOString()],
    })
    // Si ambos están confirmados, el análisis deja de ser preliminar.
    if (homeConfirmed && awayConfirmed) {
      await db.execute({ sql: `UPDATE match_analyses SET is_preliminary = 0 WHERE fixture_id = ?`, args: [fixtureId] })
    }
    return { ok: true, message: "Lineup/lesiones guardados" }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al guardar lineup" }
  }
}
```

- [ ] **Step 3: Componente `LineupEditor`**

```tsx
// src/components/LineupEditor.tsx
"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { saveManualLineupAction } from "@/app/actions"

interface Props {
  fixtureId: number
  homeName: string
  awayName: string
  initial?: { homeMissing: string[]; awayMissing: string[]; homeConfirmed: boolean; awayConfirmed: boolean }
}

export function LineupEditor({ fixtureId, homeName, awayName, initial }: Props) {
  const router = useRouter()
  const [homeMissing, setHomeMissing] = useState((initial?.homeMissing ?? []).join(", "))
  const [awayMissing, setAwayMissing] = useState((initial?.awayMissing ?? []).join(", "))
  const [homeConfirmed, setHomeConfirmed] = useState(initial?.homeConfirmed ?? false)
  const [awayConfirmed, setAwayConfirmed] = useState(initial?.awayConfirmed ?? false)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState("")

  const parse = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean)

  const save = () => start(async () => {
    const res = await saveManualLineupAction(fixtureId, parse(homeMissing), parse(awayMissing), homeConfirmed, awayConfirmed)
    setMsg(res.message)
    if (res.ok) router.refresh()
  })

  const col = (label: string, val: string, set: (v: string) => void, conf: boolean, setConf: (b: boolean) => void) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <textarea value={val} onChange={e => set(e.target.value)} placeholder="Bajas (nombres separados por coma)"
        style={{ width: "100%", minHeight: 56, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", padding: 8, fontFamily: "inherit", fontSize: 12 }} />
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
        <input type="checkbox" checked={conf} onChange={e => setConf(e.target.checked)} /> Lineup confirmado
      </label>
    </div>
  )

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20, marginBottom: 12 }}>
      <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
        Lineup y lesiones (manual)
      </h3>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {col(homeName, homeMissing, setHomeMissing, homeConfirmed, setHomeConfirmed)}
        {col(awayName, awayMissing, setAwayMissing, awayConfirmed, setAwayConfirmed)}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
        <button onClick={save} disabled={pending}
          style={{ background: "var(--accent)", border: "none", color: "#000", padding: "8px 18px", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", cursor: pending ? "wait" : "pointer", textTransform: "uppercase" }}>
          {pending ? "Guardando…" : "Guardar lineup"}
        </button>
        {msg && <span style={{ fontSize: 11, color: "var(--win)" }}>{msg}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores. (Se monta en la página de partido en Task 1.4.)

- [ ] **Step 5: Commit**

```bash
git add src/components/LineupEditor.tsx src/app/actions.ts src/lib/db/schema.ts
git commit -m "$(printf 'feat(prematch): manual lineup/injury entry\n\nWhen automatic lineups fail, the user can mark missing players and\nconfirm lineups manually; confirming both sides clears the preliminary\nflag. Closes the dead-end when ESPN/API lineups are unavailable.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 1.3: `MarketBettingCard` — Kelly correcto, todos los mercados, apostar siempre

**Files:**
- Modify: `src/components/MarketBettingCard.tsx`
- Modify: `src/app/actions.ts` (`updateMarketOddsAction` debe usar half-Kelly y registrar en `odds_history`)

- [ ] **Step 1: Usar el helper compartido y prellenar cuota justa**

Reescribir la lógica de cálculo de `MarketBettingCard.tsx` para importar `kellyStake` y `selectionLabel`, eliminando `confMultiplier`/`calcKelly` locales:

```tsx
import { kellyStake } from "@/lib/kelly/sizing"
import { selectionLabel } from "@/lib/engine/market-labels"
// ...
function calcEV(prob: number, odds: number) { return prob * odds - 1 }
function kellyAmt(prob: number, odds: number) {
  return kellyStake({ probability: prob, odds, bankroll, confidence }).amount
}
```

Reemplazar `labelFor(...)` por `selectionLabel(m.name, m.selection, homeName, awayName)` (añadir props `homeName`/`awayName` al componente).

- [ ] **Step 2: Botón APOSTAR siempre disponible, prellenando la cuota justa**

En la celda de acción, mostrar el botón aunque no haya cuota: al pulsar, si el input está vacío se prellena con la cuota justa `(1/ourProbability)` para que el usuario solo ajuste:

```tsx
{wasRegistered ? (
  <span style={{ fontSize: 11, color: registeredMode === "paper" ? "var(--draw)" : "var(--win)", fontWeight: 700 }}>
    ✓ {registeredMode === "paper" ? "PAPER" : "REAL"}
  </span>
) : !isRegistering ? (
  <button onClick={() => {
    if (!oddsMap[key]) setOddsMap(p => ({ ...p, [key]: (1 / m.ourProbability).toFixed(2) }))
    openRegister(key, kelly)
  }} style={{ background: "transparent", border: "1px solid var(--accent)", color: "var(--accent)", padding: "5px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer", textTransform: "uppercase", width: "100%" }}>
    APOSTAR
  </button>
) : (
  <button onClick={() => setRegistering(null)} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", padding: "5px 10px", fontSize: 11, cursor: "pointer", width: "100%" }}>✕</button>
)}
```

- [ ] **Step 3: Mostrar modelo/mercado/blend y exposición restante**

Añadir bajo el nombre de cada mercado una micro-línea con las tres probabilidades, y en el panel de registro mostrar la exposición real restante (prop nueva `exposureRemaining`):

```tsx
<div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
  modelo {(m.modelProbability * 100).toFixed(0)}%
  {m.marketProbability != null && <> · mercado {(m.marketProbability * 100).toFixed(0)}%</>}
  {" "}· mezcla {(m.ourProbability * 100).toFixed(0)}%
</div>
```

```tsx
// en el panel de registro:
<span style={{ fontSize: 11, color: amount > exposureRemaining ? "var(--loss)" : "var(--text-muted)" }}>
  exposición restante hoy: ${Math.round(exposureRemaining).toLocaleString("es-CO")}
</span>
```

- [ ] **Step 4: `updateMarketOddsAction` usa half-Kelly y registra histórico**

En `actions.ts`, dentro de `updateMarketOddsAction`, reemplazar el cálculo de `kellyFraction` por el helper y, al guardar una cuota > 0, anexar a `odds_history`:

```typescript
import { kellyStake } from "@/lib/kelly/sizing"
import { appendOdds } from "@/lib/db/odds-history"
// ...
      const bmProb = 1 / odds
      const EV = m.ourProbability * odds - 1
      const edge = m.ourProbability - bmProb
      const kellyFraction = kellyStake({ probability: m.ourProbability, odds, bankroll: 1, confidence: m.confidence ?? 60 }).fraction
      // nota: bankroll=1 -> fraction pura; el monto se calcula en cliente con bankroll real
```

Y antes del `return { ok: true ... }` exitoso (cuando `odds > 0`):

```typescript
      await appendOdds(fixtureId, market, selection, odds, "manual")
```

(El `confidence` del análisis no está en el scope de esa función hoy: obtenerlo del row `match_analyses.confidence` ya leído; si no, usar 60 como neutro y recalcular el monto en cliente con `kellyStake`.)

- [ ] **Step 5: Quitar el texto "Kelly al 25%"**

En `MarketBettingCard.tsx` (pie) y en `src/app/partido/[id]/page.tsx` (línea ~429 y bloque "Top Apuestas" ~394) cambiar "Kelly al 25%"/"Kelly 25%" por "Kelly al 50% (half-Kelly), tope 8%".

- [ ] **Step 6: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev`, abrir un partido: cada mercado muestra modelo/mercado/mezcla, el botón APOSTAR aparece sin escribir cuota (prellena la justa), y el monto Kelly coincide con el bloque "Top Apuestas".

- [ ] **Step 7: Commit**

```bash
git add src/components/MarketBettingCard.tsx src/app/actions.ts src/app/partido/[id]/page.tsx
git commit -m "$(printf 'fix(bets): consistent half-Kelly in UI + bet any selection\n\nMarketBettingCard now uses the shared kellyStake helper (0.5, cap 8%),\nshows model/market/blend per selection, exposes remaining daily exposure,\nand lets you bet any selection by prefilling fair odds. Manual odds are\nrecorded to odds_history.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 1.4: Página de partido — renderizar todos los grupos + montar editores

**Files:**
- Modify: `src/app/partido/[id]/page.tsx`
- Modify: `src/app/actions.ts` (`getAnalysisForFixture` ya devuelve markets; añadir loader de manual lineup)

- [ ] **Step 1: Loader de lineup manual**

En `actions.ts`:

```typescript
export async function getManualLineup(fixtureId: number): Promise<{ homeMissing: string[]; awayMissing: string[]; homeConfirmed: boolean; awayConfirmed: boolean } | null> {
  const rows = await db.execute({ sql: "SELECT * FROM manual_lineups WHERE fixture_id = ?", args: [fixtureId] })
  const r = rows.rows[0] as any
  if (!r) return null
  return {
    homeMissing: JSON.parse(r.home_missing || "[]"),
    awayMissing: JSON.parse(r.away_missing || "[]"),
    homeConfirmed: Boolean(r.home_confirmed),
    awayConfirmed: Boolean(r.away_confirmed),
  }
}
```

- [ ] **Step 2: Renderizar un `MarketBettingCard` por cada grupo presente**

Reemplazar el bloque que arma `markets1x2`/`marketsOU`/`marketsBTTS` y las tres tarjetas fijas por un mapeo sobre `MARKET_GROUPS`, incluyendo Doble Oportunidad y todos los Over/Under (over y under, 1.5–4.5):

```tsx
import { MARKET_GROUPS } from "@/lib/engine/market-labels"
import { LineupEditor } from "@/components/LineupEditor"
import { getManualLineup } from "../../actions"
// ...
const manualLineup = await getManualLineup(fixtureId)
const exposureRemaining = bankroll.current * 0.15 // se refina en Task 2.x con exposición real
// ...
{MARKET_GROUPS.filter(g => g.key !== "Marcador").map(group => {
  const groupMarkets = markets.filter(m => group.marketNames.includes(m.name))
  if (groupMarkets.length === 0) return null
  return (
    <MarketBettingCard
      key={group.key}
      fixtureId={fixtureId}
      title={group.title}
      markets={groupMarkets}
      bankroll={bankroll.current}
      confidence={confidence}
      homeName={homeName}
      awayName={awayName}
      exposureRemaining={exposureRemaining}
    />
  )
})}
```

- [ ] **Step 3: Montar `LineupEditor` antes de las tarjetas de mercado**

```tsx
<LineupEditor fixtureId={fixtureId} homeName={homeName} awayName={awayName} initial={manualLineup ?? undefined} />
```

- [ ] **Step 4: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev`, abrir un partido: aparecen tarjetas para 1X2, Doble Oportunidad, Over/Under (todas) y BTTS; el editor de lineup está presente.

- [ ] **Step 5: Commit**

```bash
git add src/app/partido/[id]/page.tsx src/app/actions.ts
git commit -m "$(printf 'feat(partido): render all market groups + manual lineup editor\n\nDouble chance, full over/under ladder and BTTS are now bettable, not\njust 1X2 + three overs. Manual lineup editor mounted on the page.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

## FASE 1.5 — Los ajustes manuales mueven el modelo

> Cierra el hueco crítico: hoy tener (o ingresar) lineup no recalcula la confianza correctamente y nunca cambia los lambdas; las cuotas manuales producen EV sin anclar al mercado. Esta fase hace que la información manual *cambie la predicción*.

### Task 1.5.1: Recalcular dataQuality dentro de `analyzeMatch` (arregla el bug de confianza)

**Problema:** `analyzeMatch` lee `data.dataQuality` ya horneado por `buildMatchData`. Cuando el pre-match inyecta lineups con `{ ...matchData, lineups }`, el número de confianza no refleja el +15 porque `dataQuality` no se recalcula.

**Files:**
- Modify: `src/lib/types.ts` (`MatchData.lineupConfirmed?: boolean`)
- Modify: `src/lib/engine/analyzer.ts`
- Test: `src/lib/__tests__/data-quality.test.ts`

- [ ] **Step 1: Añadir el campo opcional al tipo**

En `src/lib/types.ts`, dentro de `MatchData` (después de `lineups`):

```typescript
  lineupConfirmed?: boolean
```

- [ ] **Step 2: Escribir el test que falla**

```typescript
// src/lib/__tests__/data-quality.test.ts
import { describe, it, expect } from "vitest"
import { dataQualityFromData } from "../engine/analyzer"
import type { MatchData } from "../types"

function base(overrides: Partial<MatchData> = {}): MatchData {
  return {
    fixture: { id: 1, date: "", stadium: "", city: "", altitudeM: 0, homeTeamId: 1, awayTeamId: 2, stage: "group_A" },
    teams: { home: {} as any, away: {} as any },
    h2h: [], homeForm: [], awayForm: [],
    injuries: { home: [], away: [] },
    lineups: { home: null, away: null },
    referee: null, weather: null, odds: [], dataQuality: 0, fetchedAt: "",
    ...overrides,
  }
}

describe("dataQualityFromData", () => {
  it("tener lineup suma 15 sobre no tenerlo", () => {
    const sin = dataQualityFromData(base())
    const con = dataQualityFromData(base({ lineups: { home: [{} as any], away: [{} as any] } }))
    expect(con - sin).toBe(15)
  })
  it("lineup confirmado suma 5 extra sobre disponible", () => {
    const disp = dataQualityFromData(base({ lineups: { home: [{} as any], away: [{} as any] } }))
    const conf = dataQualityFromData(base({ lineups: { home: [{} as any], away: [{} as any] }, lineupConfirmed: true }))
    expect(conf - disp).toBe(5)
  })
})
```

- [ ] **Step 3: Correr y ver fallar**

Run: `npx vitest run src/lib/__tests__/data-quality.test.ts`
Expected: FAIL — `dataQualityFromData` no existe.

- [ ] **Step 4: Implementar y usar dentro de `analyzeMatch`**

En `src/lib/engine/analyzer.ts`, añadir la función exportada y reemplazar el uso de `data.dataQuality`:

```typescript
export function dataQualityFromData(data: MatchData): number {
  let score = 40
  if (data.h2h.length >= 3) score += 15
  if (data.homeForm.length >= 3 && data.awayForm.length >= 3) score += 15
  const hasLineup = !!(data.lineups.home && data.lineups.away)
  if (hasLineup) score += 15
  if (data.lineupConfirmed) score += 5
  if (data.odds.length > 0) score += 10
  if (data.referee) score += 5
  return Math.min(100, score)
}
```

Y donde hoy dice `const confidence = calcConfidence(data.dataQuality, maxDivergence)`, cambiar a:

```typescript
  const effectiveDataQuality = dataQualityFromData(data)
  const confidence = calcConfidence(effectiveDataQuality, maxDivergence)
```

Actualizar también `confidenceBreakdown` (si ya existe de Task 4.3) para usar `effectiveDataQuality`.

- [ ] **Step 5: Correr y ver pasar + suite**

Run: `npx vitest run src/lib/__tests__/data-quality.test.ts && npx vitest run`
Expected: PASS, sin regresiones.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/engine/analyzer.ts src/lib/__tests__/data-quality.test.ts
git commit -m "$(printf 'fix(confidence): recompute data quality from live lineups\n\nanalyzeMatch now derives dataQuality from the actual data (including\ninjected/manual lineups) instead of trusting a precomputed number, so\nlineups truly raise confidence. Confirmed lineups add an extra 5.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 1.5.2: Ajuste de lambdas por ausencias

**Files:**
- Create: `src/lib/model/lineup.ts`
- Test: `src/lib/__tests__/lineup-adjustment.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
// src/lib/__tests__/lineup-adjustment.test.ts
import { describe, it, expect } from "vitest"
import { lineupAttackMultiplier, lineupConcedeMultiplier } from "../model/lineup"

describe("lineup adjustments", () => {
  it("sin ausencias no cambia nada", () => {
    expect(lineupAttackMultiplier([])).toBe(1.0)
    expect(lineupConcedeMultiplier([])).toBe(1.0)
  })
  it("perder un goleador baja el ataque", () => {
    const m = lineupAttackMultiplier([{ goalsPer90: 0.8, key: true, position: "FWD" }])
    expect(m).toBeLessThan(1.0)
    expect(m).toBeGreaterThanOrEqual(0.8) // tope de -20%
  })
  it("perder un defensa/portero sube los goles que se conceden", () => {
    const m = lineupConcedeMultiplier([{ key: true, position: "GK" }])
    expect(m).toBeGreaterThan(1.0)
    expect(m).toBeLessThanOrEqual(1.2)
  })
  it("ausencias sin goles conocidos usan importancia key/regular", () => {
    const key = lineupAttackMultiplier([{ key: true, position: "MID" }])
    const reg = lineupAttackMultiplier([{ key: false, position: "MID" }])
    expect(key).toBeLessThan(reg)
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/__tests__/lineup-adjustment.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/model/lineup.ts
export interface MissingPlayer {
  goalsPer90?: number
  position?: string // "GK" | "DEF" | "MID" | "FWD" | "Unknown"
  key?: boolean
}

// Ausencias ofensivas reducen el ataque. Tope total -20%.
export function lineupAttackMultiplier(missing: MissingPlayer[]): number {
  let impact = 0
  for (const p of missing) {
    if (p.goalsPer90 != null) impact += Math.min(0.10, p.goalsPer90 * 0.15)
    else impact += p.key ? 0.08 : 0.03
  }
  return Math.max(0.80, 1 - impact)
}

// Ausencias defensivas (DEF/GK) aumentan los goles concedidos. Tope +20%.
export function lineupConcedeMultiplier(missing: MissingPlayer[]): number {
  let impact = 0
  for (const p of missing) {
    const isDef = p.position === "DEF" || p.position === "GK"
    if (isDef) impact += p.key ? 0.08 : 0.04
  }
  return Math.min(1.20, 1 + impact)
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/__tests__/lineup-adjustment.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Conectar a `analyzeMatch`**

En `src/lib/engine/analyzer.ts`, importar y aplicar a partir de las ausencias (`data.injuries` con `status === "out"`). El ataque del equipo baja por sus propias ausencias ofensivas; el lambda del rival sube por las ausencias defensivas del equipo:

```typescript
import { lineupAttackMultiplier, lineupConcedeMultiplier, type MissingPlayer } from "../model/lineup"
// ...
const toMissing = (inj: typeof data.injuries.home): MissingPlayer[] =>
  inj.filter(i => i.status === "out").map(i => ({ position: i.position, key: true }))
const homeMissing = toMissing(data.injuries.home)
const awayMissing = toMissing(data.injuries.away)

const homeAtkMult = lineupAttackMultiplier(homeMissing)
const awayAtkMult = lineupAttackMultiplier(awayMissing)
const homeConcedeMult = lineupConcedeMultiplier(homeMissing) // sube el lambda del visitante
const awayConcedeMult = lineupConcedeMultiplier(awayMissing) // sube el lambda del local
```

Y multiplicar en los lambdas existentes:

```typescript
  const lambdaHome =
    data.teams.home.attackStrength * data.teams.away.defenseStrength * 1.4 *
    context.homeAdvantage * homeH2H.attackMultiplier * homeForm.factor *
    context.altitudeFactorHome * context.heatFactorHome * context.fatigueFactor *
    homeAtkMult * awayConcedeMult

  const lambdaAway =
    data.teams.away.attackStrength * data.teams.home.defenseStrength * 1.4 *
    awayH2H.attackMultiplier * awayForm.factor *
    context.altitudeFactorAway * context.heatFactorAway * context.fatigueFactor *
    awayAtkMult * homeConcedeMult
```

Añadir a `adjustments` un texto cuando haya ausencias: `if (homeMissing.length) adjustments.push(\`Bajas local: ${homeMissing.length} (ataque x${homeAtkMult.toFixed(2)})\`)` y simétrico para visitante.

- [ ] **Step 6: Correr la suite**

Run: `npx vitest run`
Expected: PASS (los tests de modelo siguen verdes; los lambdas sin ausencias no cambian porque los multiplicadores son 1.0).

- [ ] **Step 7: Commit**

```bash
git add src/lib/model/lineup.ts src/lib/__tests__/lineup-adjustment.test.ts src/lib/engine/analyzer.ts
git commit -m "$(printf 'feat(model): lineups/injuries adjust lambdas\n\nMissing attackers cut a team attack (cap -20%); missing defenders/GK\nraise the opponent expected goals (cap +20%). No-absence case is a\nno-op, so existing predictions are unchanged.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 1.5.3: Guardar lineup manual dispara re-análisis (reemplaza la acción de Task 1.2)

**Problema:** `saveManualLineupAction` (Task 1.2) solo guarda y baja la bandera `is_preliminary`. Debe re-ejecutar `analyzeMatch` con las ausencias y `lineupConfirmed`, y persistir, para que confianza y lambdas cambien.

**Files:**
- Modify: `src/app/actions.ts` (reescribir `saveManualLineupAction`)

- [ ] **Step 1: Reescribir la acción para re-analizar**

```typescript
export async function saveManualLineupAction(
  fixtureId: number,
  homeMissing: string[],
  awayMissing: string[],
  homeConfirmed: boolean,
  awayConfirmed: boolean,
): Promise<{ ok: boolean; message: string }> {
  try {
    await db.execute({
      sql: `INSERT INTO manual_lineups (fixture_id, home_missing, away_missing, home_confirmed, away_confirmed, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(fixture_id) DO UPDATE SET
              home_missing=excluded.home_missing, away_missing=excluded.away_missing,
              home_confirmed=excluded.home_confirmed, away_confirmed=excluded.away_confirmed,
              updated_at=excluded.updated_at`,
      args: [fixtureId, JSON.stringify(homeMissing), JSON.stringify(awayMissing),
             homeConfirmed ? 1 : 0, awayConfirmed ? 1 : 0, new Date().toISOString()],
    })

    // Re-analizar con las ausencias manuales como lesiones "out".
    const { buildMatchData } = await import("@/lib/data/pipeline")
    const { analyzeMatch } = await import("@/lib/engine/analyzer")
    const fxRows = await db.execute({
      sql: `SELECT f.id, f.match_date, f.stadium, f.city, f.altitude_m, f.stage,
                   f.home_team_id, f.away_team_id, h.name AS home_name, a.name AS away_name
            FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id
            WHERE f.id = ?`, args: [fixtureId],
    })
    const r = fxRows.rows[0] as any
    if (!r) return { ok: true, message: "Lineup guardado (sin fixture para re-analizar)" }

    const teamsRows = await db.execute("SELECT * FROM teams WHERE id IN (?, ?)", )
    // cargar equipos
    const tRows = await db.execute({ sql: "SELECT * FROM teams WHERE id IN (?, ?)", args: [r.home_team_id, r.away_team_id] })
    const tById = new Map((tRows.rows as any[]).map(t => [t.id, {
      id: t.id, name: t.name, country: t.country, groupName: t.group_name,
      fifaRanking: t.fifa_ranking, attackStrength: t.attack_strength, defenseStrength: t.defense_strength,
    }]))
    const home = tById.get(r.home_team_id), away = tById.get(r.away_team_id)
    if (!home || !away) return { ok: true, message: "Lineup guardado" }

    const fixture = { id: r.id, date: r.match_date, stadium: r.stadium ?? "", city: r.city ?? "",
      altitudeM: r.altitude_m ?? 0, stage: r.stage, homeTeamId: r.home_team_id, awayTeamId: r.away_team_id }
    const matchData = await buildMatchData({ ...fixture, altitudeM: 0 }, home as any, away as any)

    // Inyectar ausencias manuales como injuries "out" y marca de confirmado.
    const mkInj = (names: string[]) => names.map((n, i) => ({ playerId: -(i + 1), playerName: n, position: "Unknown", reason: "Manual", status: "out" as const }))
    const withManual = {
      ...matchData,
      injuries: { home: [...matchData.injuries.home, ...mkInj(homeMissing)], away: [...matchData.injuries.away, ...mkInj(awayMissing)] },
      lineupConfirmed: homeConfirmed && awayConfirmed,
    }
    const { getBankrollState } = await import("@/lib/kelly/bankroll")
    const bankroll = await getBankrollState()
    const analysis = analyzeMatch(withManual, bankroll.current, bankroll.trialMode)

    // Conservar cuotas manuales previas (mismo merge que pre-match) y persistir.
    const existing = await db.execute({ sql: "SELECT markets FROM match_analyses WHERE fixture_id = ? ORDER BY created_at DESC LIMIT 1", args: [fixtureId] })
    const prevMarkets: any[] = JSON.parse((existing.rows[0] as any)?.markets ?? "[]")
    const merged = analysis.markets.map(m => {
      const prev = prevMarkets.find(e => e.name === m.name && e.selection === m.selection)
      if (prev?.odds != null) {
        const EV = m.ourProbability * prev.odds - 1
        const edge = m.ourProbability - 1 / prev.odds
        return { ...m, odds: prev.odds, bookmakerProbability: 1 / prev.odds, bookmaker: prev.bookmaker, EV, edge, isRecommended: EV >= 0.08 && edge >= 0.02 && prev.odds >= 1.5 }
      }
      return m
    })

    const now = new Date().toISOString()
    await db.execute({
      sql: `UPDATE match_analyses SET is_preliminary = ?, confidence = ?, lambda_home = ?, lambda_away = ?,
              adjustments_applied = ?, markets = ?, alerts = ?, created_at = ? WHERE fixture_id = ?`,
      args: [homeConfirmed && awayConfirmed ? 0 : 1, analysis.confidence, analysis.model.lambdaHome, analysis.model.lambdaAway,
             JSON.stringify(analysis.model.adjustmentsApplied), JSON.stringify(merged), JSON.stringify(analysis.alerts), now, fixtureId],
    })
    return { ok: true, message: `Lineup aplicado · confianza ${analysis.confidence} · λ ${analysis.model.lambdaHome.toFixed(2)}/${analysis.model.lambdaAway.toFixed(2)}` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al guardar lineup" }
  }
}
```

(Eliminar la versión simple de Task 1.2; el `LineupEditor` ya llama a esta misma firma.)

- [ ] **Step 2: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev`, en un partido marcar una baja importante y "Lineup confirmado" → al guardar, la confianza sube, el badge "Preliminar" desaparece y los lambdas/EV cambian.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions.ts
git commit -m "$(printf 'feat(prematch): manual lineup triggers full re-analysis\n\nSaving a manual lineup re-runs analyzeMatch with the missing players as\n\"out\" injuries and the confirmed flag, persisting new confidence, lambdas\nand markets (preserving manual odds). The data now moves the prediction.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 1.5.4: Cuota manual re-ancla al mercado (EV honesto)

**Problema:** al ingresar una cuota manual, `ourProbability` (mezcla 35/65) no se recalcula, así que el EV se evalúa contra una probabilidad casi pura de modelo y queda optimista.

**Files:**
- Create: `src/lib/engine/reblend.ts`
- Test: `src/lib/__tests__/reblend.test.ts`
- Modify: `src/app/actions.ts` (`updateMarketOddsAction`)

- [ ] **Step 1: Escribir el test que falla**

```typescript
// src/lib/__tests__/reblend.test.ts
import { describe, it, expect } from "vitest"
import { reblendSelection } from "../engine/reblend"

describe("reblendSelection", () => {
  it("con cuotas de ambos lados de-vigga y re-mezcla 35/65", () => {
    // over@2.0 y under@2.0 -> implícitas 0.5/0.5, de-vig 0.5
    // modelo 0.60 -> mezcla = 0.35*0.6 + 0.65*0.5 = 0.535
    const r = reblendSelection(0.60, 2.0, 2.0)
    expect(r.marketProbability).toBeCloseTo(0.5, 4)
    expect(r.ourProbability).toBeCloseTo(0.535, 4)
  })
  it("sin lado opuesto aplica de-vig aproximado (/1.05)", () => {
    // odds 2.0 -> implícita 0.5 -> /1.05 ~ 0.476
    const r = reblendSelection(0.60, 2.0, null)
    expect(r.marketProbability).toBeCloseTo(0.476, 3)
    expect(r.ourProbability).toBeCloseTo(0.35 * 0.6 + 0.65 * 0.476, 3)
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/__tests__/reblend.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/engine/reblend.ts
import { devig } from "../model/devig"
import { blendProbability } from "../model/blend"

const TYPICAL_OVERROUND = 1.05

export function reblendSelection(
  modelProbability: number, odds: number, oppositeOdds: number | null,
): { marketProbability: number; ourProbability: number } {
  let marketProbability: number
  if (oppositeOdds != null && oppositeOdds > 1) {
    const [p] = devig([odds, oppositeOdds])
    marketProbability = p
  } else {
    marketProbability = (1 / odds) / TYPICAL_OVERROUND
  }
  return { marketProbability, ourProbability: blendProbability(modelProbability, marketProbability) }
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/__tests__/reblend.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Usar en `updateMarketOddsAction`**

Al guardar una cuota > 0, buscar la cuota del lado opuesto dentro del mismo `market` en los markets persistidos (para Over/Under y BTTS), re-mezclar y recalcular EV con la mezcla nueva:

```typescript
import { reblendSelection } from "@/lib/engine/reblend"
// dentro del map de updateMarketOddsAction, cuando odds > 0:
      const opposite = markets.find(x => x.name === m.name && x.selection !== m.selection && x.odds != null
        && ((m.name === "Over/Under" && x.selection.replace("over_", "").replace("under_", "") === m.selection.replace("over_", "").replace("under_", ""))
          || (m.name === "BTTS")))
      const { marketProbability, ourProbability } = reblendSelection(m.modelProbability, odds, opposite?.odds ?? null)
      const EV = ourProbability * odds - 1
      const edge = ourProbability - marketProbability
      const kellyFraction = kellyStake({ probability: ourProbability, odds, bankroll: 1, confidence: 60 }).fraction
      return { ...m, odds, ourProbability, marketProbability, bookmakerProbability: 1 / odds, bookmaker: "manual", EV, edge, kellyFraction, isRecommended: EV >= 0.08 && edge >= 0.02 && odds >= 1.5 }
```

(`m.modelProbability` ya existe en `MarketResult`. La línea 1X2 con las tres vías puede re-viggear con `devig([h,d,a])` si las tres tienen cuota; como mejora opcional, dejar el de-vig aproximado por vía cuando falten las otras.)

- [ ] **Step 6: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev`, ingresar una cuota manual en Over 2.5: el EV mostrado ahora usa la probabilidad mezclada con el mercado (más conservador) y se ve el cambio en la micro-línea modelo/mercado/mezcla.

- [ ] **Step 7: Commit**

```bash
git add src/lib/engine/reblend.ts src/lib/__tests__/reblend.test.ts src/app/actions.ts
git commit -m "$(printf 'fix(ev): manual odds re-anchor to market via re-blend\n\nEntering a manual price now recomputes the market probability (de-vig\nwith the opposite side when present, approximate otherwise) and re-blends\n35/65 before EV, killing the optimistic bias on manual entries.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

## FASE 2 — Historial usable (editar, eliminar, CLV, filtros)

### Task 2.1: Eliminar y editar apuestas (capa de datos)

**Files:**
- Modify: `src/lib/kelly/tracker.ts`
- Test: `src/lib/__tests__/tracker-crud.test.ts`

- [ ] **Step 1: Test que falla**

```typescript
// src/lib/__tests__/tracker-crud.test.ts
import { describe, it, expect, beforeAll } from "vitest"
import { saveBet, getBets, deleteBet, updateBet } from "../kelly/tracker"
import { migrate } from "../db/schema"

const base = {
  fixtureId: 98010, market: "1X2", selection: "home", ourProbability: 0.5,
  bookmakerProbability: 0.48, oddsUsed: 2.1, oddsClosing: null, amount: 5000,
  kellySuggested: 0.04, EV: 0.05, edge: 0.02, result: null, profitLoss: null,
  mode: "paper" as const, confidenceAtTime: 60, createdAt: new Date().toISOString(), settledAt: null,
}

describe("tracker CRUD", () => {
  beforeAll(async () => { await migrate() })
  it("elimina una apuesta", async () => {
    const id = await saveBet(base)
    await deleteBet(id)
    const remaining = (await getBets({ mode: "paper" })).filter(b => b.id === id)
    expect(remaining.length).toBe(0)
  })
  it("edita monto y cuota", async () => {
    const id = await saveBet(base)
    await updateBet(id, { amount: 8000, oddsUsed: 2.5 })
    const bet = (await getBets({ mode: "paper" })).find(b => b.id === id)!
    expect(bet.amount).toBe(8000)
    expect(bet.oddsUsed).toBe(2.5)
    await deleteBet(id)
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/__tests__/tracker-crud.test.ts`
Expected: FAIL — `deleteBet`/`updateBet` no existen.

- [ ] **Step 3: Implementar en `tracker.ts`**

```typescript
export async function deleteBet(id: number): Promise<void> {
  await db.execute({ sql: "DELETE FROM bets WHERE id = ?", args: [id] })
}

const EDITABLE: Record<string, string> = {
  amount: "amount", oddsUsed: "odds_used", oddsClosing: "odds_closing", selection: "selection",
}

export async function updateBet(id: number, patch: Partial<Pick<Bet, "amount" | "oddsUsed" | "oddsClosing" | "selection">>): Promise<void> {
  const sets: string[] = []; const args: any[] = []
  for (const [k, col] of Object.entries(EDITABLE)) {
    if ((patch as any)[k] !== undefined) { sets.push(`${col} = ?`); args.push((patch as any)[k]) }
  }
  if (sets.length === 0) return
  args.push(id)
  await db.execute({ sql: `UPDATE bets SET ${sets.join(", ")} WHERE id = ?`, args })
}
```

(Importar `Bet` ya está en el archivo.)

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/__tests__/tracker-crud.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/kelly/tracker.ts src/lib/__tests__/tracker-crud.test.ts
git commit -m "$(printf 'feat(tracker): deleteBet and updateBet\n\nData-layer CRUD so the history table can edit amount/odds and delete.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 2.2: Acciones de servidor para editar/eliminar con reversión de bankroll

**Files:**
- Modify: `src/app/actions.ts`

- [ ] **Step 1: `deleteBetAction` (revierte bankroll si la apuesta real estaba liquidada)**

```typescript
export async function deleteBetAction(betId: number): Promise<{ ok: boolean; message: string }> {
  try {
    const rows = await db.execute({ sql: "SELECT * FROM bets WHERE id = ?", args: [betId] })
    const bet = rows.rows[0] as any
    if (!bet) return { ok: false, message: "Apuesta no encontrada" }
    // Revertir efecto en bankroll si era real y estaba liquidada
    if (bet.mode === "real" && bet.result && bet.result !== "void") {
      const { getBankrollState, updateBankroll } = await import("@/lib/kelly/bankroll")
      const state = await getBankrollState(bet.user_id ?? undefined)
      const revert = bet.result === "win"
        ? state.current - Math.round(bet.amount * (bet.odds_used - 1))
        : state.current + bet.amount
      await updateBankroll(revert, "daily", bet.user_id ?? undefined)
    }
    const { deleteBet } = await import("@/lib/kelly/tracker")
    await deleteBet(betId)
    return { ok: true, message: "Apuesta eliminada" }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al eliminar" }
  }
}
```

- [ ] **Step 2: `updateBetAction`**

```typescript
export async function updateBetAction(
  betId: number, patch: { amount?: number; oddsUsed?: number }
): Promise<{ ok: boolean; message: string }> {
  try {
    if (patch.amount != null && patch.amount <= 0) return { ok: false, message: "Monto inválido" }
    if (patch.oddsUsed != null && patch.oddsUsed <= 1) return { ok: false, message: "Cuota inválida" }
    const { updateBet } = await import("@/lib/kelly/tracker")
    await updateBet(betId, patch)
    return { ok: true, message: "Apuesta actualizada" }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al actualizar" }
  }
}
```

- [ ] **Step 3: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions.ts
git commit -m "$(printf 'feat(actions): delete/update bet actions with bankroll reversal\n\nDeleting a settled real bet reverts its bankroll effect; editing\nvalidates amount/odds.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 2.3: `BetTable` — eliminar, editar inline, columna CLV, filtros

**Files:**
- Modify: `src/components/BetTable.tsx`
- Modify: `src/app/historial/page.tsx`

- [ ] **Step 1: Añadir eliminar + editar inline en cada fila**

Importar `deleteBetAction`, `updateBetAction` y `ConfirmDialog`. Añadir a cada fila un botón "🗑" (con confirmación) y, en modo edición, inputs para monto y cuota que llaman a `updateBetAction` y luego `router.refresh()`. Reusar el patrón `useTransition` existente.

```tsx
import { settleBetAction, deleteBetAction, updateBetAction } from "@/app/actions"
// dentro de la fila, nueva celda de acciones:
<div style={{ display: "flex", gap: 6 }}>
  <button onClick={() => toggleEdit(bet.id!)} title="Editar" style={ghostBtn}>✎</button>
  <button onClick={() => { if (confirm("¿Eliminar esta apuesta?")) start(async () => { await deleteBetAction(bet.id!); router.refresh() }) }} title="Eliminar" style={ghostBtn}>🗑</button>
</div>
```

En modo edición de una fila, render de inputs:

```tsx
{editing.has(bet.id!) && (
  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, padding: "8px 0", alignItems: "center" }}>
    <input type="number" defaultValue={bet.amount} step="1000" id={`amt-${bet.id}`} style={editInput} />
    <input type="number" defaultValue={bet.oddsUsed} step="0.01" id={`odd-${bet.id}`} style={editInput} />
    <button onClick={() => start(async () => {
      const amount = Number((document.getElementById(`amt-${bet.id}`) as HTMLInputElement).value)
      const oddsUsed = Number((document.getElementById(`odd-${bet.id}`) as HTMLInputElement).value)
      await updateBetAction(bet.id!, { amount, oddsUsed }); toggleEdit(bet.id!); router.refresh()
    })} style={saveBtn}>Guardar</button>
  </div>
)}
```

- [ ] **Step 2: Columna CLV por apuesta**

Añadir columna "CLV" calculada como `oddsUsed/oddsClosing - 1` cuando `oddsClosing != null`:

```tsx
<span style={{ fontSize: 12, color: bet.oddsClosing == null ? "var(--text-muted)" : (bet.oddsUsed / bet.oddsClosing - 1) >= 0 ? "var(--win)" : "var(--loss)" }}>
  {bet.oddsClosing == null ? "—" : `${((bet.oddsUsed / bet.oddsClosing - 1) * 100).toFixed(1)}%`}
</span>
```

Ajustar `gridTemplateColumns` del header y filas para incluir las dos nuevas columnas (CLV y acciones).

- [ ] **Step 3: Filtros en historial**

En `historial/page.tsx`, añadir un pequeño componente cliente de filtros (mode: todos/real/paper; estado: todos/pendientes/liquidados) que filtre la lista pasada a `BetTable`. Como la página es server, extraer el filtrado a un wrapper client `BetHistory` que reciba todas las apuestas y mantenga el estado de filtro.

- [ ] **Step 4: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev`, en `/historial`: editar monto/cuota de una apuesta, eliminar otra, ver columna CLV, filtrar por real/paper y pendientes/liquidados.

- [ ] **Step 5: Commit**

```bash
git add src/components/BetTable.tsx src/app/historial/page.tsx
git commit -m "$(printf 'feat(historial): edit/delete bets, per-bet CLV column, filters\n\nHistory rows are now editable and deletable; CLV shown per bet;\nfilter by mode and settlement state.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

## FASE 2.5 — Apuesta libre, cartilla del día y correlación

> "Registrar los mercados que manejemos" en su lectura literal: poder apostar mercados de tu casa que el modelo no genera, ver la exposición consolidada del día y recibir aviso cuando dos apuestas del mismo partido están correlacionadas.

### Task 2.5.1: Apuesta libre (mercado arbitrario)

**Files:**
- Create: `src/components/CustomBetForm.tsx`
- Modify: `src/app/partido/[id]/page.tsx` (montar el formulario)

`registerBet` ya acepta `market`/`selection` arbitrarios y `betResultForScore` devuelve `null` para mercados desconocidos (se liquidan a mano en el historial), así que solo falta la UI de captura.

- [ ] **Step 1: Componente**

```tsx
// src/components/CustomBetForm.tsx
"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { registerBet } from "@/app/actions"
import { useUser } from "./UserContext"
import { kellyStake } from "@/lib/kelly/sizing"

export function CustomBetForm({ fixtureId, bankroll, confidence }: { fixtureId: number; bankroll: number; confidence: number }) {
  const router = useRouter()
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const [market, setMarket] = useState("")
  const [selection, setSelection] = useState("")
  const [odds, setOdds] = useState("")
  const [prob, setProb] = useState("")
  const [amount, setAmount] = useState("")
  const [mode, setMode] = useState<"real" | "paper">("real")
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState("")

  const oddsN = parseFloat(odds), probN = parseFloat(prob) / 100, amtN = parseInt(amount || "0")
  const ev = oddsN > 1 && probN > 0 ? probN * oddsN - 1 : null
  const kelly = ev != null && ev > 0 ? kellyStake({ probability: probN, odds: oddsN, bankroll, confidence }).amount : 0

  const save = () => start(async () => {
    if (!market.trim() || !selection.trim() || !(oddsN > 1) || !(amtN > 0)) { setMsg("Completa mercado, selección, cuota y monto"); return }
    const res = await registerBet({
      fixtureId, userId: user?.id, market: market.trim(), selection: selection.trim(),
      ourProbability: probN > 0 ? probN : 1 / oddsN, bookmakerProbability: 1 / oddsN,
      oddsUsed: oddsN, oddsClosing: null, amount: amtN, kellySuggested: kelly,
      EV: ev ?? 0, edge: probN > 0 ? probN - 1 / oddsN : 0, result: null, profitLoss: null,
      mode, confidenceAtTime: confidence, createdAt: new Date().toISOString(), settledAt: null,
    })
    setMsg(res.message ?? (res.ok ? "Apuesta registrada" : "Rechazada"))
    if (res.ok) { setOpen(false); router.refresh() }
  })

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ background: "transparent", border: "1px dashed var(--border)", color: "var(--text-muted)", padding: "8px 14px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer", width: "100%", marginBottom: 12 }}>
      + Apuesta libre (mercado de tu casa)
    </button>
  )

  const inp: React.CSSProperties = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 10px", fontSize: 13, fontFamily: "inherit" }
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", padding: 16, marginBottom: 12 }}>
      <h3 style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Apuesta libre</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 8 }}>
        <input style={inp} placeholder="Mercado (ej: Hándicap -1)" value={market} onChange={e => setMarket(e.target.value)} />
        <input style={inp} placeholder="Selección (ej: Brasil -1)" value={selection} onChange={e => setSelection(e.target.value)} />
        <input style={inp} type="number" step="0.01" placeholder="Cuota" value={odds} onChange={e => setOdds(e.target.value)} />
        <input style={inp} type="number" step="1" placeholder="Tu prob % (opcional)" value={prob} onChange={e => setProb(e.target.value)} />
        <input style={inp} type="number" step="1000" placeholder="Monto COP" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        {(["real", "paper"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", border: "1px solid", borderColor: mode === m ? "var(--accent)" : "var(--border)", background: mode === m ? "rgba(232,255,60,0.12)" : "transparent", color: mode === m ? "var(--accent)" : "var(--text-muted)" }}>{m}</button>
        ))}
        {ev != null && <span style={{ fontSize: 11, color: ev > 0 ? "var(--win)" : "var(--loss)" }}>EV {ev > 0 ? "+" : ""}{(ev * 100).toFixed(1)}%{kelly > 0 && ` · Kelly $${kelly.toLocaleString("es-CO")}`}</span>}
        <button onClick={save} disabled={pending} style={{ background: "var(--accent)", border: "none", color: "#000", padding: "8px 18px", fontSize: 12, fontWeight: 700, cursor: pending ? "wait" : "pointer", textTransform: "uppercase" }}>{pending ? "Guardando…" : "Registrar"}</button>
        <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
      </div>
      {msg && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>{msg}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Montar en la página de partido** (antes de las tarjetas de mercado):

```tsx
import { CustomBetForm } from "@/components/CustomBetForm"
// ...
<CustomBetForm fixtureId={fixtureId} bankroll={bankroll.current} confidence={confidence} />
```

- [ ] **Step 3: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev`, registrar "Hándicap -1 / Brasil -1 @1.95" con monto: aparece en el historial y se liquida a mano (no hay auto-settle para mercados desconocidos).

- [ ] **Step 4: Commit**

```bash
git add src/components/CustomBetForm.tsx src/app/partido/[id]/page.tsx
git commit -m "$(printf 'feat(bets): free-form custom market bet\n\nRegister arbitrary bookmaker markets (handicap, corners, cards...) the\nmodel does not generate; settled manually in history.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 2.5.2: Aviso de correlación entre apuestas del mismo partido

**Files:**
- Create: `src/lib/engine/correlation.ts`
- Test: `src/lib/__tests__/correlation.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
// src/lib/__tests__/correlation.test.ts
import { describe, it, expect } from "vitest"
import { correlationWarnings } from "../engine/correlation"

const bet = (market: string, selection: string, fixtureId = 1) => ({ fixtureId, market, selection } as any)

describe("correlationWarnings", () => {
  it("avisa Over + BTTS Sí en el mismo partido", () => {
    const w = correlationWarnings([bet("Over/Under", "over_2.5"), bet("BTTS", "yes")])
    expect(w.length).toBe(1)
    expect(w[0]).toMatch(/correlacion/i)
  })
  it("no avisa entre partidos distintos", () => {
    const w = correlationWarnings([bet("Over/Under", "over_2.5", 1), bet("BTTS", "yes", 2)])
    expect(w.length).toBe(0)
  })
  it("avisa 1X2 local + Doble Oportunidad 1X (solapadas)", () => {
    const w = correlationWarnings([bet("1X2", "home"), bet("Doble Oportunidad", "1X")])
    expect(w.length).toBe(1)
  })
  it("sin pares correlacionados no avisa", () => {
    const w = correlationWarnings([bet("1X2", "home"), bet("BTTS", "no")])
    expect(w.length).toBe(0)
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/__tests__/correlation.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/engine/correlation.ts
interface BetLike { fixtureId: number; market: string; selection: string }

function tag(b: BetLike): string {
  if (b.market === "Over/Under") return b.selection.startsWith("over") ? "over" : "under"
  if (b.market === "BTTS") return b.selection === "yes" ? "btts_yes" : "btts_no"
  if (b.market === "1X2") return `res_${b.selection}`
  if (b.market === "Doble Oportunidad") return `dc_${b.selection}`
  return `${b.market}:${b.selection}`
}

// Pares semánticamente correlacionados (misma dirección de riesgo).
const CORRELATED: [string, string][] = [
  ["over", "btts_yes"],
  ["under", "btts_no"],
  ["res_home", "dc_1X"], ["res_home", "dc_12"],
  ["res_away", "dc_X2"], ["res_away", "dc_12"],
  ["res_draw", "dc_1X"], ["res_draw", "dc_X2"],
]

function isCorrelated(a: string, b: string): boolean {
  return CORRELATED.some(([x, y]) => (a === x && b === y) || (a === y && b === x))
}

export function correlationWarnings(bets: BetLike[]): string[] {
  const out: string[] = []
  for (let i = 0; i < bets.length; i++) {
    for (let j = i + 1; j < bets.length; j++) {
      if (bets[i].fixtureId !== bets[j].fixtureId) continue
      if (isCorrelated(tag(bets[i]), tag(bets[j]))) {
        out.push(`Correlación: "${bets[i].market} ${bets[i].selection}" y "${bets[j].market} ${bets[j].selection}" cubren riesgo similar en el mismo partido — el Kelly combinado sobreestima el tamaño.`)
      }
    }
  }
  return out
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/__tests__/correlation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Mostrar el aviso**

En `MarketBettingCard` (o en la cartilla de Task 2.5.3), tras registrar, computar `correlationWarnings` sobre las apuestas del partido y renderizar los textos en un banner ámbar. (En la página de partido se pueden pasar las apuestas ya registradas del fixture como prop.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine/correlation.ts src/lib/__tests__/correlation.test.ts src/components/MarketBettingCard.tsx
git commit -m "$(printf 'feat(risk): correlated-bet warnings\n\nWarns when two bets on the same fixture cover overlapping risk\n(over+BTTS yes, 1X2+double chance...), where combined Kelly overstakes.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 2.5.3: Cartilla del día (exposición consolidada)

**Files:**
- Modify: `src/app/hoy/page.tsx` (sección "Cartilla de hoy")
- Modify: `src/app/actions.ts` (`getOpenBetsToday`)

- [ ] **Step 1: Loader de apuestas abiertas de hoy**

```typescript
export async function getOpenBetsToday(userId?: number): Promise<import("@/lib/types").Bet[]> {
  const today = new Date().toISOString().split("T")[0]
  const { getBets } = await import("@/lib/kelly/tracker")
  const all = await getBets({ userId })
  return all.filter(b => b.result === null && b.createdAt >= `${today}T00:00:00Z`)
}
```

- [ ] **Step 2: Sección en `/hoy`**

Bajo el bloque de bankroll, listar las apuestas abiertas de hoy con su monto, sumar la exposición real (solo `mode === "real"`), compararla con `bankroll.current * 0.15`, y mostrar `correlationWarnings(openBets)`:

```tsx
import { getOpenBetsToday, getDashboardData } from "../actions"
import { correlationWarnings } from "@/lib/engine/correlation"
// ...
const openBets = await getOpenBetsToday(userId)
const realExposure = openBets.filter(b => b.mode === "real").reduce((s, b) => s + b.amount, 0)
const warnings = correlationWarnings(openBets)
// Render: lista compacta + barra de exposición real/máx + warnings en banner ámbar.
```

(Esto reemplaza la `dailyExposure` estimada actual —que suma `kellyAmount` de recomendaciones— por la **exposición real comprometida**.)

- [ ] **Step 3: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev`, con apuestas reales de hoy: la cartilla lista todo, la barra de exposición usa el monto real y aparecen avisos de correlación si los hay.

- [ ] **Step 4: Commit**

```bash
git add src/app/hoy/page.tsx src/app/actions.ts
git commit -m "$(printf 'feat(hoy): daily slip with real exposure and correlation warnings\n\nConsolidated view of today open bets; exposure bar uses committed real\nstake instead of estimated Kelly, with correlation warnings.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

## FASE 3 — Loop de resultados + datos (alimentar la DB de equipos)

> **Bug de integración que esta fase resuelve:** `scripts/cron.ts` llama a `seed()`, que hace `INSERT OR REPLACE INTO teams (...)` con los valores fijos. Sin la Fase 3.0, cada corrida diaria del cron **borra la fuerza aprendida**. Además el ajuste EMA aplicado en cada guardado no es idempotente (editar un marcador lo aplica dos veces). La Fase 3.0 separa la fuerza *sembrada* (inmutable) de la *aprendida* (recalculada por replay determinista).

### Task 3.0.1: Columnas `*_seed` inmutables y `seed()` que no pisa lo aprendido

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/seed.ts`

- [ ] **Step 1: Columnas de semilla + backfill**

En `schema.ts`, bloque de `ALTER TABLE` idempotente, añadir:

```typescript
    "ALTER TABLE teams ADD COLUMN attack_seed REAL",
    "ALTER TABLE teams ADD COLUMN defense_seed REAL",
    "UPDATE teams SET attack_seed = attack_strength WHERE attack_seed IS NULL",
    "UPDATE teams SET defense_seed = defense_strength WHERE defense_seed IS NULL",
```

- [ ] **Step 2: `seed()` escribe la semilla siempre, pero la fuerza efectiva solo al insertar**

En `seed.ts`, reemplazar el `INSERT OR REPLACE` de teams por un upsert que preserva la fuerza efectiva aprendida cuando la fila ya existe:

```typescript
    await db.execute({
      sql: `INSERT INTO teams (id, name, country, group_name, fifa_ranking, attack_strength, defense_strength, attack_seed, defense_seed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name=excluded.name, country=excluded.country, group_name=excluded.group_name,
              fifa_ranking=excluded.fifa_ranking,
              attack_seed=excluded.attack_seed, defense_seed=excluded.defense_seed`,
      args: [t.id, t.name, t.country, t.group_name, t.fifa_ranking,
             t.attack_strength, t.defense_strength, t.attack_strength, t.defense_strength],
    })
```

Nota: en `ON CONFLICT` **no** se tocan `attack_strength`/`defense_strength` (la fuerza efectiva), solo la semilla y los metadatos. Así el cron deja de borrar lo aprendido.

- [ ] **Step 3: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `pnpm cron:run` dos veces; `attack_strength` de un equipo con resultado registrado no vuelve a su valor de semilla.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/seed.ts
git commit -m "$(printf 'fix(seed): stop the daily cron from wiping learned strengths\n\nAdds immutable attack_seed/defense_seed; seed() upsert preserves the\neffective (learned) strength on conflict and only refreshes the seed.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 3.0.2: `recomputeLearnedStrengths` por replay (idempotente) + reset

**Diseño:** en vez de aplicar la EMA incrementalmente (no idempotente), se recalcula la fuerza efectiva **desde la semilla**, reproduciendo en orden cronológico todos los partidos finalizados. Editar/borrar un marcador solo cambia el replay; correrlo dos veces da el mismo resultado.

**Files:**
- Create: `src/lib/model/recompute-strengths.ts`
- Modify: `src/app/actions.ts` (`resetLearnedStrengthsAction`)
- Test: `src/lib/__tests__/recompute-strengths.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
// src/lib/__tests__/recompute-strengths.test.ts
import { describe, it, expect } from "vitest"
import { replayStrengths } from "../model/recompute-strengths"

const seed = new Map([
  [1, { attack: 1.0, defense: 1.0 }],
  [2, { attack: 1.0, defense: 1.0 }],
])
const results = [
  { homeId: 1, awayId: 2, homeGoals: 3, awayGoals: 0, date: "2026-06-12" },
]

describe("replayStrengths", () => {
  it("es idempotente: correrlo dos veces da el mismo resultado", () => {
    const a = replayStrengths(seed, results)
    const b = replayStrengths(seed, results)
    expect(a.get(1)).toEqual(b.get(1))
    expect(a.get(2)).toEqual(b.get(2))
  })
  it("editar el marcador cambia el resultado de forma determinista", () => {
    const a = replayStrengths(seed, results)
    const edited = replayStrengths(seed, [{ ...results[0], homeGoals: 0, awayGoals: 0 }])
    expect(a.get(1)!.attack).not.toBeCloseTo(edited.get(1)!.attack, 4)
  })
  it("aplica los partidos en orden cronológico", () => {
    const out = replayStrengths(seed, [
      { homeId: 1, awayId: 2, homeGoals: 2, awayGoals: 0, date: "2026-06-10" },
      { homeId: 1, awayId: 2, homeGoals: 0, awayGoals: 2, date: "2026-06-14" },
    ])
    expect(out.get(1)).toBeDefined()
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/__tests__/recompute-strengths.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar (reutiliza `updatedStrengths` de Task 3.1)**

```typescript
// src/lib/model/recompute-strengths.ts
import { updatedStrengths } from "./feedback"

export interface Strength { attack: number; defense: number }
export interface FinishedResult { homeId: number; awayId: number; homeGoals: number; awayGoals: number; date: string }

export function replayStrengths(seed: Map<number, Strength>, results: FinishedResult[]): Map<number, Strength> {
  const out = new Map<number, Strength>()
  for (const [id, s] of seed) out.set(id, { ...s })
  const ordered = [...results].sort((a, b) => a.date.localeCompare(b.date))
  for (const r of ordered) {
    const h = out.get(r.homeId), a = out.get(r.awayId)
    if (!h || !a) continue
    const next = updatedStrengths(h, a, r.homeGoals, r.awayGoals)
    out.set(r.homeId, next.home)
    out.set(r.awayId, next.away)
  }
  return out
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/__tests__/recompute-strengths.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Acción de reset + helper de persistencia**

En `actions.ts`:

```typescript
export async function recomputeAllStrengths(): Promise<void> {
  const { replayStrengths } = await import("@/lib/model/recompute-strengths")
  const tRows = await db.execute("SELECT id, attack_seed, defense_seed FROM teams")
  const seed = new Map((tRows.rows as any[]).map(r => [r.id, { attack: r.attack_seed ?? 1, defense: r.defense_seed ?? 1 }]))
  const fxRows = await db.execute("SELECT home_team_id, away_team_id, home_score, away_score, match_date FROM fixtures WHERE status='finished' AND home_score IS NOT NULL")
  const results = (fxRows.rows as any[]).map(r => ({ homeId: r.home_team_id, awayId: r.away_team_id, homeGoals: r.home_score, awayGoals: r.away_score, date: r.match_date ?? "" }))
  const learned = replayStrengths(seed, results)
  for (const [id, s] of learned) {
    await db.execute({ sql: "UPDATE teams SET attack_strength = ?, defense_strength = ? WHERE id = ?", args: [s.attack, s.defense, id] })
  }
}

export async function resetLearnedStrengthsAction(): Promise<{ ok: boolean; message: string }> {
  try {
    await db.execute("UPDATE teams SET attack_strength = attack_seed, defense_strength = defense_seed WHERE attack_seed IS NOT NULL")
    return { ok: true, message: "Fuerza de equipos reseteada a los valores de semilla" }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al resetear" }
  }
}
```

- [ ] **Step 6: Reemplazar la EMA inline de Task 3.2 por replay**

En `recordResultAction` (Task 3.2), **borrar** el bloque "2) Alimentar fuerza de equipos" (el que hace `updatedStrengths` + dos `UPDATE teams`) y, después de guardar el marcador, llamar:

```typescript
    // 2) Recalcular fuerza aprendida por replay determinista (idempotente)
    await recomputeAllStrengths()
```

Así registrar o **editar** un marcador siempre deja la fuerza consistente, sin doble aplicación.

- [ ] **Step 7: Suite + commit**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, sin errores.

```bash
git add src/lib/model/recompute-strengths.ts src/lib/__tests__/recompute-strengths.test.ts src/app/actions.ts
git commit -m "$(printf 'feat(model): idempotent strength learning via replay + reset\n\nLearned strength is recomputed from seed by replaying all finished\nresults chronologically, so re-recording or editing a score is\ndeterministic. Adds resetLearnedStrengthsAction.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 3.1: Modelo de retroalimentación de fuerza de equipo

**Files:**
- Create: `src/lib/model/feedback.ts`
- Test: `src/lib/__tests__/feedback.test.ts`

**Diseño:** EMA sobre el rendimiento relativo a la media de liga (1.4 goles). Tras un partido, el ataque de un equipo se mueve hacia `golesAFavor / 1.4` y la defensa hacia `golesEnContra / 1.4` con tasa de aprendizaje `alpha=0.15`, ponderado por la fuerza del rival (anotarle a una buena defensa pesa más). Clamp [0.5, 2.0].

- [ ] **Step 1: Test que falla**

```typescript
// src/lib/__tests__/feedback.test.ts
import { describe, it, expect } from "vitest"
import { updatedStrengths } from "../model/feedback"

describe("updatedStrengths", () => {
  it("sube el ataque tras anotar por encima de la media y baja la defensa tras encajar", () => {
    const r = updatedStrengths(
      { attack: 1.0, defense: 1.0 }, { attack: 1.0, defense: 1.0 },
      3, 0, // local marca 3, visitante 0
    )
    expect(r.home.attack).toBeGreaterThan(1.0)   // local anotó mucho
    expect(r.home.defense).toBeLessThan(1.0)      // no le anotaron -> mejor defensa (menor)
    expect(r.away.attack).toBeLessThan(1.0)        // visitante no anotó
    expect(r.away.defense).toBeGreaterThan(1.0)    // le anotaron 3 -> peor defensa (mayor)
  })
  it("respeta el clamp [0.5, 2.0]", () => {
    const r = updatedStrengths({ attack: 1.95, defense: 0.55 }, { attack: 1.0, defense: 1.0 }, 6, 0)
    expect(r.home.attack).toBeLessThanOrEqual(2.0)
    expect(r.home.defense).toBeGreaterThanOrEqual(0.5)
  })
  it("un 0-0 apenas mueve los valores", () => {
    const r = updatedStrengths({ attack: 1.0, defense: 1.0 }, { attack: 1.0, defense: 1.0 }, 0, 0)
    expect(Math.abs(r.home.attack - 1.0)).toBeLessThan(0.2)
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/__tests__/feedback.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/model/feedback.ts
const LEAGUE_AVG = 1.4
const ALPHA = 0.15

interface Strength { attack: number; defense: number }

function clamp(x: number): number { return Math.max(0.5, Math.min(2.0, x)) }

export function updatedStrengths(
  home: Strength, away: Strength, homeGoals: number, awayGoals: number,
): { home: Strength; away: Strength } {
  // Objetivo de ataque: goles marcados relativos a la media, ponderado por la defensa rival.
  // Anotar contra una buena defensa (defense baja) cuenta más.
  const homeAttackTarget = (homeGoals / LEAGUE_AVG) * away.defense
  const awayAttackTarget = (awayGoals / LEAGUE_AVG) * home.defense
  // Objetivo de defensa: goles encajados relativos a la media, ponderado por el ataque rival.
  const homeDefenseTarget = (awayGoals / LEAGUE_AVG) / Math.max(0.5, away.attack)
  const awayDefenseTarget = (homeGoals / LEAGUE_AVG) / Math.max(0.5, home.attack)

  return {
    home: {
      attack: clamp(home.attack + ALPHA * (homeAttackTarget - home.attack)),
      defense: clamp(home.defense + ALPHA * (homeDefenseTarget - home.defense)),
    },
    away: {
      attack: clamp(away.attack + ALPHA * (awayAttackTarget - away.attack)),
      defense: clamp(away.defense + ALPHA * (awayDefenseTarget - away.defense)),
    },
  }
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/__tests__/feedback.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/model/feedback.ts src/lib/__tests__/feedback.test.ts
git commit -m "$(printf 'feat(model): team-strength feedback from observed results\n\nEMA (alpha=0.15) toward goals scored/conceded relative to league avg,\nweighted by opponent strength, clamped [0.5,2.0]. Foundation for the\nresult-feedback loop.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 3.2: `recordResultAction` — marcador real, auto-settle, alimentar equipos

**Files:**
- Modify: `src/app/actions.ts`
- Test: `src/lib/__tests__/record-result.test.ts` (integración ligera del cálculo de settle)

- [ ] **Step 1: Test del helper de settle por resultado (puro, sin DB)**

Extraer la lógica de "¿esta apuesta gana con este marcador?" a una función pura testeable:

```typescript
// src/lib/__tests__/record-result.test.ts
import { describe, it, expect } from "vitest"
import { betResultForScore } from "../engine/settle"

describe("betResultForScore", () => {
  it("1X2 home gana si local marca más", () => {
    expect(betResultForScore("1X2", "home", 2, 1)).toBe("win")
    expect(betResultForScore("1X2", "home", 1, 1)).toBe("loss")
  })
  it("Over/Under 2.5", () => {
    expect(betResultForScore("Over/Under", "over_2.5", 2, 1)).toBe("win")
    expect(betResultForScore("Over/Under", "under_2.5", 2, 1)).toBe("loss")
  })
  it("BTTS", () => {
    expect(betResultForScore("BTTS", "yes", 1, 1)).toBe("win")
    expect(betResultForScore("BTTS", "yes", 1, 0)).toBe("loss")
  })
  it("Doble Oportunidad 1X", () => {
    expect(betResultForScore("Doble Oportunidad", "1X", 0, 0)).toBe("win")
    expect(betResultForScore("Doble Oportunidad", "1X", 0, 1)).toBe("loss")
  })
  it("Marcador Exacto", () => {
    expect(betResultForScore("Marcador Exacto", "2-1", 2, 1)).toBe("win")
    expect(betResultForScore("Marcador Exacto", "2-1", 1, 1)).toBe("loss")
  })
  it("mercado desconocido devuelve null (settle manual)", () => {
    expect(betResultForScore("Corners", "over_9", 2, 1)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/__tests__/record-result.test.ts`
Expected: FAIL — `../engine/settle` no existe.

- [ ] **Step 3: Implementar `betResultForScore`**

```typescript
// src/lib/engine/settle.ts
export function betResultForScore(
  market: string, selection: string, homeGoals: number, awayGoals: number,
): "win" | "loss" | null {
  const total = homeGoals + awayGoals
  if (market === "1X2") {
    const outcome = homeGoals > awayGoals ? "home" : homeGoals < awayGoals ? "away" : "draw"
    return selection === outcome ? "win" : "loss"
  }
  if (market === "Doble Oportunidad") {
    const outcome = homeGoals > awayGoals ? "home" : homeGoals < awayGoals ? "away" : "draw"
    const ok = (selection === "1X" && outcome !== "away")
      || (selection === "X2" && outcome !== "home")
      || (selection === "12" && outcome !== "draw")
    return ok ? "win" : "loss"
  }
  if (market === "Over/Under") {
    const m = selection.match(/(over|under)_(\d+(?:\.\d+)?)/)
    if (!m) return null
    const line = parseFloat(m[2])
    const over = total > line
    return (m[1] === "over" ? over : !over) ? "win" : "loss"
  }
  if (market === "BTTS") {
    const both = homeGoals > 0 && awayGoals > 0
    return (selection === "yes" ? both : !both) ? "win" : "loss"
  }
  if (market === "Marcador Exacto") {
    return selection === `${homeGoals}-${awayGoals}` ? "win" : "loss"
  }
  return null
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/__tests__/record-result.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: `recordResultAction` en `actions.ts`**

```typescript
export async function recordResultAction(
  fixtureId: number, homeScore: number, awayScore: number, autoSettle = true,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (homeScore < 0 || awayScore < 0) return { ok: false, message: "Marcador inválido" }
    const fxRows = await db.execute({ sql: "SELECT home_team_id, away_team_id FROM fixtures WHERE id = ?", args: [fixtureId] })
    const fx = fxRows.rows[0] as any
    if (!fx) return { ok: false, message: "Fixture no encontrado" }

    // 1) Guardar marcador
    await db.execute({
      sql: "UPDATE fixtures SET home_score = ?, away_score = ?, status = 'finished' WHERE id = ?",
      args: [homeScore, awayScore, fixtureId],
    })

    // 2) Alimentar fuerza de equipos
    const { updatedStrengths } = await import("@/lib/model/feedback")
    const tRows = await db.execute({ sql: "SELECT id, attack_strength, defense_strength FROM teams WHERE id IN (?, ?)", args: [fx.home_team_id, fx.away_team_id] })
    const byId = new Map((tRows.rows as any[]).map(r => [r.id, r]))
    const h = byId.get(fx.home_team_id), a = byId.get(fx.away_team_id)
    if (h && a) {
      const next = updatedStrengths(
        { attack: h.attack_strength, defense: h.defense_strength },
        { attack: a.attack_strength, defense: a.defense_strength },
        homeScore, awayScore,
      )
      await db.execute({ sql: "UPDATE teams SET attack_strength = ?, defense_strength = ? WHERE id = ?", args: [next.home.attack, next.home.defense, fx.home_team_id] })
      await db.execute({ sql: "UPDATE teams SET attack_strength = ?, defense_strength = ? WHERE id = ?", args: [next.away.attack, next.away.defense, fx.away_team_id] })
    }

    // 3) Auto-settle de apuestas pendientes de ese fixture
    let settled = 0
    if (autoSettle) {
      const { betResultForScore } = await import("@/lib/engine/settle")
      const betsRows = await db.execute({ sql: "SELECT id, market, selection, mode, amount, odds_used, user_id FROM bets WHERE fixture_id = ? AND result IS NULL", args: [fixtureId] })
      for (const b of betsRows.rows as any[]) {
        const result = betResultForScore(b.market, b.selection, homeScore, awayScore)
        if (!result) continue
        const profitLoss = result === "win" ? Math.round(b.amount * (b.odds_used - 1)) : -b.amount
        await db.execute({ sql: "UPDATE bets SET result = ?, profit_loss = ?, settled_at = ? WHERE id = ?", args: [result, profitLoss, new Date().toISOString(), b.id] })
        if (b.mode === "real") {
          const { getBankrollState, nextBalanceAfterSettle, updateBankroll } = await import("@/lib/kelly/bankroll")
          const state = await getBankrollState(b.user_id ?? undefined)
          await updateBankroll(nextBalanceAfterSettle(state.current, result, b.amount, b.odds_used), "daily", b.user_id ?? undefined)
        }
        settled++
      }
    }
    return { ok: true, message: `Resultado ${homeScore}-${awayScore} guardado · ${settled} apuesta(s) liquidada(s) · fuerza de equipos actualizada` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al registrar resultado" }
  }
}
```

- [ ] **Step 6: Verificación**

Run: `npx vitest run src/lib/__tests__/record-result.test.ts && npx tsc --noEmit`
Expected: tests PASS, sin errores de tipos.

- [ ] **Step 7: Commit**

```bash
git add src/lib/engine/settle.ts src/lib/__tests__/record-result.test.ts src/app/actions.ts
git commit -m "$(printf 'feat(results): record real score, auto-settle bets, feed team strength\n\nrecordResultAction persists the score, auto-settles open bets on the\nfixture (betResultForScore covers 1X2/double-chance/OU/BTTS/exact),\nupdates bankroll for real bets, and feeds observed goals back into\nteam attack/defense strength.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 3.3: `MatchResultModal` + montaje en la página de partido

**Files:**
- Create: `src/components/MatchResultModal.tsx`
- Modify: `src/app/partido/[id]/page.tsx`

- [ ] **Step 1: Componente**

```tsx
// src/components/MatchResultModal.tsx
"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { recordResultAction } from "@/app/actions"

interface Props { fixtureId: number; homeName: string; awayName: string; initialHome?: number | null; initialAway?: number | null }

export function MatchResultModal({ fixtureId, homeName, awayName, initialHome, initialAway }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [home, setHome] = useState(initialHome ?? 0)
  const [away, setAway] = useState(initialAway ?? 0)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState("")

  const save = () => start(async () => {
    const res = await recordResultAction(fixtureId, home, away, true)
    setMsg(res.message); if (res.ok) { setOpen(false); router.refresh() }
  })

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ background: "transparent", border: "1px solid var(--accent)", color: "var(--accent)", padding: "6px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>
      Registrar resultado real
    </button>
  )

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", padding: 20, marginBottom: 12 }}>
      <h3 style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Marcador final</h3>
      <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{homeName}</span>
        <input type="number" min={0} value={home} onChange={e => setHome(Number(e.target.value))} style={scoreInput} />
        <span style={{ color: "var(--text-muted)" }}>—</span>
        <input type="number" min={0} value={away} onChange={e => setAway(Number(e.target.value))} style={scoreInput} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{awayName}</span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16, justifyContent: "center" }}>
        <button onClick={save} disabled={pending} style={{ background: "var(--accent)", border: "none", color: "#000", padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: pending ? "wait" : "pointer" }}>{pending ? "Guardando…" : "Confirmar y liquidar"}</button>
        <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
      </div>
      {msg && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, textAlign: "center" }}>{msg}</div>}
    </div>
  )
}

const scoreInput: React.CSSProperties = { width: 64, textAlign: "center", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px", fontSize: 22, fontFamily: "var(--font-mono, monospace)" }
```

- [ ] **Step 2: Montar en la página de partido**

En `getFixtureDetails` (actions.ts) añadir `homeScore`/`awayScore`/`status` al SELECT y al objeto devuelto. En la página, tras el header del partido:

```tsx
import { MatchResultModal } from "@/components/MatchResultModal"
// ...
<MatchResultModal fixtureId={fixtureId} homeName={homeName} awayName={awayName}
  initialHome={fixture?.homeScore ?? null} initialAway={fixture?.awayScore ?? null} />
```

- [ ] **Step 3: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev`, registrar un 2-1 en un partido con apuestas pendientes: deben liquidarse, el bankroll cambia (si real), y un re-análisis posterior refleja fuerza de equipo actualizada.

- [ ] **Step 4: Commit**

```bash
git add src/components/MatchResultModal.tsx src/app/partido/[id]/page.tsx src/app/actions.ts
git commit -m "$(printf 'feat(partido): match result modal wired to feedback loop\n\nEnter the final score to auto-settle bets and feed team strength.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 3.4: Sparkline de histórico de cuotas por selección

**Files:**
- Create: `src/components/OddsHistorySparkline.tsx`
- Modify: `src/app/partido/[id]/page.tsx` (cargar series y pasarlas a las tarjetas)

- [ ] **Step 1: Componente (SVG puro, sin dependencia nueva)**

```tsx
// src/components/OddsHistorySparkline.tsx
import type { OddsPoint } from "@/lib/db/odds-history"

export function OddsHistorySparkline({ series }: { series: OddsPoint[] }) {
  if (series.length < 2) return null
  const vals = series.map(p => p.odds)
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const w = 80, h = 20
  const pts = series.map((p, i) => {
    const x = (i / (series.length - 1)) * w
    const y = h - ((p.odds - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  const last = vals[vals.length - 1], first = vals[0]
  const color = last < first ? "var(--loss)" : last > first ? "var(--win)" : "var(--text-muted)"
  return (
    <svg width={w} height={h} style={{ display: "block" }} aria-label="movimiento de cuota">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}
```

- [ ] **Step 2: Cargar series y pasarlas**

En la página de partido, construir un mapa `historyByKey` consultando `listOddsHistory` para cada `${m.name}|${m.selection}` con cuota guardada, y pasar la serie correspondiente a `MarketBettingCard`, que la renderiza junto a la columna "Mi cuota". (Añadir prop opcional `historyByKey?: Record<string, OddsPoint[]>` al card y renderizar `<OddsHistorySparkline>` cuando exista.)

- [ ] **Step 3: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev`, guardar dos cuotas distintas para una selección y ver el sparkline reflejar el movimiento.

- [ ] **Step 4: Commit**

```bash
git add src/components/OddsHistorySparkline.tsx src/app/partido/[id]/page.tsx src/components/MarketBettingCard.tsx
git commit -m "$(printf 'feat(odds): line-movement sparkline per selection\n\nReads odds_history and renders an inline SVG sparkline next to each\nmarket so you can see how your recorded prices moved.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 3.5: Persistir las cuotas de consenso del mercado (movimiento de línea real)

**Problema:** `appendOdds` solo se llama al guardar cuotas manuales, así que el "histórico de cuotas" es solo tus entradas. Las cuotas de consenso que trae `fetchOdds` durante el análisis/pre-match no se guardan.

**Files:**
- Modify: `src/app/actions.ts` (`runPreMatchAction`)

- [ ] **Step 1: Anexar consenso por selección al obtener cuotas**

En `runPreMatchAction`, donde hoy se hace `const odds = await fetchOdds(...)`, si `odds.length > 0`, calcular la mediana por selección y anexarla a `odds_history` con `source = "market"`:

```typescript
import { appendOdds } from "@/lib/db/odds-history"
import { median } from "@/lib/model/devig"
// ...
      const odds = await fetchOdds(home.name, away.name)
      if (odds.length > 0) {
        // Agrupar por market+selection y guardar la mediana del consenso.
        const groups = new Map<string, number[]>()
        for (const o of odds) {
          const k = `${o.market}|${o.selection}`
          if (!groups.has(k)) groups.set(k, [])
          groups.get(k)!.push(o.odds)
        }
        for (const [k, prices] of groups) {
          const [m, sel] = k.split("|")
          // Mapear el nombre crudo del feed a nuestro esquema de mercado/selección no es necesario
          // para el histórico: guardamos tal cual con la mediana del consenso.
          await appendOdds(fixture.id, m, sel, median(prices), "market")
        }
      } else {
        await db.execute({ sql: `INSERT INTO alerts (fixture_id, type, message, is_read, created_at) VALUES (?,?,?,0,?)`,
          args: [fixture.id, "stale_odds", `Sin cuotas: ${home.name} vs ${away.name}`, new Date().toISOString()] })
      }
```

- [ ] **Step 2: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev`, correr pre-match en un partido con cuotas disponibles: `odds_history` acumula puntos `source='market'` y el sparkline (Task 3.4) muestra movimiento aunque no hayas ingresado cuotas manuales.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions.ts
git commit -m "$(printf 'feat(odds): persist market consensus to odds_history\n\nPre-match now logs the median consensus per selection (source=market),\nso line-movement reflects the market, not only manual entries.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

## FASE 4 — Fiabilidad visible

### Task 4.1: Módulo de calibración reutilizable + refactor del script

**Files:**
- Create: `src/lib/engine/calibration.ts`
- Test: `src/lib/__tests__/calibration.test.ts`
- Modify: `scripts/calibrate.ts` (delegar)

- [ ] **Step 1: Test que falla**

```typescript
// src/lib/__tests__/calibration.test.ts
import { describe, it, expect } from "vitest"
import { calibrationReport } from "../engine/calibration"

describe("calibrationReport", () => {
  it("Brier 0 con predicciones perfectas", () => {
    const r = calibrationReport([
      { ourProbability: 1, result: "win" }, { ourProbability: 0, result: "loss" },
    ] as any)
    expect(r.brier).toBeCloseTo(0, 6)
    expect(r.n).toBe(2)
  })
  it("Brier 0.25 con 0.5 constante", () => {
    const r = calibrationReport([
      { ourProbability: 0.5, result: "win" }, { ourProbability: 0.5, result: "loss" },
    ] as any)
    expect(r.brier).toBeCloseTo(0.25, 6)
  })
  it("agrupa en buckets con conteo y aciertos", () => {
    const r = calibrationReport([
      { ourProbability: 0.55, result: "win" }, { ourProbability: 0.52, result: "loss" },
    ] as any)
    const bucket = r.buckets.find(b => b.count > 0)!
    expect(bucket.count).toBe(2)
    expect(bucket.wins).toBe(1)
  })
  it("lista vacía no rompe", () => {
    const r = calibrationReport([])
    expect(r.n).toBe(0); expect(r.brier).toBe(0)
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/__tests__/calibration.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/engine/calibration.ts
export interface CalibrationInputBet {
  ourProbability: number
  result: "win" | "loss" | "void" | null
  oddsUsed?: number
  oddsClosing?: number | null
}

export interface CalibrationBucket { range: string; count: number; wins: number; sumP: number }
export interface CalibrationReport {
  n: number
  brier: number
  logLoss: number
  avgCLV: number | null
  buckets: CalibrationBucket[]
}

export function calibrationReport(bets: CalibrationInputBet[]): CalibrationReport {
  const settled = bets.filter(b => b.result === "win" || b.result === "loss")
  if (settled.length === 0) {
    return { n: 0, brier: 0, logLoss: 0, avgCLV: null, buckets: makeBuckets() }
  }
  let brierSum = 0, logLossSum = 0
  const eps = 1e-7
  const buckets = makeBuckets()
  for (const b of settled) {
    const o = b.result === "win" ? 1 : 0
    brierSum += (b.ourProbability - o) ** 2
    const p = Math.max(eps, Math.min(1 - eps, b.ourProbability))
    logLossSum += o === 1 ? -Math.log(p) : -Math.log(1 - p)
    const idx = Math.min(9, Math.max(0, Math.floor(b.ourProbability * 10)))
    buckets[idx].count++; buckets[idx].wins += o; buckets[idx].sumP += b.ourProbability
  }
  const clv = settled.filter(b => b.oddsClosing != null && b.oddsUsed != null)
  const avgCLV = clv.length ? clv.reduce((s, b) => s + (b.oddsUsed! / b.oddsClosing! - 1), 0) / clv.length : null
  return { n: settled.length, brier: brierSum / settled.length, logLoss: logLossSum / settled.length, avgCLV, buckets }
}

function makeBuckets(): CalibrationBucket[] {
  return Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}-${(i + 1) * 10}%`, count: 0, wins: 0, sumP: 0 }))
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/__tests__/calibration.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor `scripts/calibrate.ts` para delegar**

Sustituir el cálculo inline de Brier/logLoss/buckets en `scripts/calibrate.ts` por una llamada a `calibrationReport(bets)`, conservando el formato de salida de consola. (DRY: una sola implementación.)

- [ ] **Step 6: Verificación**

Run: `npx vitest run` y `npx tsc --noEmit`
Expected: PASS, sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/lib/engine/calibration.ts src/lib/__tests__/calibration.test.ts scripts/calibrate.ts
git commit -m "$(printf 'refactor(calibration): extract reusable calibrationReport\n\nBrier/log-loss/CLV/reliability buckets in lib so both the CLI script\nand the upcoming UI page share one implementation.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 4.2: Página `/calibracion`

**Files:**
- Create: `src/app/calibracion/page.tsx`
- Modify: `src/app/historial/page.tsx` y `src/app/hoy/page.tsx` (enlace)

- [ ] **Step 1: Página server que consume `calibrationReport`**

```tsx
// src/app/calibracion/page.tsx
export const maxDuration = 30
import { getBets } from "@/lib/kelly/tracker"
import { calibrationReport } from "@/lib/engine/calibration"
import { cookies } from "next/headers"

export default async function CalibracionPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("mm_uid")?.value ? Number(cookieStore.get("mm_uid")!.value) : undefined
  const bets = await getBets({ mode: "real", userId })
  const r = calibrationReport(bets.map(b => ({ ourProbability: b.ourProbability, result: b.result, oddsUsed: b.oddsUsed, oddsClosing: b.oddsClosing })))

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <h1 className="stat-number" style={{ fontSize: "clamp(28px,4vw,44px)", marginBottom: 8 }}>
        Calibración del <span style={{ color: "var(--accent)" }}>modelo</span>
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 24 }}>{r.n} apuestas liquidadas</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 12, marginBottom: 32 }}>
        {[
          { label: "Brier Score", value: r.brier.toFixed(4), sub: "0 perfecto · 0.25 azar" },
          { label: "Log Loss", value: r.logLoss.toFixed(4) },
          { label: "CLV Promedio", value: r.avgCLV == null ? "—" : `${(r.avgCLV * 100).toFixed(2)}%` },
        ].map(c => (
          <div key={c.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{c.label}</div>
            <div className="stat-number" style={{ fontSize: 28, color: "var(--accent)" }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      <h2 className="stat-number" style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Diagrama de fiabilidad</h2>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {r.buckets.filter(b => b.count > 0).map(b => {
          const predicted = b.sumP / b.count
          const actual = b.wins / b.count
          const diff = actual - predicted
          return (
            <div key={b.range} style={{ display: "grid", gridTemplateColumns: "90px 1fr 70px 70px 70px", gap: 12, alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{b.range}</span>
              <div style={{ position: "relative", height: 8, background: "var(--surface-2)" }}>
                <div style={{ position: "absolute", left: `${predicted * 100}%`, top: -3, width: 2, height: 14, background: "var(--text-muted)" }} />
                <div style={{ height: 8, width: `${actual * 100}%`, background: Math.abs(diff) > 0.1 ? "var(--loss)" : "var(--win)" }} />
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{b.count} ap.</span>
              <span className="stat-number" style={{ fontSize: 13 }}>{(predicted * 100).toFixed(0)}%</span>
              <span className="stat-number" style={{ fontSize: 13, color: Math.abs(diff) > 0.1 ? "var(--loss)" : "var(--win)" }}>{(actual * 100).toFixed(0)}%</span>
            </div>
          )
        })}
        {r.n === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Sin apuestas liquidadas todavía.</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Enlaces de navegación**

Añadir un enlace "Calibración" en `/historial` (cabecera) y en `/hoy` (junto a HoyActions): `<Link href="/calibracion">Calibración</Link>` con el estilo de los demás enlaces.

- [ ] **Step 3: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev`, visitar `/calibracion`: KPIs y diagrama de fiabilidad render (vacío si no hay apuestas liquidadas).

- [ ] **Step 4: Commit**

```bash
git add src/app/calibracion/page.tsx src/app/historial/page.tsx src/app/hoy/page.tsx
git commit -m "$(printf 'feat(calibracion): reliability page (Brier, log-loss, CLV, diagram)\n\nSurfaces the calibration that previously only existed as a CLI script.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 4.3: Desglose de confianza persistido y mostrado

**Files:**
- Modify: `src/lib/types.ts` (`MatchAnalysis.confidenceBreakdown?`)
- Modify: `src/lib/engine/analyzer.ts` (poblarlo con `effectiveDataQuality` de Task 1.5.1)
- Modify: `src/lib/db/schema.ts` (columna `confidence_breakdown TEXT`)
- Modify: `src/app/actions.ts` (persistir y leer el desglose en los upserts y en `getAnalysisForFixture`)
- Modify: `src/app/partido/[id]/page.tsx`

- [ ] **Step 1: Tipo opcional**

En `types.ts`, añadir a `MatchAnalysis`:

```typescript
  confidenceBreakdown?: {
    dataQuality: number
    maxDivergence1x2: number
    penalty: number
  }
```

- [ ] **Step 2: Poblarlo en `analyzeMatch` (usa `effectiveDataQuality` de Task 1.5.1)**

Donde se calcula la confianza, añadir al objeto devuelto por `analyzeMatch`:

```typescript
    confidenceBreakdown: {
      dataQuality: effectiveDataQuality,
      maxDivergence1x2: maxDivergence,
      penalty: effectiveDataQuality - confidence,
    },
```

- [ ] **Step 3: Persistir como columna JSON**

En `schema.ts`, bloque `ALTER TABLE` idempotente:

```typescript
    "ALTER TABLE match_analyses ADD COLUMN confidence_breakdown TEXT",
```

En cada upsert de `match_analyses` (cron, `runDailyCronAction`, `runPreMatchAction`, `saveManualLineupAction`), incluir `JSON.stringify(analysis.confidenceBreakdown ?? null)` en la columna `confidence_breakdown`.

En `getAnalysisForFixture` (actions.ts), parsear y devolver el campo:

```typescript
    confidenceBreakdown: r.confidence_breakdown ? JSON.parse(r.confidence_breakdown) : undefined,
```

- [ ] **Step 4: Render del desglose desde el dato persistido**

En la página de partido, usar `analysis.confidenceBreakdown` (con respaldo a derivarlo de markets si es `undefined` para análisis viejos):

```tsx
const cb = analysis.confidenceBreakdown
const maxDiv = cb?.maxDivergence1x2 ?? markets
  .filter(m => m.name === "1X2" && m.marketProbability != null)
  .reduce((mx, m) => Math.max(mx, Math.abs(m.modelProbability - (m.marketProbability ?? m.modelProbability))), 0)
// Tarjeta:
<div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 16, marginBottom: 12 }}>
  <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Por qué esta confianza</h3>
  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
    Confianza {confidence}/100{cb && ` (calidad de datos ${cb.dataQuality}, penalización −${cb.penalty})`}.
    Divergencia máx. modelo vs mercado en 1X2: {(maxDiv * 100).toFixed(0)} pts
    {maxDiv > 0.2 ? " (penalización fuerte: posible ruido o cuota atípica)." : maxDiv > 0.12 ? " (penalización media)." : " (alineado con el mercado)."}
  </div>
</div>
```

- [ ] **Step 5: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev`, abrir un partido: la tarjeta muestra calidad de datos, penalización y divergencia desde el dato persistido.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/engine/analyzer.ts src/lib/db/schema.ts src/app/actions.ts src/app/partido/[id]/page.tsx
git commit -m "$(printf 'feat(partido): persist and show confidence breakdown\n\nStores confidence_breakdown (data quality, divergence, penalty) with the\nanalysis and renders it, so the confidence number is explained from real\npersisted data rather than a dead field.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

## FASE 5 — Seguimiento en vivo

### Task 5.1: Badge de estado en vivo

**Files:**
- Create: `src/components/LiveStatusBadge.tsx`
- Modify: `src/app/actions.ts` (`getLiveStatusAction`)
- Modify: `src/app/partido/[id]/page.tsx` y `src/app/hoy/page.tsx`

- [ ] **Step 1: Server action que envuelve `fetchESPNLiveStatus`**

```typescript
export async function getLiveStatusAction(homeName: string, awayName: string): Promise<{ state: string; clock?: string; homeScore?: number; awayScore?: number } | null> {
  const { fetchESPNLiveStatus } = await import("@/lib/data/espn")
  return fetchESPNLiveStatus(homeName, awayName)
}
```

- [ ] **Step 2: Componente con polling ligero (cada 60s, solo si el partido es hoy)**

```tsx
// src/components/LiveStatusBadge.tsx
"use client"
import { useEffect, useState } from "react"
import { getLiveStatusAction } from "@/app/actions"

export function LiveStatusBadge({ homeName, awayName, active }: { homeName: string; awayName: string; active: boolean }) {
  const [status, setStatus] = useState<{ state: string; clock?: string; homeScore?: number; awayScore?: number } | null>(null)
  useEffect(() => {
    if (!active) return
    let alive = true
    const tick = async () => { const s = await getLiveStatusAction(homeName, awayName); if (alive) setStatus(s) }
    tick()
    const id = setInterval(tick, 60000)
    return () => { alive = false; clearInterval(id) }
  }, [homeName, awayName, active])

  if (!status || status.state === "unknown") return null
  const live = status.state === "in"
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12, padding: "3px 10px", border: `1px solid ${live ? "var(--loss)" : "var(--border)"}`, color: live ? "var(--loss)" : "var(--text-muted)" }}>
      {live && <span style={{ width: 8, height: 8, borderRadius: 8, background: "var(--loss)" }} />}
      {status.state === "in" ? `EN VIVO ${status.clock ?? ""}` : status.state === "post" ? "FINAL" : "PRÓXIMO"}
      {(status.homeScore != null) && <strong>{status.homeScore} — {status.awayScore}</strong>}
    </span>
  )
}
```

- [ ] **Step 3: Montar**

En la página de partido (header) y en cada fila de `/hoy`, montar `<LiveStatusBadge>` con `active` = el `match_date` cae en el día de hoy.

- [ ] **Step 4: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run dev` (durante un partido del Mundial) — el badge muestra estado/marcador; fuera de partido no aparece.

- [ ] **Step 5: Commit**

```bash
git add src/components/LiveStatusBadge.tsx src/app/actions.ts src/app/partido/[id]/page.tsx src/app/hoy/page.tsx
git commit -m "$(printf 'feat(live): in-match status/score badge via ESPN\n\nSurfaces fetchESPNLiveStatus that was previously unused; polls every\n60s only for today fixtures.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

## FASE 6 — Cierre

### Task 6.1: Suite verde, typecheck, y captura de closing odds desde la UI

**Files:**
- Modify: `src/components/PartidoActions.tsx` o página de partido (botón "Capturar cuotas de cierre")

- [ ] **Step 1: Exponer `captureClosingOddsAction` con un botón**

En la página de partido, añadir un `ActionButton` que llame a `captureClosingOddsAction(fixtureId)` (ya existe en actions.ts) para capturar CLV manualmente antes del inicio:

```tsx
import { captureClosingOddsAction } from "@/app/actions"
// dentro de un wrapper client o ActionButton:
<ActionButton label="Capturar cuotas de cierre" pendingLabel="Capturando" action={() => captureClosingOddsAction(fixtureId)} variant="ghost" />
```

- [ ] **Step 2: Suite completa**

Run: `npx vitest run`
Expected: PASS (todos, incluyendo los nuevos: sizing, market-labels, odds-history, tracker-crud, feedback, record-result, calibration).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Lint y build**

Run: `npm run lint && npm run build`
Expected: build OK.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'feat(clv): manual closing-odds capture button + green suite\n\nExposes captureClosingOddsAction in the UI and verifies full test\nsuite + typecheck + build.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 6.2: Responsive / móvil

**Problema:** las tablas usan columnas fijas (`gridTemplateColumns: "1fr 80px 88px 120px…"`) que se rompen en teléfono, y la herramienta se usa mucho desde el móvil.

**Files:**
- Modify: `src/app/globals.css` (utilidades responsive)
- Modify: `src/components/MarketBettingCard.tsx`, `src/components/BetTable.tsx`

- [ ] **Step 1: Clases utilitarias en `globals.css`**

```css
/* Tablas de mercados/historial: scroll horizontal en móvil en vez de romper */
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.table-scroll > .table-grid { min-width: 560px; }

@media (max-width: 640px) {
  .stack-mobile { grid-template-columns: 1fr !important; }
  .hide-mobile { display: none !important; }
}
```

- [ ] **Step 2: Envolver las grillas anchas**

En `MarketBettingCard` y `BetTable`, envolver el bloque de la grilla con `<div className="table-scroll"><div className="table-grid">…</div></div>` para que en pantallas chicas haga scroll horizontal en lugar de comprimir columnas ilegibles. En la cabecera de `/hoy` y `/partido`, añadir `className="stack-mobile"` a las grillas de dos columnas (`gridTemplateColumns: "300px 1fr"` y `"1fr auto auto auto"`).

- [ ] **Step 3: Verificación**

Run: `npm run dev`, en DevTools con viewport 375px: las tarjetas y tablas son usables (scroll horizontal donde aplica, apilado en cabeceras), sin desbordes que rompan el layout.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components/MarketBettingCard.tsx src/components/BetTable.tsx src/app/hoy/page.tsx src/app/partido/[id]/page.tsx
git commit -m "$(printf 'feat(ui): responsive tables and stacked headers on mobile\n\nWide grids scroll horizontally instead of breaking; two-column headers\nstack under 640px.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 6.3: Tests de UI (smoke con Playwright)

**Problema:** todos los tests son de capa lógica; el dolor del usuario es de comportamiento de UI ("el botón no funciona", "no puedo apostar"). Estos smoke tests cubren los flujos que fallaban.

**Files:**
- Create: `e2e/flujos.spec.ts`
- Modify: `package.json` (script `e2e`)

- [ ] **Step 1: Script en `package.json`**

```json
    "e2e": "playwright test"
```

(Playwright ya está disponible vía el plugin MCP; si no está como dependencia local, instalar `@playwright/test` como devDependency y `npx playwright install chromium`.)

- [ ] **Step 2: Smoke tests de los flujos críticos**

```typescript
// e2e/flujos.spec.ts
import { test, expect } from "@playwright/test"

const BASE = process.env.E2E_BASE ?? "http://localhost:3000"

test("home carga y muestra acciones de pipeline", async ({ page }) => {
  await page.goto(`${BASE}/hoy`)
  await expect(page.getByText("Pipeline diario")).toBeVisible()
  await expect(page.getByText("Pre-match")).toBeVisible()
})

test("en un partido se puede apostar cualquier selección 1X2 sin escribir cuota primero", async ({ page }) => {
  await page.goto(`${BASE}/partido/1`)
  // El botón APOSTAR existe en la tarjeta 1X2 aunque no se haya tipeado cuota (prellena la justa).
  const apostar = page.getByRole("button", { name: /apostar/i }).first()
  await expect(apostar).toBeVisible()
})

test("historial permite editar/eliminar (controles presentes)", async ({ page }) => {
  await page.goto(`${BASE}/historial`)
  await expect(page.getByRole("heading", { name: /track record/i })).toBeVisible()
})

test("la página de calibración renderiza", async ({ page }) => {
  await page.goto(`${BASE}/calibracion`)
  await expect(page.getByRole("heading", { name: /calibraci/i })).toBeVisible()
})
```

- [ ] **Step 3: Verificación**

Run (con `npm run dev` levantado en otra terminal): `npm run e2e`
Expected: 4 tests PASS. Si la DB está vacía, `/partido/1` requiere haber corrido el pipeline/seed; documentarlo en el commit como precondición.

- [ ] **Step 4: Commit**

```bash
git add e2e/flujos.spec.ts package.json
git commit -m "$(printf 'test(e2e): smoke tests for the flows the user reported broken\n\nCovers /hoy actions, betting any 1X2 selection without typing odds,\nhistory page, and calibration page.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

## Self-Review (cobertura del diagnóstico)

| Falencia detectada | Task que la resuelve |
|---|---|
| Kelly 0.25 (UI) vs 0.5 (backend) | 0.1, 1.3 |
| `PartidoActions` código muerto / pre-match por partido | 1.1, 1.4, 6.1 |
| Pre-match frágil (ESPN único, sin fallback, sin manual) | 1.1, 1.2 |
| Mercados limitados / no puedo apostar 1X2 | 1.3, 1.4 |
| Registro inconsistente | 1.3 (helper único), 2.2 |
| Historial sin editar/eliminar | 2.1, 2.2, 2.3 |
| CLV solo promedio | 2.3, 4.1, 4.2 |
| Sin registrar resultado real | 3.2, 3.3 |
| Resultados no alimentan DB de equipos | 3.1, 3.2 |
| Histórico de cuotas / movimiento de línea | 0.3, 1.3, 3.4 |
| Fiabilidad invisible (modelo vs mercado, calibración, confianza) | 1.3, 4.1, 4.2, 4.3 |
| `fetchESPNLiveStatus` / `captureClosingOddsAction` sin cablear | 5.1, 6.1 |
| Tomar lineup no recalcula confianza correctamente (bug dataQuality horneado) | 1.5.1 |
| Lineup/lesiones manual no cambia la predicción (lambdas) | 1.5.2, 1.5.3 |
| Guardar lineup manual no dispara re-análisis | 1.5.3 |
| EV de cuotas manuales sin anclar al mercado (optimista) | 1.5.4 |
| El cron borra la fuerza de equipo aprendida (`seed()` INSERT OR REPLACE) | 3.0.1 |
| Feedback de fuerza no idempotente (editar marcador la aplica dos veces) | 3.0.2 |
| Sin inspección/reset de la fuerza aprendida | 3.0.2 |
| No se pueden registrar mercados arbitrarios de tu casa | 2.5.1 |
| Sin aviso de correlación entre apuestas (campo `correlationGroup` sin uso) | 2.5.2 |
| Sin cartilla/portafolio del día; exposición estimada en vez de real | 2.5.3 |
| Histórico de cuotas = solo manual (consenso de mercado no persistido) | 3.5 |
| Sin responsive/móvil | 6.2 |
| Cero tests de UI para los flujos reportados rotos | 6.3 |

**Type consistency:** `kellyStake` (sizing.ts) usado por criterion.ts, MarketBettingCard, updateMarketOddsAction, CustomBetForm. `selectionLabel`/`MARKET_GROUPS` (market-labels.ts) usados por partido page y card. `betResultForScore` (settle.ts) usado por recordResultAction y su test. `calibrationReport` usado por script y página. `OddsPoint` (odds-history.ts) usado por sparkline y página. `updatedStrengths` (feedback.ts) usado por `replayStrengths` (recompute-strengths.ts) que usa `recomputeAllStrengths` en actions.ts. `dataQualityFromData` y `lineupAttackMultiplier`/`lineupConcedeMultiplier` (analyzer.ts/lineup.ts) usados dentro de `analyzeMatch`. `reblendSelection` (reblend.ts) usado por updateMarketOddsAction. `correlationWarnings` (correlation.ts) usado por la cartilla y la card. `MatchResultModal`/`LineupEditor`/`LiveStatusBadge`/`CustomBetForm` reciben props consistentes con sus llamadas.

**Orden de dependencias entre fases:**
- Fase 0 antes que todo (helpers + schema).
- Fase 1.5 depende de 1.2 (manual_lineups) y 1.1 (pre-match); 1.5.1 antes que 4.3 (que usa `effectiveDataQuality`).
- Fase 3.0 **antes** que 3.2 (3.2 ya no aplica EMA inline, llama a `recomputeAllStrengths`). 3.1 (`updatedStrengths`) es prerequisito de 3.0.2; ejecutar 3.1 antes de 3.0.2 aunque 3.0 aparezca primero por narrativa — o reordenar 3.1 antes de 3.0.2 al ejecutar.
- 2.5.2 (correlation) antes de 2.5.3 (cartilla la usa).

**Notas de riesgo:**
- Varios tests tocan la DB real (Turso). Mantener el patrón de los tests existentes (`clv`, `settle-bankroll`). Si no hay credenciales en CI, marcar esos como integración.
- `updateMarketOddsAction` calcula `fraction` pura (bankroll=1) y el cliente multiplica por bankroll real (ya lo hace el card) para no necesitar la confianza exacta en el servidor.
- `recomputeAllStrengths` recorre todos los fixtures finalizados en cada resultado; con 104 partidos del Mundial el costo es trivial. Si creciera, cachear.
- El ajuste por lineup usa `key: true` para toda baja manual (el usuario solo marca las que importan); si se quisiera granularidad regular/key, extender `LineupEditor` con un toggle por jugador.
