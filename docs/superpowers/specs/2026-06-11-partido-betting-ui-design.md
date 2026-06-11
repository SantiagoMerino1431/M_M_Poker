# Partido Betting UI — Design Spec
**Fecha:** 2026-06-11
**Proyecto:** M_M_Poker / Mundial 2026 Betting Assistant
**Estado:** Aprobado por usuario

---

## Resumen ejecutivo

Rediseño de `/partido/[id]` para adoptar el layout visual de `/partidos/[id]` (team header, probability cards con barras de color, grid de mercados) y añadir una capa de apuesta completa: cuota justa visible siempre, input de cuota inline con EV live, persistencia en DB, sección TOP APUESTAS, y botón REGISTRAR por mercado.

**Objetivo:** el usuario ve en una sola pantalla qué probabilidad asigna el modelo a cada outcome, qué cuota mínima necesita encontrar, y si ya tiene la cuota — cuánto apostar y con qué EV.

---

## Contexto del sistema

Existen dos páginas paralelas que se unifican con este cambio:

- **`/partidos/[id]`** — UI hermosa, datos estáticos (no usa pipeline). Queda intacta como referencia para los 72 partidos.
- **`/partido/[id]`** — Pipeline real (DB + CSV fallbacks + Poisson + Kelly). Actualmente UI primitiva. Este es el que se rediseña.

Los datos de `/partido/[id]` vienen de `getAnalysisForFixture(fixtureId)` que devuelve `MatchAnalysis` con `model.lambdaHome/Away`, `markets[]`, `alerts[]`, `homeTeam`, `awayTeam`.

---

## Arquitectura

```
src/app/partido/[id]/page.tsx        ← Server Component reescrito
src/components/MarketBettingCard.tsx ← Client Component: card + odds input + EV live
src/components/TopApuestas.tsx       ← Client Component: ranking de mejores apuestas
src/app/actions.ts                   ← updateMarketOddsAction (ya existe, sin cambios)
```

### Flujo de datos

```
DB (match_analyses)
  → getAnalysisForFixture()
    → MatchAnalysis { lambdaHome, lambdaAway, markets[], homeTeam, awayTeam }
      → page.tsx (Server) renderiza header + grid visual
      → MarketBettingCard (Client) recibe markets con odds pre-llenados
          → usuario tipea cuota → EV calculado client-side en tiempo real
          → onBlur → updateMarketOddsAction(fixtureId, market, selection, odds)
            → DB actualizada
      → TopApuestas (Client) escucha todos los inputs
          → rankea por EV → muestra top 3 positivos
          → botón REGISTRAR → BetModal existente
```

---

## Secciones del layout

### 1. Header de partido (Server)

```
GRUPO A · FASE DE GRUPOS · FIFA WORLD CUP 2026

MÉXICO                VS              SUDÁFRICA
MEX · #16 FIFA · Local   Pendiente   RSA · #59 FIFA · Visitante

Fecha | Hora (COT) | Sede | Estado
```

Datos: `analysis.homeTeam`, `analysis.awayTeam`, fixture de DB (join con teams para ranking FIFA, group_name).
Badges: group_name del equipo local.

### 2. Grid de probabilidades (Server — igual a /partidos)

**Fila 1 (2 columnas):**
- **Resultado 1X2** — cards para home/draw/away con `%` grande, barra de color (verde/amarillo/rojo), doble oportunidad abajo
- **Goles esperados (λ)** — `lambdaHome` y `lambdaAway` grandes + barra proporcional

**Fila 2 (2 columnas):**
- **Over/Under** — filas con barra y % para 1.5, 2.5, 3.5 + BTTS
- **Clean Sheet · Tarjetas · Corners** — derivados del modelo (CS = P(cero goles visitante/local), tarjetas y corners son estimados fijos por ahora)

**Fila 3 (full width):**
- **Marcadores exactos Top 8** — grid de cards con score, %, barra relativa, y cuota justa

Reutiliza `Bar` y `StatRow` de `/partidos/[id]/page.tsx` (extraídos a `src/components/StatBar.tsx`).

### 3. Capa de apuesta — MarketBettingCard (Client)

Aparece debajo de cada bloque de mercado (1X2, O/U, BTTS, Exacto).

Por cada outcome del grupo:
```
Mercado       Prob modelo   Cuota justa   Tu cuota    EV        Kelly
México gana   58.0%         1.72          [1.90   ]   +10.4%    $3,800
Empate        21.1%         4.74          [       ]   --        --
Sudáfrica     20.9%         4.78          [       ]   --        --
```

