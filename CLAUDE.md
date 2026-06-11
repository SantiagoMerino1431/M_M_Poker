# CLAUDE.md — Mundial 2026 IA Predictor

## Qué es
App que proyecta TODOS los mercados estadísticos de cada partido del Mundial 2026 (resultado, goles, tarjetas, goleadores, corners) con un modelo propio. Framing: "así predice la IA el Mundial". Análisis de entretenimiento, NO casa de apuestas: solo muestra probabilidades, no recibe ni procesa apuestas.

## Stack
- Next.js 15 (App Router) + React + TypeScript
- Tailwind + shadcn/ui
- Recharts para visualizaciones
- SQLite (better-sqlite3) o Postgres local para cachear data
- node-cron / Vercel Cron para el recálculo diario
- Fuente de datos: API-Football (RapidAPI). Fallback: football-data.org

## Convenciones
- Server Actions para fetch de data, no API routes sueltas salvo el cron.
- Modelo de predicción aislado en lib/model/ (testeable, sin acoplar a UI).
- Toda predicción se guarda con timestamp para mostrar "histórico de predicciones".
- Nada de "--" (doble guion) en código ni texto.
- Componentes server por defecto; "use client" solo donde haya interactividad.

## Diseño
Esta app es para contenido viral: la UI no puede verse genérica de IA (Inter, gradientes morados, cards redondeadas flotando, Recharts default). Norte: look de terminal de datos deportiva (broadcast / Opta), números grandes como protagonista, fondo oscuro con un acento, visualizaciones custom. Comprométete con UNA dirección y no la sueltes entre pantallas.

## Correr en local
```bash
pnpm install
cp .env.example .env.local   # poner RAPIDAPI_KEY
pnpm dev                      # localhost:3000
pnpm cron:run                 # ejecuta el recálculo manualmente
```

