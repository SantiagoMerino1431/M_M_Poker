# Backtest Qatar 2022 — Design Spec
**Fecha:** 2026-06-11
**Proyecto:** M_M_Poker / Mundial 2026 Betting Assistant
**Estado:** Aprobado por usuario

---

## Resumen ejecutivo

Script de validación one-shot que corre el modelo estadístico real contra los 64 partidos de Qatar 2022 usando datos históricos disponibles antes de cada partido. El output se guarda en la tabla `bets` como `mode: 'paper'` con resultados ya conocidos, apareciendo automáticamente en `/historial` con todos los gráficos de calibración y métricas de ROI. El objetivo es confirmar que el modelo tiene edge real antes de apostar dinero en el Mundial 2026.

**Confiabilidad estimada del backtest: ~85%**

Componentes no testeables: árbitros (sin stats pre-partido), lineups (sin datos históricos), injuries (sin datos históricos).

---

## Arquitectura

```
scripts/
  backtest-2022.ts          ← runner principal
  backtest/
    loaders.ts              ← lee CSVs, devuelve estructuras tipadas
    builder.ts              ← construye MatchData por partido
```

Ningún archivo nuevo toca el código existente. El runner llama directamente a `analyzeMatch()` de `src/lib/engine/analyzer.ts`.

---

## Data disponible

| Archivo | Uso |
|---|---|
| `data/results.csv` | Form (últimos 5 partidos) + H2H internacional completo |
| `data/matches_1930_2022.csv` | Resultados reales Qatar 2022 (ground truth) |
| `data/fifa_ranking_2022-10-06.csv` | Rankings pre-torneo |
| `data/odds_2022.csv` | Cuotas 1X2 reales (apertura) |
| `data/Fifa_world_cup_matches.csv` | Stats de partido Qatar 2022 (tarjetas, posesión) |
| `data/player_aggregates.csv` | Ratings FIFA por selección (proxy de calidad de plantel) |
| `data/euros.csv` / `copa_america.csv` / `afcon.csv` / `asian_cup.csv` | Form adicional por confederación |
| `data/goalscorers.csv` | Goles pre-torneo para calibrar attack/defense strength |
| `data/former_names.csv` | Normalización de nombres históricos |

**Archivos ignorados (fútbol de clubes, no sirven):**
- `odds_series.csv` (888MB), `odds_series_b.csv` (1.75GB), `closing_odds.csv` (66MB)

---

## Sección 1: Capa de datos (`scripts/backtest/loaders.ts`)

### Normalización de nombres

Tabla de mapeo explícita entre variantes de nombres en los distintos CSVs:

```typescript
const TEAM_NAME_MAP: Record<string, string> = {
  "United States":  "USA",
  "IR Iran":        "Iran",
  "Korea Republic": "South Korea",
}
```

`former_names.csv` se aplica al cargar H2H: antes de indexar cada partido histórico, se mapea el nombre del equipo a su nombre actual usando el campo `current`. Ejemplo: "West Germany" → "Germany", "Yugoslavia" → aplica al país sucesor relevante. Esto permite que partidos de los años 70-80 cuenten en el H2H de Alemania y otros equipos con cambios de nombre.

### IDs sintéticos de equipo

`H2HRecord` requiere `homeTeamId` / `awayTeamId` como `number`. En el backtest no existen IDs reales de DB. Se genera un mapa estático de los 32 equipos de Qatar 2022 con IDs negativos (-1 a -32) para evitar colisión con cualquier ID real:

```typescript
const TEAM_IDS: Record<string, number> = {
  "Qatar": -1, "Ecuador": -2, "Senegal": -3, "Netherlands": -4,
  "England": -5, "Iran": -6, "USA": -7, "Wales": -8,
  // ... los 32 equipos
}
```

### Funciones

```typescript
loadResults(): Map<string, FormRecord[]>
// results.csv → por equipo, ordenado fecha desc, pre-2022-11-20

loadH2H(): Map<string, H2HRecord[]>
// results.csv → por par "teamA||teamB" (orden alfabético), tipo competición mapeado:
//   "FIFA World Cup" → 'world_cup'
//   "UEFA Euro" | "Copa América" | "AFC Asian Cup" | "African Cup of Nations" → 'continental'
//   "*qualification*" → 'qualifier'
//   resto → 'friendly'

loadRankings(): Map<string, number>
// fifa_ranking_2022-10-06.csv → Map<nombre, ranking>

loadQatar2022Matches(): Qatar2022Match[]
// matches_1930_2022.csv filtrado por Year=2022, ordenado por Date asc
// incluye: home_team, away_team, home_score, away_score, Date, Venue, Referee

loadOdds(): Map<string, { h: number; d: number; a: number }>
// odds_2022.csv parseado (formato con cabeceras de grupo)
// clave: "homeTeam||awayTeam"

loadTeamStrengths(): Map<string, { attack: number; defense: number }>
// Derivado de results.csv: últimos 20 partidos pre-torneo por equipo
// attack  = avg goles marcados / 1.35 (media global WC)
// defense = 1 / (avg goles recibidos / 1.35) — invertido: menos recibidos = más fuerte
// Capped: min 0.5, max 2.0
```

---

## Sección 2: Constructor de MatchData (`scripts/backtest/builder.ts`)

### Firma

