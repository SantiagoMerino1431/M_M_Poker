# PLAN.md — Mundial 2026 IA Predictor

Plan de implementación por fases. Objetivo: app en Next.js que recalcula a diario y proyecta todos los mercados estadísticos por partido, lista para grabar contenido.

---

## Arquitectura general

```
Cron diario
   -> Ingesta de data (API-Football)
   -> Normaliza y guarda en SQLite
   -> Corre el modelo de predicción
   -> Guarda predicciones con timestamp
   -> Dashboard (Next.js) lee de SQLite y renderiza
```

Tres capas separadas: ingesta (data cruda), modelo (math puro, sin red), presentación (UI). El modelo nunca llama a la API; solo consume lo que ya está en DB. Esto lo hace testeable y rápido.

---

## Fuentes de datos

1. **API-Football (RapidAPI)** — recomendada. Tiene fixtures, resultados en vivo, lineups, eventos (goles, tarjetas, minuto), estadísticas por partido (corners, shots, posesión) y stats por jugador. Plan free: 100 requests/día.
2. **football-data.org** — free, buena para fixtures y resultados, sirve de fallback.

---

## Mercados que proyecta el modelo

- **Resultado 1X2**: gana local / empate / gana visitante.
- **Doble oportunidad**: 1X, 12, X2.
- **Over/Under goles**: líneas 1.5, 2.5, 3.5.
- **BTTS** (ambos marcan): sí / no.
- **Marcador exacto**: top 5 marcadores más probables.
- **Goleador**: primer goleador y goleador en cualquier momento.
- **Total de tarjetas**: over/under 3.5, probabilidad de roja.
- **Corners**: over/under (línea dinámica).
- **Clean sheet / gana a cero**.
- **Torneo**: clasificados por grupo, proyección de campeón, Bota de Oro.

---

## El modelo (lib/model/)

- **Base**: distribución de Poisson sobre goles esperados (xG). Estándar de la industria para proyectar goles, BTTS, over/under y marcador exacto.
- **Lambda (goles esperados)**: fuerza ofensiva del equipo, fuerza defensiva del rival, ranking FIFA, forma reciente (últimos 5-10 partidos), ventaja de sede.
- **Tarjetas y corners**: regresión sobre promedios históricos ajustada por intensidad del partido.
- **Goleadores**: reparte el lambda del equipo entre jugadores según goles por minuto histórico.
- **Campeón / Bota de Oro**: Monte Carlo — correr el torneo 10.000 veces y contar frecuencias.

---

## Fases

### Fase 0 — Setup (medio día)
- create-next-app con TS, Tailwind, App Router.
- shadcn/ui init, Recharts, better-sqlite3, vitest.
- Estructura: app/, lib/data/, lib/model/, lib/db/, scripts/cron.ts.
- .env.example con RAPIDAPI_KEY.

### Fase 1 — Ingesta y DB (1 día)
- Schema SQLite: teams, players, fixtures, match_events, match_stats, predictions.
- Cliente de API-Football con retry y cache.
- Seed de los 12 grupos y 48 equipos del Mundial 2026.

### Fase 2 — Modelo de predicción (1-2 días)
- lib/model/poisson.ts: goles esperados -> matriz de probabilidad de marcadores.
- Derivar de esa matriz: 1X2, over/under, BTTS, marcador exacto.
- lib/model/cards.ts, corners.ts, scorers.ts, montecarlo.ts.
- Tests con vitest para validar que los números tienen sentido.

### Fase 3 — Cron diario (medio día)
- scripts/cron.ts: trae resultados nuevos, actualiza forma, recalcula predicciones.
- Local: node-cron. Deploy: Vercel Cron (1 vez al día).

### Fase 4 — Dashboard (2 días)
- Home: proyección de campeón (Monte Carlo) + Bota de Oro.
- Vista grupo: tabla proyectada de clasificación.
- Vista partido: todos los mercados en cards visuales.
- Diseño oscuro, tipografía grande, colores por probabilidad.

### Fase 5 — Pulido y deploy (medio día)
- Animaciones con framer-motion.
- Banner: "Análisis estadístico de entretenimiento. No es asesoría de apuestas."
- Deploy a Vercel con Cron activo.
- Modo captura: vista limpia para los clips.

---

## Riesgos

- **Límite API free**: el cron diario con cache lo respeta. Para data en vivo durante partidos hay que pasar a plan pago.
- **Calidad de predicciones**: Poisson es sólido para goles, más ruidoso para tarjetas/corners. Mostrar confianza baja en esos mercados.
- **Legal**: mientras la app solo muestre probabilidades y no reciba dinero, es análisis estadístico.