# Betting Assistant — Design Spec
**Fecha:** 2026-06-10
**Proyecto:** M_M_Poker / Mundial 2026 Betting Assistant
**Estado:** Aprobado por usuario

---

## Resumen ejecutivo

Sistema personal de análisis y gestión de apuestas partido a partido para el Mundial 2026. El sistema reemplaza el enfoque de simulación pública por un pipeline privado de análisis que evalúa todos los partidos del día, calcula valor esperado (EV) por mercado, y genera recomendaciones de apuesta con tamaño Kelly. El usuario confirma o ajusta manualmente antes de registrar cada apuesta.

**Objetivo primario:** identificar apuestas con EV > 3% y gestionar el bankroll con Kelly fraccionado al 50% con reajuste semanal.

**Modo de operación:** pipeline automático cada mañana + segundo cron 60 minutos antes de cada partido + panel de ajuste manual.

---

## Arquitectura general

```
lib/data/       fetchers de todas las fuentes externas
lib/model/      motor estadístico corregido
lib/engine/     pipeline de análisis: modelo → probabilidades → EV
lib/kelly/      Kelly, bankroll, portfolio, tracking
lib/db/         Turso (LibSQL) — sin cambio de cliente
app/            UI Next.js: /hoy, /partido/[id], /historial
scripts/        cron diario 08:00 AM + pre-match cron 60 min antes
```

---

## Sección 1: Capa de datos (`lib/data/`)

### Fuentes y responsabilidades

| Archivo | Fuente | Datos | Tier gratuito |
|---|---|---|---|
| `api-football.ts` | API-Football (RapidAPI) | Fixtures, stats equipo, H2H, lesiones, lineups, árbitro | 100 req/día |
| `odds-api.ts` | The Odds API | Cuotas de 40+ bookmakers | 500 créditos totales |
| `balldontlie.ts` | BALLDONTLIE FIFA API | Teams, players, standings, odds complementarias | Ilimitado |
| `pipeline.ts` | Orquestador | Combina todas las fuentes para un fixture | — |

### `pipeline.ts` — contrato de datos por partido

```typescript
interface MatchData {
  fixture: { id: number; date: string; stadium: string; city: string; altitude: number }
  teams: { home: TeamData; away: TeamData }
  h2h: H2HRecord[]           // últimos 10 enfrentamientos
  homeForm: FormRecord[]     // últimos 5 partidos equipo local
  awayForm: FormRecord[]     // últimos 5 partidos equipo visitante
  injuries: { home: Injury[]; away: Injury[] }
  lineups: { home: Player[] | null; away: Player[] | null }  // null si no confirmado
  referee: RefereeStats | null
  weather: { tempC: number; humidity: number } | null
  odds: MarketOdds[]         // vacío si créditos agotados
  dataQuality: number        // 0-100, alimenta confidence score
}
```

### Jerarquía de fallback

```
Para fixtures y stats:
  1. API-Football (primario)
  2. football-data.org (fallback)
  3. Último análisis guardado en DB (con alerta de antigüedad)

Para cuotas:
  1. The Odds API (mientras haya créditos)
  2. BALLDONTLIE odds
  3. Input manual del usuario (siempre disponible)
```

### Regla de cuota caducada

Cuotas con más de 4 horas de antigüedad se marcan como `stale: true` y se muestran con alerta visual. El EV calculado sobre cuotas obsoletas se muestra en gris con disclaimer.

---

## Sección 2: Modelo estadístico (`lib/model/`)

### `poisson.ts` — correcciones respecto al código actual

**1. Ventaja local calibrada para WC:**
```
homeAdvantage por defecto: 1.0 (terreno neutral)
Excepción anfitriones:
  USA: 1.08  Canada: 1.06  Mexico: 1.10
  Solo aplica cuando juegan en sede de su país
```

**2. Decaimiento temporal de datos históricos:**
```
peso(meses) = e^(-0.1 * meses_atras)
Partido hace 6 meses:  peso 0.55
Partido hace 12 meses: peso 0.30
Partido hace 24 meses: peso 0.09 (prácticamente ignorado)
```

**3. Corrección Dixon-Coles para scores bajos:**
```
rho = -0.13 (correlación empírica validada en literatura)
Corrección aplicada sobre P(0-0), P(1-0), P(0-1), P(1-1)
P(h,a) *= tau(h, a, lambda_home, lambda_away, rho)
```

