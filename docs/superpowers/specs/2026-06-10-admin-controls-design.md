# Admin Controls — Betting Assistant UI Design

## Goal

Exponer todos los scripts de ejecución y configuración como botones en la UI web, distribuyendo cada control en la página donde tiene sentido contextualmente. La app va a producción web; no hay scripts locales disponibles.

## Architecture

**Patrón base:** Client Components llamando Server Actions via `useTransition`. Un `<ConfirmDialog>` reutilizable maneja confirmaciones. Cada botón tiene su propio estado de carga aislado.

```
<ActionButton>          — "use client", spinner integrado, useTransition
  → Server Action       — lógica real, retorna { ok, message }
  → <ConfirmDialog>     — modal reutilizable cuando aplica
  → banner resultado    — inline success/error bajo el botón
```

**Nuevos archivos:**
- `src/components/ConfirmDialog.tsx` — modal genérico (título, descripción, confirmar/cancelar)
- `src/components/ActionButton.tsx` — botón con estado pending integrado
- Server Actions nuevas en `src/app/actions.ts`:
  - `runDailyCronAction()` → ejecuta lógica de `scripts/cron.ts`
  - `runPreMatchAction(fixtureId?: number)` → ejecuta lógica de `scripts/pre-match-cron.ts`
  - `settleBetAction(betId, result)` → liquida apuesta (win/loss/void)
  - `adjustBankrollAction(amount, reason)` → ajusta balance manualmente
  - `takeWeeklySnapshotAction()` → snapshot semanal del bankroll
  - `clearAlertsAction()` → marca alertas como leídas

---

## Page: `/hoy` — Panel diario

Barra de acciones en la esquina superior derecha del header.

### Botón: Pipeline Diario
- **Qué hace:** Corre `runDailyCronAction` — migrate, seed, fetchTodayFixtures, buildMatchData, saveAnalysisStub para cada fixture del día.
- **Confirmación:** No. Muestra spinner durante ejecución.
- **Resultado:** Banner inline — "3 partidos procesados" o mensaje de error.
- **Estado vacío:** Si no hay partidos hoy, muestra "0 partidos encontrados para hoy".

### Botón: Pre-Match
- **Qué hace:** Corre `runPreMatchAction()` sin fixtureId — procesa todos los fixtures a ≤65 min del momento actual.
- **Confirmación:** No. Muestra spinner.
- **Resultado:** Banner — "Lineups confirmados: ESP vs ARG" o "Sin partidos próximos en 65 min".

### Botón: Limpiar alertas
- **Qué hace:** Llama `clearAlertsAction()` — marca todas las alertas no leídas como `is_read = 1`.
- **Confirmación:** No.
- **Resultado:** Badge de alertas desaparece.

---

## Page: `/partido/[id]` — Análisis por partido

### Botón: Apostar (por mercado recomendado)
- **Qué hace:** Abre `<BetModal>` con los datos del mercado pre-llenados.
- **Modal contiene:**
  - Nombre del mercado + selección + cuota
  - Input de monto (pre-llenado con `kellyAmount`, editable)
  - Toggle **Real / Paper**
  - Botón "Confirmar apuesta" → llama `registerBet()`
  - Botón "Cancelar"
- **Confirmación:** El modal mismo es la confirmación.
- **Resultado:** Banner "Apuesta registrada — $X COP" y botón desaparece del mercado.

### Input: Actualizar cuota
- **Qué hace:** Permite ingresar cuota manual cuando la API no tiene datos.
- **Implementación:** Input inline junto a cada mercado, con botón "Guardar" que actualiza el análisis en DB.
- **Confirmación:** No.

### Botón: Pre-match este partido
- **Qué hace:** Llama `runPreMatchAction(fixtureId)` — actualiza lineups y cuotas para este fixture específico y marca análisis como FINAL.
- **Confirmación:** No. Spinner + resultado.

---

## Page: `/historial` — Track record

### Botón: Liquidar (por apuesta pendiente)
- **Qué hace:** Abre `<SettleModal>` para una apuesta sin resultado.
- **Modal contiene:**
  - Resumen de la apuesta (mercado, monto, cuota)
  - Tres botones: **Ganada** / **Perdida** / **Void**
  - Botón cancelar