```typescript
function buildMatchData(
  home: string,
  away: string,
  matchDate: string,
  fixtureId: number,
  loaders: BacktestLoaders
): MatchData
```

### Lógica por campo

| Campo MatchData | Fuente | Notas |
|---|---|---|
| `fixture.id` | Sintético negativo (-1 a -64) | Evita colisión con fixture IDs reales de la API |
| `fixture.altitudeM` | `10` fijo | Qatar nivel del mar |
| `fixture.city` / `stadium` | `matches_1930_2022.csv` campo Venue | |
| `teams.home/away.attackStrength` | `loadTeamStrengths()` | Derivado de goles en results.csv |
| `teams.home/away.defenseStrength` | `loadTeamStrengths()` | Invertido de goles recibidos |
| `teams.home/away.fifaRanking` | `loadRankings()` | |
| `homeForm` / `awayForm` | `loadResults()` últimos 5 antes de matchDate | FormRecord con opponentRanking del ranking FIFA |
| `h2h` | `loadH2H()` par específico | Ponderado por tipo de competición |
| `odds` | `loadOdds()` 1X2 | MarketOdds con updatedAt = matchDate (no stale) |
| `referee` | `null` | Sin stats pre-partido disponibles |
| `lineups` | `{ home: null, away: null }` | Sin datos históricos |
| `injuries` | `{ home: [], away: [] }` | Sin datos históricos |
| `weather` | `{ tempC: 25, humidity: 55 }` | Estadios AC en Qatar, noviembre |
| `dataQuality` | Calculado igual que producción | Base 40 + H2H + form + odds |

### Cálculo de dataQuality

```
Base:   40
+15 si H2H >= 3 partidos disponibles
+15 si form >= 3 partidos (últimos 5 pre-torneo)
+10 si cuotas disponibles (odds_2022.csv)
+0  lineup (siempre null en backtest)
+0  referee (siempre null en backtest)
= máximo 80 (nunca 100 en backtest — es una limitación conocida)
```

---

## Sección 3: Runner (`scripts/backtest-2022.ts`)

### Flujo por partido

```
Para cada partido en Qatar2022Matches (orden cronológico):
  1. buildMatchData(home, away, date, fixtureId, loaders)
  2. analyzeMatch(matchData, bankroll=1000, trialMode=false)
  3. Filtrar markets recomendados: EV >= 3%, confidence >= 40, odds != null
  4. Determinar resultado real: home_score vs away_score del ground truth
  5. Para cada apuesta recomendada:
     a. Calcular si ganó/perdió según resultado y mercado
     b. Calcular P/L = amount * (odds - 1) si ganó, -amount si perdió
     c. CLV = odds_usadas (no hay cuota de cierre disponible → null)
     d. Guardar en DB: Bet con mode='paper', result ya conocido, settledAt=matchDate
  6. Actualizar bankroll virtual (acumulado del día)
```

### Métricas de consola al finalizar

```
=== BACKTEST QATAR 2022 ===
Partidos analizados:  64
Apuestas recomendadas: N
Apuestas ganadoras:   N (strike rate %)
ROI total:            X%
Yield:                X%
Bankroll final:       $X (inicio $1,000)
Drawdown máximo:      X%

Por mercado:
  1X2:    N apuestas | ROI X% | Strike X%
  [más mercados cuando haya cuotas adicionales]

Calibración (prob. modelo vs frecuencia real):
  0-10%: X/N  10-20%: X/N  ... 90-100%: X/N
```

### Estado del bankroll virtual

El bankroll del backtest es independiente del bankroll real. Arranca en `$1,000` fijo. No toca `bankroll_snapshots` en DB. Solo los `bets` se guardan.

---

## Sección 4: Integración con `/historial`

Los bets guardados con `mode: 'paper'` y `result` ya conocido aparecen automáticamente en `/historial`:

- KPIs paper: ROI, Yield, Strike rate, Drawdown
- Gráfico de calibración: prob. modelo (deciles) vs frecuencia real
- Tabla de bets filtrables por mercado, resultado, paper/real

**No se necesita ningún cambio en la UI.**

---

## Limitaciones conocidas del backtest

| Limitación | Impacto | Aceptable |
|---|---|---|
| Sin lineups → confidence máximo 80 | Kelly reducido vs producción | Sí — conservador |
| Sin árbitros → cardIntensity neutral | Mercados de tarjetas menos precisos | Sí — mercado menor |
| Sin injuries | Partidos con bajas importantes subrepresentados | Sí — afecta ~10% de matches |
| Cuotas solo 1X2 | EV solo en resultado, no en goles/corners | Sí — core del modelo |
| Form decay 16 meses para UEFA/CONMEBOL | Form menos preciso para equipos europeos/sudamericanos | Parcialmente — compensado por results.csv reciente |

---

## Comando de ejecución

```bash
pnpm tsx scripts/backtest-2022.ts
```

Tiempo estimado de ejecución: < 30 segundos (64 partidos, sin llamadas a red).

---

## Criterio de éxito

El modelo se considera validado si:
- ROI > 0% (rentable aunque sea marginalmente)
- Strike rate > 45% en 1X2
- Calibración: puntos dentro de ±10% de la diagonal perfecta en al menos 6 de 9 deciles
- No hay mercados sistemáticamente sobreestimados (todos los deciles sobre la diagonal = peligroso con Kelly)