### `h2h.ts` — factor head-to-head

```typescript
interface H2HFactor {
  attackMultiplierHome: number  // 0.85 – 1.15
  attackMultiplierAway: number  // 0.85 – 1.15
}

// Lógica:
// - Últimos 10 H2H con peso por torneo (mundial > continental > amistoso)
// - Si H2H < 3 partidos: factor neutro (1.0)
// - Límite absoluto: H2H no mueve lambda más de ±15%
```

### `form.ts` — forma reciente

```
Pesos por partido (más reciente primero): [1.0, 0.8, 0.6, 0.4, 0.2]
Variables consideradas:
  - Resultado (victoria/empate/derrota)
  - Goles marcados y recibidos
  - Calidad del rival (ajustado por ranking FIFA del oponente)
Output: formFactor ∈ [0.90, 1.10]
```

### `context.ts` — variables situacionales

**Estadio y altitud:**
```
Azteca (2240m, Ciudad de México):
  attackStrength local *= 1.12
  avgGoals game *= 0.88 (menos ritmo por altitud)

Dallas AT&T (180m, ~38°C en junio):
  Equipos de clima frío (Escocia, Suecia, Noruega, etc.):
    attackStrength *= 0.94

SoFi Stadium LA (82m, 26°C promedio): neutral
MetLife Stadium NY (5m, 24°C): neutral
```

**Fatiga y viaje:**
```
Días de descanso < 4: attackStrength *= 0.95
Vuelo > 8h en últimas 48h: attackStrength *= 0.92
Ambos factores acumulativos si aplican
```

**Árbitro:**
```
Si referee.avg_yellows_per_game > 5.0: cardIntensity *= 1.30
Si referee.avg_yellows_per_game < 3.0: cardIntensity *= 0.75
Si referee.avg_reds_per_game > 0.15:   redCardProb *= 1.40
```

---

## Sección 3: Motor de análisis (`lib/engine/`)

### `markets.ts` — mercados calculados por partido

```
RESULTADO:     1, X, 2 | doble oportunidad (1X, 12, X2) | DNB
GOLES:         over/under 0.5, 1.5, 2.5, 3.5, 4.5
               primer tiempo over/under 0.5, 1.5
               BTTS | BTTS + over 2.5
MARCADOR:      top 10 marcadores exactos con probabilidad
TARJETAS:      over/under 1.5, 2.5, 3.5, 4.5
               primer equipo en recibir tarjeta
CORNERS:       over/under 8.5, 9.5, 10.5, 11.5
               primer tiempo over/under 4.5
GOLEADORES:    anytime scorer | primer goleador (top 5 por equipo)
HANDICAP:      -1, -1.5, -2 para favorito cuando prob > 65%
```

### `ev.ts` — cálculo de valor esperado

```
Para cada mercado con cuota disponible:

margen_bookmaker = (suma de 1/cuota por selección) - 1
prob_implicita   = (1 / cuota) / (1 + margen_bookmaker)
EV               = (prob_modelo * cuota) - 1
edge             = prob_modelo - prob_implicita

Filtros para recomendar (todos deben cumplirse):
  EV   >= 0.03   (mínimo 3%)
  edge >= 0.02   (mínimo 2% sobre prob implícita)
  cuota >= 1.50  (cuotas muy bajas tienen valor nominal bajo)
  confidence_score >= 40 (datos mínimos disponibles)
```

### `analyzer.ts` — pipeline completo

```typescript
async function analyzeMatch(fixtureId: number): Promise<MatchAnalysis>

interface MatchAnalysis {
  fixture: FixtureInfo
  confidence: number              // 0-100
  isPreliminary: boolean          // true si lineup no confirmado
  model: {
    lambdaHome: number
    lambdaAway: number
    adjustmentsApplied: string[]  // ["H2H +3% ESP", "Árbitro tarjetas alto"]
  }
  markets: MarketResult[]         // ordenados por EV desc
  alerts: string[]                // ["Lineup no confirmado", "Cuota con 6h de antigüedad"]
  lastUpdated: string
}

interface MarketResult {
  name: string
  ourProbability: number
  bookmakerProbability: number
  odds: number
  bookmaker: string               // cuál casa tiene la mejor cuota
  EV: number
  edge: number
  kellyFraction: number
  correlationGroup: string        // para detectar apuestas correlacionadas
  isRecommended: boolean
}
```

