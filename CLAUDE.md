# CLAUDE.md — Mundial 2026 Betting Assistant

## Qué es
Herramienta personal de análisis y gestión de apuestas partido a partido para el Mundial 2026. Evalúa cada partido con un pipeline estadístico completo, calcula valor esperado (EV) por mercado y genera recomendaciones de apuesta con tamaño Kelly fraccionado. El usuario ajusta variables manuales (lesiones, cuotas actualizadas) antes de confirmar cada apuesta.

**No es una app pública ni una casa de apuestas.** Es una herramienta de análisis personal para uso privado.

## Stack
- Next.js 15 (App Router) + React + TypeScript
- Tailwind + shadcn/ui
- Recharts para visualizaciones
- Turso (LibSQL) via `@libsql/client` para persistencia
- node-cron para cron diario 08:00 AM + pre-match cron 60 min antes de cada partido
- API-Football (RapidAPI) — primaria: fixtures, stats, H2H, lesiones, lineups
- The Odds API — cuotas de mercado (500 créditos gratuitos totales)
- BALLDONTLIE FIFA API — datos complementarios gratuitos ilimitados
- football-data.org — fallback de fixtures

## Arquitectura en capas

```
lib/data/     fetchers de todas las fuentes externas + pipeline orquestador
lib/model/    motor estadístico: Poisson + Dixon-Coles + H2H + form + context
lib/engine/   markets, EV por mercado, analyzer completo por partido
lib/kelly/    Kelly fraccionado, portfolio simultáneo, bankroll, tracker
lib/db/       Turso client + schema + seed
app/hoy/      dashboard diario — partidos rankeados por EV
app/partido/  análisis profundo + inputs manuales + confirmación apuestas
app/historial/ track record + calibración del modelo + ROI
scripts/      cron.ts (08:00 AM) + pre-match-cron.ts (60 min antes)
```

## Convenciones
- Server Actions para fetch de data, no API routes sueltas salvo los crons.
- Modelo de predicción aislado en `lib/model/` (testeable, sin acoplar a UI).
- Motor de análisis en `lib/engine/` — recibe datos del pipeline, devuelve `MatchAnalysis` con todos los mercados y EV calculados.
- Todo análisis se guarda en tabla `match_analyses` con `isPreliminary` flag.
- Apuestas en tabla `bets` con campo `mode: 'real' | 'paper'` — siempre separar métricas.
- Nada de "--" (doble guion) en código ni texto.
- Componentes server por defecto; "use client" solo donde haya interactividad.
- Sin ventaja local por defecto en WC (terreno neutral). Excepción: USA 1.08, Canadá 1.06, México 1.10 en sus sedes.

## Modelo estadístico — reglas críticas
- Poisson con corrección Dixon-Coles (rho = -0.13) para scores bajos.
- Decaimiento temporal: `peso = e^(-0.1 * meses_atras)` — partidos viejos pesan menos.
- H2H limita el ajuste a ±15% sobre los lambdas base.
- Confidence score 0-100 controla el Kelly multiplier: <40 = no recomendar.
- Kelly fraccionado al 50%, ajustado por confidence. Límites: min 0.5%, max 8% por apuesta, max 15% exposure diaria.
- Circuit breaker: 5 pérdidas consecutivas = pausa automática 24h.

## Spec completo
Ver: `docs/superpowers/specs/2026-06-10-betting-assistant-design.md`

## Variables de entorno requeridas
```
TURSO_DATABASE_URL=    libsql://tu-db.turso.io
TURSO_AUTH_TOKEN=      tu-token
RAPIDAPI_KEY=          para API-Football
ODDS_API_KEY=          para The Odds API (the-odds-api.com)
```

## Correr en local
```bash
pnpm install
cp .env.example .env.local   # completar las 4 variables
pnpm dev                      # localhost:3000
pnpm cron:run                 # cron diario manual
pnpm pre-match:run            # pre-match cron manual (requiere fixture_id)
```

## Diseño UI
Terminal de datos deportiva (broadcast / Opta). Números grandes como protagonista, fondo oscuro (`#0a0c10`), acento amarillo-verde (`#e8ff3c`). Sin gradientes morados, sin cards flotantes, sin Inter como fuente principal. Una dirección visual consistente entre todas las pantallas.