Reglas de color:
- Input vacío → borde `var(--border)`
- EV > 5% → borde `var(--win)`, EV en verde
- 0% < EV ≤ 5% → borde `var(--draw)`, EV en amarillo
- EV ≤ 0% → borde `var(--loss)`, muestra "sin valor"

Persistencia: `onBlur` llama `updateMarketOddsAction`. Si `market.odds !== null` en DB, input pre-llenado al cargar.

Kelly amount: `kellyAmount` del `MarketResult` si EV > 0 y `kellyFraction > 0`, sino calcula inline con `bankroll * kellyFraction * confidenceMultiplier`.

### 4. TOP APUESTAS (Client)

Aparece sticky arriba (debajo del header) cuando hay ≥ 1 mercado con EV > 0 y cuota ingresada.

```
▲ TOP APUESTAS  —  2 mercados con valor

#1  México Gana   cuota 1.90   EV +10.4%   $3,800   [REGISTRAR]
#2  Over 2.5      cuota 1.95   EV  +8.2%   $2,400   [REGISTRAR]
```

Implementación: array de `{ market, selection, odds, EV, kellyAmount }` en estado React, actualizado cada vez que un input cambia. Solo mercados con `EV > 0`. Ordenado por EV desc. Máximo 3.

Botón REGISTRAR abre `BetModal` existente con props pre-llenadas.

---

## Componentes a crear/modificar

### `src/components/StatBar.tsx` (nuevo, extraído de /partidos)
```typescript
export function Bar({ value, color }: { value: number; color?: string })
export function StatRow({ label, val, max, color }: { ... })
```

### `src/components/MarketBettingCard.tsx` (nuevo, "use client")
Props:
```typescript
{
  fixtureId: number
  groupName: string         // "1X2" | "Over/Under" | "BTTS" | "Exacto"
  markets: MarketResult[]   // todos los del grupo
  bankroll: number
  confidence: number
  onOddsChange: (market: string, selection: string, odds: number | null) => void
}
```

Estado interno: `oddsMap: Record<string, number>` inicializado desde `market.odds`.

### `src/components/TopApuestas.tsx` (nuevo, "use client")
Props:
```typescript
{
  fixtureId: number
  markets: MarketResult[]   // todos los mercados con odds actuales
  bankroll: number
}
```

Recalcula internamente el ranking cuando las props cambian (padre controla el estado de odds).

### `src/app/partido/[id]/page.tsx` (reescritura)
- Server Component
- Añade join con tabla `teams` para FIFA ranking y group_name
- Pasa `analysis` + `bankrollState` + `teams` a los Client Components
- Estructura visual igual a `/partidos/[id]` con datos del pipeline

---

## Derivación de mercados desde lambdas

Los `analysis.markets` ya contienen `ourProbability` para todos los outcomes. Para la visualización:

| Visual | Fuente |
|---|---|
| homeWin % | `markets.find(m => m.name==="1X2" && m.selection==="home").ourProbability` |
| draw % | `markets.find(m => m.name==="1X2" && m.selection==="draw").ourProbability` |
| awayWin % | `markets.find(m => m.name==="1X2" && m.selection==="away").ourProbability` |
| over2.5 % | `markets.find(m => m.name==="Over/Under" && m.selection==="over_2.5").ourProbability` |
| btts % | `markets.find(m => m.name==="BTTS" && m.selection==="yes").ourProbability` |
| lambdaHome | `analysis.model.lambdaHome` |
| lambdaAway | `analysis.model.lambdaAway` |
| cleanSheetHome | `1 - P(awayGoals > 0)` = derivado del modelo como `1 - btts_away_scores` |

Clean sheet, tarjetas y corners se derivan desde los markets existentes o con estimados fijos (tarjetas: `3.8` avg, corners: `10.5` avg, ajustados por lambda ratio).

---

## Persistencia de cuotas

`updateMarketOddsAction(fixtureId, market, selection, odds)` ya existe en `actions.ts`. Lee el JSON de markets, actualiza el campo `odds` del mercado específico, guarda. Funciona correctamente.

Al cargar la página: si `market.odds !== null`, el input aparece pre-llenado y el EV/Kelly se muestra sin acción del usuario.

Para borrar una cuota guardada: input vacío + blur → llama `updateMarketOddsAction(..., null)`.

---

## Lo que NO cambia

- `/partidos/[id]` permanece intacto (referencia estática para todos los partidos)
- `BetModal` existente — reutilizado sin cambios
- `updateMarketOddsAction` — reutilizado sin cambios
- Pipeline, analyzer, kelly — sin tocar