### Confidence score (0-100)

```
Base 40 puntos (datos mínimos: fixtures + stats básicos)
+15 si H2H disponible (>= 3 partidos)
+15 si forma reciente disponible (últimos 5 partidos)
+15 si lineup confirmado
+10 si cuotas actualizadas (< 2 horas)
+5  si datos de árbitro disponibles

< 40: no generar recomendaciones
40-59: Kelly reducido al 25%
60-79: Kelly reducido al 75%
80+:   Kelly al 100% (del 50% fraccionado base)
```

---

## Sección 4: Sistema Kelly (`lib/kelly/`)

### `criterion.ts` — fórmula y límites

```
Kelly base:
  f* = ((p * b) - (1-p)) / b
  donde b = cuota - 1, p = prob_modelo

Kelly fraccionado y ajustado:
  kelly = f* * 0.50 * confidence_multiplier

confidence_multiplier:
  >= 80: 1.00
  60-79: 0.75
  40-59: 0.50
  <  40: 0.00 (no apostar)

Límites absolutos:
  min: 0.5% del bankroll actual (si Kelly < esto, no recomendar)
  max: 8.0% del bankroll actual (capping)

Kelly negativo: señal de lay bet en exchange — mostrar como oportunidad separada
```

### `portfolio.ts` — Kelly simultáneo para el día

```
Problema: múltiples apuestas del mismo día son simultáneas, no secuenciales.

Proceso:
  1. Calcular f* individual para cada apuesta recomendada del día
  2. Aplicar reglas de correlación por partido:

     Alta correlación (permitir máximo 1 de este grupo):
       - 1X2 + handicap mismo equipo
       - resultado + marcador exacto
       - over goles + BTTS

     Baja correlación (se pueden combinar):
       - resultado + corners totales
       - resultado + tarjetas totales
       - goles + corners

  3. Calcular exposure total = suma de montos Kelly del día
  4. Si exposure total > 15% bankroll: escalar proporcionalmente hacia abajo
  5. Mostrar al usuario el monto ajustado y la razón

Límite diario: máximo 15% del bankroll en exposición total.
```

### `bankroll.ts` — estado y circuit breaker

```typescript
interface BankrollState {
  current: number           // balance actual
  initial: number           // al inicio del torneo, fijo
  weeklySnapshot: number    // último lunes
  mode: 'normal' | 'conservative' | 'paused'
}

Reajuste semanal (cada lunes):
  kellyBase = current       // Kelly opera sobre balance real actualizado
  Si drawdown desde initial > 30%:
    mode = 'conservative'   // Kelly * 0.50 hasta recuperar 15%
  Si current > initial * 1.50:
    → notificación: opción de retirar ganancias o mantener compuesto

Circuit breaker:
  3 apuestas perdidas consecutivas:
    → alerta: "Revisar análisis antes de continuar"
  5 apuestas perdidas consecutivas:
    → mode = 'paused', suspender recomendaciones 24h
    → usuario puede desactivar manualmente con confirmación explícita
```

### `tracker.ts` — métricas de rendimiento

```
Por cada apuesta:
  mercado, partido, cuota_usada, cuota_cierre, monto, resultado, mode (paper|real)

Métricas calculadas:
  ROI           = (ganado - perdido) / total_apostado * 100
  Yield         = ROI por unidad apostada
  Strike rate   = ganadas / total
  CLV promedio  = media de (cuota_usada / cuota_cierre - 1)
                  > 0 significa que se apostó antes del movimiento adverso
  Drawdown max  = mayor caída desde pico de bankroll
  Mejor mercado = mercado con mayor ROI acumulado

Separación estricta paper vs real:
  Las métricas de paper no afectan el bankroll ni el circuit breaker.
  Las métricas de real son las únicas relevantes para evaluar rentabilidad.
```

---

## Sección 5: UI (`app/`)

### `/hoy` — dashboard diario

**Layout:** dos columnas desktop / una columna móvil.

**Panel izquierdo — Estado del bankroll:**
- Balance actual, variación semanal
- Exposure del día: usada / máximo permitido
- Número de apuestas activas

**Panel derecho — Partidos del día:**