- **Al confirmar:** Llama `settleBetAction(betId, result)` — actualiza `result` y calcula `profit_loss`.
- **Confirmación:** El modal con los 3 botones claros es la confirmación.

### Botón: Ajustar bankroll
- **Qué hace:** Abre modal con input numérico.
- **Modal contiene:**
  - Input de nuevo balance (en COP)
  - Input de razón (opcional, ej. "Depósito inicial", "Corrección")
  - Botón confirmar / cancelar
- **Al confirmar:** Llama `adjustBankrollAction(amount, reason)` — inserta snapshot `manual`.
- **Confirmación:** Modal explícito — "¿Ajustar bankroll a $X COP?"

### Botón: Snapshot semanal
- **Qué hace:** Guarda el balance actual como referencia semanal (base para calcular drawdown semanal).
- **Modal:** "¿Guardar $X como referencia de esta semana?" con confirmar/cancelar.
- **Al confirmar:** Llama `takeWeeklySnapshotAction()` — inserta snapshot `weekly`.

---

## Components

### `<ConfirmDialog>`
```typescript
interface Props {
  open: boolean
  title: string
  description: string
  confirmLabel?: string       // default: "Confirmar"
  cancelLabel?: string        // default: "Cancelar"
  variant?: "default" | "danger"
  onConfirm: () => void
  onCancel: () => void
  children?: React.ReactNode  // contenido custom (ej. input dentro del modal)
}
```

### `<ActionButton>`
```typescript
interface Props {
  action: () => Promise<{ ok: boolean; message: string }>
  label: string
  pendingLabel?: string       // default: label + "..."
  variant?: "primary" | "secondary" | "ghost"
  requireConfirm?: boolean
  confirmTitle?: string
  confirmDescription?: string
}
```

### `<BetModal>` (específico de `/partido`)
```typescript
interface Props {
  market: MarketResult
  fixtureId: number
  defaultAmount: number
  bankroll: number
  onClose: () => void
}
```

### `<SettleModal>` (específico de `/historial`)
```typescript
interface Props {
  bet: Bet
  onClose: () => void
}
```

---

## Server Actions nuevas

```typescript
// En src/app/actions.ts

export async function runDailyCronAction(): Promise<{ ok: boolean; message: string }>
export async function runPreMatchAction(fixtureId?: number): Promise<{ ok: boolean; message: string }>
export async function settleBetAction(betId: number, result: "win" | "loss" | "void"): Promise<{ ok: boolean }>
export async function adjustBankrollAction(amount: number, reason?: string): Promise<{ ok: boolean }>
export async function takeWeeklySnapshotAction(): Promise<{ ok: boolean }>
export async function clearAlertsAction(): Promise<{ ok: boolean }>
export async function updateMarketOddsAction(fixtureId: number, market: string, selection: string, odds: number): Promise<{ ok: boolean }>
```

---

## Estilo visual

Consistente con el diseño existente (fondo `#0a0c10`, acento `#e8ff3c`):

- **Botón primario:** fondo `var(--accent)`, texto negro, mayúsculas, monospace
- **Botón secundario:** borde `var(--border)`, texto `var(--text-muted)`
- **Botón danger:** borde rojo `var(--loss)`, para "Liquidar"
- **Modal overlay:** fondo `rgba(0,0,0,0.8)`, caja `var(--surface)` con borde `var(--border)`
- **Banner resultado:** strip de 1 línea bajo el botón, color según ok/error
- **Spinner:** caracteres `-\|/` rotando (no librerías externas)

---

## Notas de implementación

- `runDailyCronAction` y `runPreMatchAction` importan directamente la lógica de los scripts (`buildMatchData`, `fetchTodayFixtures`, etc.) — no ejecutan procesos externos.
- Las Server Actions tienen `"use server"` y pueden correr en Vercel Edge o Node runtime.
- `useTransition` en cada botón evita bloquear la UI durante operaciones largas.
- Los banners de resultado usan estado local (`useState`) y se limpian solos a los 5 segundos.