Tarjetas ordenadas por EV del mejor mercado disponible:
- Equipos + hora + estadio
- Mejor mercado con EV más alto
- Semáforo de confidence: verde >70, amarillo 40-70, rojo <40
- Badge `LINEUP CONFIRMADO` cuando disponible
- Badge `FINAL` en el análisis post-cron de 60 min
- Si ya apostaste: monto + mercado elegido
- Si análisis obsoleto (>4h): alerta visible

Secciones de la lista:
1. EV > 5% y confidence > 70 → fondo verde tenue, apostar
2. EV 3-5% → neutro, evaluar
3. EV < 3% o sin cuotas → gris, no recomendado
4. Partidos jugados → resultado + P/L

### `/partido/[id]` — análisis profundo

**Sección 1 — Header:** equipos, hora, estadio, temperatura, árbitro, días de descanso, confidence, timestamp.

**Sección 2 — Inputs manuales (colapsable):**
- Lesión titular no reportada: dropdown de jugadores
- Cuota actualizada: input numérico por mercado
- Motivación reducida: toggle (equipo ya clasificado sin incentivo)
- Botón `Recalcular` que re-corre el analyzer con los ajustes

**Sección 3 — Resultado del modelo:**
- Tabla de probabilidades: modelo vs bookmaker, edge con indicador +/-
- Lambdas calculados
- Lista de ajustes aplicados ("H2H +3% ESP", "Árbitro tarjetas alto")

**Sección 4 — Mercados rankeados por EV:**

Tabla con columnas: Mercado | Prob. Modelo | Cuota | Bookmaker | EV | Kelly | Acción

Botones de acción: `[Apostar]` / `[Paper]` / ignorar

Alerta de correlación si el usuario selecciona dos mercados correlacionados del mismo partido, con ajuste automático de montos.

**Sección 5 — Goleadores:**
Top 5 por equipo: anytime scorer + primer goleador + cuota si disponible.

**Sección 6 — Confirmar:**
Resumen de apuestas seleccionadas, monto total, exposure acumulada del día.
Botones: `Registrar apuestas` / `Registrar como Paper`.

**Regla de cuota mínima al registrar:**
Si la cuota ingresada < cuota analizada * 0.95: alerta "La cuota cayó. El EV puede ser negativo. ¿Confirmar de todas formas?"

### `/historial` — track record

- KPIs grandes: ROI, Yield, Strike rate, CLV promedio, Drawdown máximo
- Gráfico línea: evolución del bankroll (Recharts)
- Tabla de apuestas con filtros: mercado, resultado, partido, paper/real
- Gráfico de calibración: prob. modelo (deciles) vs frecuencia real
- Tabla de rendimiento por mercado: qué mercados generan más ROI

### Navbar global

```
[HOY]  [GRUPOS]  [HISTORIAL]  [BANKROLL: $X,XXX]
```

Badge rojo en navbar si hay alerta activa: circuit breaker, cuota caducada, lineup disponible.

---

## Sección 6: Scripts y crons

### `scripts/cron.ts` — cron diario 08:00 AM

```
1. Fetcha fixtures del día desde API-Football
2. Por cada fixture:
   a. api-football: stats equipo, H2H, lesiones
   b. odds-api: cuotas de mercado (si hay créditos)
   c. balldontlie: datos complementarios
   d. Corre analyzer.analyzeMatch(fixtureId)
   e. Guarda MatchAnalysis en DB con isPreliminary: true
3. Log: fixtures procesados, créditos de odds restantes
```

### `scripts/pre-match-cron.ts` — 60 min antes de cada partido

```
Trigger: calculado dinámicamente según horario de cada partido
1. Re-fetcha lineup oficial (ya confirmado por FIFA)
2. Re-fetcha cuotas (movimiento de línea visible)
3. Re-corre analyzer con isPreliminary: false
4. Si EV de apuesta ya registrada cayó a negativo:
   → crea alerta urgente en DB para mostrar en UI
5. Marca análisis como 'final'
```

---

## Sección 7: Schema de DB (adiciones)

```sql
-- Apuestas registradas
CREATE TABLE IF NOT EXISTS bets (
  id INTEGER PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  market TEXT NOT NULL,
  our_probability REAL NOT NULL,
  bookmaker_probability REAL NOT NULL,
  odds_used REAL NOT NULL,
  odds_closing REAL,              -- se actualiza al cierre del mercado
  amount REAL NOT NULL,
  kelly_suggested REAL NOT NULL,
  ev REAL NOT NULL,
  edge REAL NOT NULL,
  result TEXT,                    -- 'win' | 'loss' | 'void' | null (pendiente)
  profit_loss REAL,
  mode TEXT NOT NULL DEFAULT 'real',  -- 'real' | 'paper'
  confidence_at_time INTEGER,
  created_at TEXT NOT NULL,
  settled_at TEXT
);

-- Snapshots de bankroll
CREATE TABLE IF NOT EXISTS bankroll_snapshots (
  id INTEGER PRIMARY KEY,
  balance REAL NOT NULL,
  snapshot_type TEXT NOT NULL,  -- 'daily' | 'weekly' | 'manual'
  created_at TEXT NOT NULL
);

-- Alertas del sistema
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY,
  fixture_id INTEGER,
  type TEXT NOT NULL,           -- 'ev_dropped' | 'lineup_available' | 'circuit_breaker' | 'stale_odds'
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Análisis guardados (reemplaza tabla predictions)
CREATE TABLE IF NOT EXISTS match_analyses (
  id INTEGER PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  is_preliminary INTEGER NOT NULL DEFAULT 1,
  confidence INTEGER NOT NULL,
  lambda_home REAL NOT NULL,
  lambda_away REAL NOT NULL,
  adjustments_applied TEXT NOT NULL,  -- JSON array
  markets TEXT NOT NULL,              -- JSON array de MarketResult
  alerts TEXT NOT NULL,               -- JSON array de strings
  data_quality INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
```

---

## Sección 8: Validación y paper trading

### Fase de paper trading (primeras 2 semanas del torneo)

- El sistema opera normalmente pero todas las apuestas se registran como `mode: 'paper'`
- El usuario ve las recomendaciones reales pero sin afectar bankroll
- Después de 20-30 partidos: revisar calibración del modelo
- Decisión consciente del usuario para pasar a `mode: 'real'`

### Gráfico de calibración

Compara en deciles (10%, 20%...90%):
- Eje X: probabilidad que dijo el modelo
- Eje Y: frecuencia real con la que ocurrió
- Línea diagonal = calibración perfecta
- Si el modelo está consistentemente sobre la diagonal → subestima (conservador)
- Si está bajo la diagonal → sobreestima (peligroso con Kelly)

### Backtest contra WC 2022 (pre-lanzamiento)

Antes de apostar dinero real, ejecutar el modelo sobre los 64 partidos de Qatar 2022 con cuotas históricas y verificar:
- ROI que hubiera generado
- Strike rate por mercado
- CLV promedio

Esto da la referencia de si el modelo tiene edge real o no.

---

## Subsistemas y orden de construcción

```
Sprint 1 (fundamentos):
  lib/data/     — pipeline de datos con fallback
  lib/model/    — Poisson corregido + Dixon-Coles + H2H + form + context
  scripts/cron  — cron diario funcional con datos reales

Sprint 2 (engine + Kelly):
  lib/engine/   — markets + ev + analyzer
  lib/kelly/    — criterion + portfolio + bankroll + tracker
  scripts/pre-match-cron — segundo cron 60 min antes

Sprint 3 (UI):
  app/hoy       — dashboard con partidos del día
  app/partido   — análisis profundo + inputs manuales + confirmación
  app/historial — track record + calibración

Sprint 4 (validación):
  Backtest WC 2022
  2 semanas paper trading
  Ajuste de parámetros según calibración real
```

---

## Decisiones de diseño importantes

1. **Un análisis por partido, no por mercado.** El `MatchAnalysis` contiene todos los mercados. Se guarda un registro por partido (actualizado en cada cron) no un registro por mercado.

2. **Las cuotas manuales siempre disponibles.** La UI siempre permite ingresar una cuota manualmente. El EV se recalcula en tiempo real sin necesidad de API.

3. **Paper trading es la primera fase, no opcional.** El sistema no tiene botón "ir en vivo" hasta que el usuario lo active explícitamente después de ver los resultados de paper.

4. **Un partido = máximo 1 apuesta correlacionada por grupo.** El portfolio module hace cumplir esto automáticamente.

5. **El CLV es la métrica principal de éxito a largo plazo**, no el ROI de corto plazo. Un CLV positivo sostenido indica edge real aunque haya rachas negativas.
