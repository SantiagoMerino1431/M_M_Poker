# Admin Controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose all script operations as interactive UI controls distributed across `/hoy`, `/partido/[id]`, and `/historial`, so the app runs fully in production without any local scripts.

**Architecture:** Client components call Server Actions via `useTransition`. Two reusable base components (`ConfirmDialog`, `ActionButton`) handle all interaction patterns. Page-specific modals (`BetModal`, `SettleModal`) handle complex flows. All Server Actions are added to `src/app/actions.ts`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Turso/LibSQL, `"use client"` + `useTransition`, no external UI libs for modals.

---

## File Map

| File | Action |
|------|--------|
| `src/components/ConfirmDialog.tsx` | Create — reusable modal overlay |
| `src/components/ActionButton.tsx` | Create — button with pending state + optional confirm |
| `src/components/BetModal.tsx` | Create — bet registration modal for `/partido/[id]` |
| `src/components/SettleModal.tsx` | Create — settle pending bet for `/historial` |
| `src/app/actions.ts` | Modify — add 7 new Server Actions |
| `src/app/hoy/page.tsx` | Modify — add action bar (3 buttons) |
| `src/app/partido/[id]/page.tsx` | Modify — add bet buttons + pre-match button + odds input |
| `src/app/historial/page.tsx` | Modify — add settle buttons + bankroll adjust + snapshot |

---

### Task 1: ConfirmDialog component

**Files:**
- Create: `src/components/ConfirmDialog.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client"
import { useEffect, useRef } from "react"

interface Props {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "danger"
  onConfirm: () => void
  onCancel: () => void
  children?: React.ReactNode
}

export function ConfirmDialog({
  open, title, description,
  confirmLabel = "Confirmar", cancelLabel = "Cancelar",
  variant = "default", onConfirm, onCancel, children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onCancel])

  if (!open) return null

  const confirmStyle: React.CSSProperties = variant === "danger"
    ? { background: "transparent", border: "1px solid var(--loss)", color: "var(--loss)", cursor: "pointer", padding: "8px 16px", fontFamily: "inherit", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: "0.08em" }
    : { background: "var(--accent)", border: "none", color: "#000", cursor: "pointer", padding: "8px 16px", fontFamily: "inherit", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 700 }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div ref={ref} style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 24, maxWidth: 440, width: "90%", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{description}</div>
        </div>
        {children && <div>{children}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", padding: "8px 16px", fontFamily: "inherit", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} style={confirmStyle}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ConfirmDialog.tsx
git commit -m "feat: add ConfirmDialog reusable modal component"
```

---

### Task 2: ActionButton component

**Files:**
- Create: `src/components/ActionButton.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client"
import { useState, useTransition } from "react"
import { ConfirmDialog } from "./ConfirmDialog"

interface Props {
  action: () => Promise<{ ok: boolean; message: string }>
  label: string
  pendingLabel?: string
  variant?: "primary" | "secondary" | "ghost"
  requireConfirm?: boolean
  confirmTitle?: string
  confirmDescription?: string
}

const SPINNER = ["-", "\\", "|", "/"]

export function ActionButton({
  action, label, pendingLabel,
  variant = "secondary",
  requireConfirm = false,
  confirmTitle = label,
  confirmDescription = "",
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [spinnerIdx, setSpinnerIdx] = useState(0)

  const execute = () => {
    setResult(null)
    const interval = setInterval(() => setSpinnerIdx(i => (i + 1) % 4), 150)
    startTransition(async () => {
      const res = await action()
      clearInterval(interval)
      setResult(res)
      setTimeout(() => setResult(null), 5000)
    })
  }

  const handleClick = () => {
    if (requireConfirm) { setShowConfirm(true); return }
    execute()
  }

  const baseStyle: React.CSSProperties = {
    cursor: isPending ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    padding: "6px 12px",
    opacity: isPending ? 0.7 : 1,
  }

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent)", border: "none", color: "#000", fontWeight: 700 },
    secondary: { background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" },
    ghost: { background: "transparent", border: "none", color: "var(--text-muted)" },
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button onClick={handleClick} disabled={isPending} style={{ ...baseStyle, ...variantStyles[variant] }}>
        {isPending ? `${SPINNER[spinnerIdx]} ${pendingLabel ?? label}...` : label}
      </button>
      {result && (
        <div style={{ fontSize: 10, color: result.ok ? "var(--win)" : "var(--loss)", letterSpacing: "0.06em" }}>
          {result.message}
        </div>
      )}
      <ConfirmDialog
        open={showConfirm}
        title={confirmTitle}
        description={confirmDescription}
        onConfirm={() => { setShowConfirm(false); execute() }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ActionButton.tsx
git commit -m "feat: add ActionButton with spinner, result banner, optional confirm"
```

---

### Task 3: New Server Actions

**Files:**
- Modify: `src/app/actions.ts`

- [ ] **Step 1: Add the 7 new Server Actions**

Append to `src/app/actions.ts` after the existing `getDashboardData` export:

```typescript
// --- Admin Actions ---

export async function runDailyCronAction(): Promise<{ ok: boolean; message: string }> {
  "use server"
  try {
    const { migrate } = await import("@/lib/db/schema")
    const { seed } = await import("@/lib/db/seed")
    const { fetchTodayFixtures } = await import("@/lib/data/api-football")
    const { buildMatchData } = await import("@/lib/data/pipeline")

    await migrate()
    await seed()

    const teamsRows = await db.execute("SELECT * FROM teams")
    const teams = new Map<number, any>()
    for (const row of teamsRows.rows as any[]) {
      teams.set(row.id, {
        id: row.id, name: row.name, country: row.country, groupName: row.group_name,
        fifaRanking: row.fifa_ranking, attackStrength: row.attack_strength,
        defenseStrength: row.defense_strength,
      })
    }

    const fixtures = await fetchTodayFixtures()
    let processed = 0

    for (const fixture of fixtures) {
      const home = teams.get(fixture.homeTeamId)
      const away = teams.get(fixture.awayTeamId)
      if (!home || !away) continue
      try {
        const matchData = await buildMatchData(fixture, home, away)
        await db.execute({
          sql: `INSERT OR REPLACE INTO match_analyses
                (fixture_id, is_preliminary, confidence, lambda_home, lambda_away,
                 adjustments_applied, markets, alerts, data_quality, created_at)
                VALUES (?, 1, ?, 0, 0, '[]', '[]', '[]', ?, ?)`,
          args: [fixture.id, matchData.dataQuality, matchData.dataQuality, new Date().toISOString()],
        })
        processed++
      } catch {
        // continue with next fixture
      }
    }

    return { ok: true, message: `${processed} partido${processed !== 1 ? "s" : ""} procesado${processed !== 1 ? "s" : ""}` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error en pipeline diario" }
  }
}

export async function runPreMatchAction(fixtureId?: number): Promise<{ ok: boolean; message: string }> {
  "use server"
  try {
    const { fetchTodayFixtures, fetchLineups } = await import("@/lib/data/api-football")
    const { fetchOdds } = await import("@/lib/data/odds-api")

    const teamsRows = await db.execute("SELECT * FROM teams")
    const teams = new Map<number, any>()
    for (const row of teamsRows.rows as any[]) {
      teams.set(row.id, { id: row.id, name: row.name })
    }

    const fixtures = await fetchTodayFixtures()
    const now = Date.now()

    const targets = fixtureId
      ? fixtures.filter(f => f.id === fixtureId)
      : fixtures.filter(f => {
          const minutesBefore = (new Date(f.date).getTime() - now) / 60000
          return minutesBefore >= 55 && minutesBefore <= 65
        })

    if (targets.length === 0) {
      return { ok: true, message: fixtureId ? "Fixture no encontrado" : "Sin partidos en los próximos 65 min" }
    }

    const names: string[] = []
    for (const fixture of targets) {
      const home = teams.get(fixture.homeTeamId)
      const away = teams.get(fixture.awayTeamId)
      if (!home || !away) continue

      const lineups = await fetchLineups(fixture.id)
      if (lineups.home && lineups.away) {
        await db.execute({
          sql: `INSERT INTO alerts (fixture_id, type, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
          args: [fixture.id, "lineup_available", `Alineaciones confirmadas: ${home.name} vs ${away.name}`, new Date().toISOString()],
        })
        names.push(`${home.name} vs ${away.name}`)
      }

      const odds = await fetchOdds(home.name, away.name)
      if (odds.length === 0) {
        await db.execute({
          sql: `INSERT INTO alerts (fixture_id, type, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
          args: [fixture.id, "stale_odds", `Sin cuotas: ${home.name} vs ${away.name}`, new Date().toISOString()],
        })
      }

      await db.execute({
        sql: `UPDATE match_analyses SET is_preliminary = 0 WHERE fixture_id = ?`,
        args: [fixture.id],
      })
    }

    return { ok: true, message: names.length > 0 ? `Lineups: ${names.join(", ")}` : "Procesado — sin lineups disponibles" }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error en pre-match" }
  }
}

export async function settleBetAction(
  betId: number,
  result: "win" | "loss" | "void"
): Promise<{ ok: boolean; message: string }> {
  "use server"
  try {
    const rows = await db.execute({ sql: "SELECT * FROM bets WHERE id = ?", args: [betId] })
    const bet = rows.rows[0] as any
    if (!bet) return { ok: false, message: "Apuesta no encontrada" }

    const profitLoss = result === "win"
      ? Math.round(bet.amount * (bet.odds_used - 1))
      : result === "loss" ? -bet.amount : 0

    await db.execute({
      sql: `UPDATE bets SET result = ?, profit_loss = ?, settled_at = ? WHERE id = ?`,
      args: [result, profitLoss, new Date().toISOString(), betId],
    })

    const label = result === "win" ? `+$${profitLoss}` : result === "loss" ? `-$${bet.amount}` : "Void"
    return { ok: true, message: `Liquidada: ${label} COP` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al liquidar" }
  }
}

export async function adjustBankrollAction(
  amount: number,
  reason?: string
): Promise<{ ok: boolean; message: string }> {
  "use server"
  try {
    await db.execute({
      sql: `INSERT INTO bankroll_snapshots (type, balance, note, created_at) VALUES (?, ?, ?, ?)`,
      args: ["manual", amount, reason ?? "Ajuste manual", new Date().toISOString()],
    })
    return { ok: true, message: `Bankroll ajustado a $${amount.toLocaleString("es-CO")} COP` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al ajustar bankroll" }
  }
}

export async function takeWeeklySnapshotAction(): Promise<{ ok: boolean; message: string }> {
  "use server"
  try {
    const { getBankrollState } = await import("@/lib/kelly/bankroll")
    const state = await getBankrollState()
    await db.execute({
      sql: `INSERT INTO bankroll_snapshots (type, balance, note, created_at) VALUES (?, ?, ?, ?)`,
      args: ["weekly", state.current, "Snapshot semanal manual", new Date().toISOString()],
    })
    return { ok: true, message: `Snapshot: $${state.current.toLocaleString("es-CO")} COP` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al guardar snapshot" }
  }
}

export async function clearAlertsAction(): Promise<{ ok: boolean; message: string }> {
  "use server"
  try {
    const res = await db.execute("UPDATE alerts SET is_read = 1 WHERE is_read = 0")
    const count = res.rowsAffected ?? 0
    return { ok: true, message: `${count} alerta${count !== 1 ? "s" : ""} marcada${count !== 1 ? "s" : ""} como leída${count !== 1 ? "s" : ""}` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al limpiar alertas" }
  }
}

export async function updateMarketOddsAction(
  fixtureId: number,
  market: string,
  selection: string,
  odds: number
): Promise<{ ok: boolean; message: string }> {
  "use server"
  try {
    const rows = await db.execute({
      sql: "SELECT markets FROM match_analyses WHERE fixture_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [fixtureId],
    })
    const row = rows.rows[0] as any
    if (!row) return { ok: false, message: "Análisis no encontrado" }

    const markets = JSON.parse(row.markets || "[]") as any[]
    const updated = markets.map(m =>
      m.name === market && m.selection === selection
        ? { ...m, odds, bookmakerProbability: 1 / odds, bookmaker: "manual" }
        : m
    )

    await db.execute({
      sql: `UPDATE match_analyses SET markets = ? WHERE fixture_id = ?`,
      args: [JSON.stringify(updated), fixtureId],
    })
    return { ok: true, message: `Cuota actualizada: ${market} ${selection} @${odds}` }
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Error al actualizar cuota" }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/actions.ts
git commit -m "feat: add admin Server Actions (cron, pre-match, settle, bankroll, odds)"
```

---

### Task 4: BetModal component

**Files:**
- Create: `src/components/BetModal.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client"
import { useState, useTransition } from "react"
import type { MarketResult } from "@/lib/types"
import { registerBet } from "@/app/actions"

interface Props {
  market: MarketResult
  fixtureId: number
  defaultAmount: number
  onClose: (registered: boolean) => void
}

export function BetModal({ market, fixtureId, defaultAmount, onClose }: Props) {
  const [amount, setAmount] = useState(defaultAmount)
  const [mode, setMode] = useState<"real" | "paper">("paper")
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const handleConfirm = () => {
    startTransition(async () => {
      await registerBet({
        fixtureId,
        market: market.name,
        selection: market.selection,
        oddsUsed: market.odds ?? 0,
        amount,
        EV: market.EV ?? 0,
        kellyFraction: market.kellyFraction ?? 0,
        mode,
        result: null,
        profitLoss: null,
        placedAt: new Date().toISOString(),
        settledAt: null,
      })
      setMessage(`Apuesta registrada — $${amount.toLocaleString("es-CO")} COP`)
      setTimeout(() => onClose(true), 1500)
    })
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 24, maxWidth: 400, width: "90%", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Registrar apuesta</div>
          <div style={{ fontSize: 16, fontWeight: 700, textTransform: "uppercase" }}>{market.name}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{market.selection} {market.bookmaker ? `· ${market.bookmaker}` : ""}</div>
          {market.odds && (
            <div className="stat-number" style={{ fontSize: 28, color: "var(--accent)", marginTop: 4 }}>@{market.odds}</div>
          )}
        </div>

        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>
            Monto (COP)
          </label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            style={{ width: "100%", background: "var(--surface-2, #111)", border: "1px solid var(--border)", color: "inherit", padding: "8px 10px", fontFamily: "inherit", fontSize: 16, boxSizing: "border-box" as const }}
          />
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {(["paper", "real"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: "6px", fontFamily: "inherit", fontSize: 11,
                textTransform: "uppercase" as const, letterSpacing: "0.08em", cursor: "pointer",
                background: mode === m ? (m === "real" ? "var(--accent)" : "var(--surface-2, #111)") : "transparent",
                border: mode === m ? "none" : "1px solid var(--border)",
                color: mode === m ? (m === "real" ? "#000" : "inherit") : "var(--text-muted)",
                fontWeight: mode === m ? 700 : 400,
              }}
            >
              {m === "paper" ? "Paper" : "Real"}
            </button>
          ))}
        </div>

        {message && (
          <div style={{ fontSize: 11, color: "var(--win)", letterSpacing: "0.06em" }}>{message}</div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => onClose(false)} disabled={isPending} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", padding: "8px 16px", fontFamily: "inherit", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={isPending} style={{ background: "var(--accent)", border: "none", color: "#000", cursor: isPending ? "not-allowed" : "pointer", padding: "8px 16px", fontFamily: "inherit", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, opacity: isPending ? 0.7 : 1 }}>
            {isPending ? "Registrando..." : "Confirmar apuesta"}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BetModal.tsx
git commit -m "feat: add BetModal for registering bets from partido page"
```

---

### Task 5: SettleModal component

**Files:**
- Create: `src/components/SettleModal.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client"
import { useState, useTransition } from "react"
import type { Bet } from "@/lib/types"
import { settleBetAction } from "@/app/actions"

interface Props {
  bet: Bet
  onClose: (settled: boolean) => void
}

export function SettleModal({ bet, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const settle = (result: "win" | "loss" | "void") => {
    startTransition(async () => {
      const res = await settleBetAction(bet.id!, result)
      setMessage(res.message)
      if (res.ok) setTimeout(() => onClose(true), 1500)
    })
  }

  const btnBase: React.CSSProperties = {
    flex: 1, padding: "10px", fontFamily: "inherit", fontSize: 12,
    textTransform: "uppercase" as const, letterSpacing: "0.08em",
    cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 24, maxWidth: 400, width: "90%", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Liquidar apuesta</div>
          <div style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase" }}>{bet.market} · {bet.selection}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <span className="stat-number" style={{ fontSize: 20 }}>@{bet.oddsUsed}</span>
            <span className="stat-number" style={{ fontSize: 20, color: "var(--accent)" }}>${bet.amount.toLocaleString("es-CO")}</span>
          </div>
        </div>

        {message && (
          <div style={{ fontSize: 11, color: "var(--win)", letterSpacing: "0.06em" }}>{message}</div>
        )}

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => settle("win")} disabled={isPending} style={{ ...btnBase, background: "rgba(34,197,94,0.15)", border: "1px solid var(--win)", color: "var(--win)", fontWeight: 700 }}>
            Ganada
          </button>
          <button onClick={() => settle("loss")} disabled={isPending} style={{ ...btnBase, background: "rgba(239,68,68,0.1)", border: "1px solid var(--loss)", color: "var(--loss)", fontWeight: 700 }}>
            Perdida
          </button>
          <button onClick={() => settle("void")} disabled={isPending} style={{ ...btnBase, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            Void
          </button>
        </div>

        <div style={{ textAlign: "right" }}>
          <button onClick={() => onClose(false)} disabled={isPending} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SettleModal.tsx
git commit -m "feat: add SettleModal for liquidating pending bets"
```

---

### Task 6: HoyActions component + wire into `/hoy`

**Files:**
- Create: `src/components/HoyActions.tsx`
- Modify: `src/app/hoy/page.tsx`

- [ ] **Step 1: Create HoyActions**

```typescript
"use client"
import { ActionButton } from "./ActionButton"
import { runDailyCronAction, runPreMatchAction, clearAlertsAction } from "@/app/actions"

export function HoyActions() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <ActionButton
        label="Pipeline diario"
        pendingLabel="Procesando"
        action={runDailyCronAction}
        variant="primary"
      />
      <ActionButton
        label="Pre-match"
        pendingLabel="Cargando lineups"
        action={() => runPreMatchAction()}
        variant="secondary"
      />
      <ActionButton
        label="Limpiar alertas"
        action={clearAlertsAction}
        variant="ghost"
      />
    </div>
  )
}
```

- [ ] **Step 2: Add HoyActions to `/hoy/page.tsx`**

In `src/app/hoy/page.tsx`, find the header block (the `<div style={{ marginBottom: 40 }}>` that contains the date heading). Add `<HoyActions />` at the bottom of that block. Import it at the top of the file.

The header section currently ends after the `<h1>` — add after the heading:

```typescript
import { HoyActions } from "@/components/HoyActions"

// ... inside the header div, after the h1:
<div style={{ marginTop: 16 }}>
  <HoyActions />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/HoyActions.tsx src/app/hoy/page.tsx
git commit -m "feat: add pipeline controls to /hoy header"
```

---

### Task 7: PartidoActions — bet buttons + pre-match + odds input

**Files:**
- Create: `src/components/PartidoActions.tsx`
- Modify: `src/app/partido/[id]/page.tsx`

- [ ] **Step 1: Create PartidoActions**

```typescript
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import type { MarketResult } from "@/lib/types"
import { BetModal } from "./BetModal"
import { ActionButton } from "./ActionButton"
import { runPreMatchAction, updateMarketOddsAction } from "@/app/actions"

interface Props {
  markets: MarketResult[]
  fixtureId: number
  bankroll: number
}

export function PartidoActions({ markets, fixtureId, bankroll }: Props) {
  const router = useRouter()
  const [activeBetMarket, setActiveBetMarket] = useState<MarketResult | null>(null)
  const [oddsInputs, setOddsInputs] = useState<Record<string, string>>({})
  const [oddsMessages, setOddsMessages] = useState<Record<string, string>>({})

  const recommended = markets.filter(m => m.isRecommended)

  const handleSaveOdds = async (market: MarketResult) => {
    const key = `${market.name}|${market.selection}`
    const val = parseFloat(oddsInputs[key] ?? "")
    if (isNaN(val) || val < 1) return
    const res = await updateMarketOddsAction(fixtureId, market.name, market.selection, val)
    setOddsMessages(prev => ({ ...prev, [key]: res.message }))
    setTimeout(() => setOddsMessages(prev => { const n = { ...prev }; delete n[key]; return n }), 4000)
    router.refresh()
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <ActionButton
          label="Pre-match este partido"
          pendingLabel="Cargando lineups"
          action={() => runPreMatchAction(fixtureId)}
          variant="secondary"
        />
      </div>

      {recommended.map((m, i) => {
        const key = `${m.name}|${m.selection}`
        return (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setActiveBetMarket(m)}
              style={{ background: "var(--accent)", border: "none", color: "#000", cursor: "pointer", padding: "6px 14px", fontFamily: "inherit", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}
            >
              Apostar {m.name}
            </button>
            {!m.odds && (
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input
                  type="number"
                  placeholder="Cuota manual"
                  value={oddsInputs[key] ?? ""}
                  onChange={e => setOddsInputs(prev => ({ ...prev, [key]: e.target.value }))}
                  step="0.01"
                  style={{ width: 100, background: "transparent", border: "1px solid var(--border)", color: "inherit", padding: "4px 8px", fontFamily: "inherit", fontSize: 12 }}
                />
                <button
                  onClick={() => handleSaveOdds(m)}
                  style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", padding: "4px 10px", fontFamily: "inherit", fontSize: 11, textTransform: "uppercase" }}
                >
                  Guardar
                </button>
                {oddsMessages[key] && (
                  <span style={{ fontSize: 10, color: "var(--win)" }}>{oddsMessages[key]}</span>
                )}
              </div>
            )}
          </div>
        )
      })}

      {activeBetMarket && (
        <BetModal
          market={activeBetMarket}
          fixtureId={fixtureId}
          defaultAmount={activeBetMarket.kellyAmount ?? 500}
          onClose={(registered) => {
            setActiveBetMarket(null)
            if (registered) router.refresh()
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Wire into `/partido/[id]/page.tsx`**

Import `PartidoActions` and `getBankrollState`. Replace the static "Registrar apuesta" placeholder section and add `PartidoActions` after the recommended markets section. Also pass the bankroll state from the server.

At the top of `PartidoPage`:
```typescript
import { PartidoActions } from "@/components/PartidoActions"
import { getBankrollState } from "@/lib/kelly/bankroll"
```

Change `getAnalysisForFixture` call to also fetch bankroll:
```typescript
const [analysis, bankrollState] = await Promise.all([
  getAnalysisForFixture(fixtureId),
  getBankrollState(),
])
```

Replace the static "Registrar apuesta" `<div>` (lines 164-171 in current file) with:
```typescript
<PartidoActions
  markets={analysis.markets}
  fixtureId={fixtureId}
  bankroll={bankrollState.current}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PartidoActions.tsx src/app/partido/[id]/page.tsx
git commit -m "feat: add bet buttons, odds input, and pre-match control to /partido/[id]"
```

---

### Task 8: HistorialActions — settle, adjust bankroll, snapshot

**Files:**
- Create: `src/components/HistorialActions.tsx`
- Modify: `src/app/historial/page.tsx`

- [ ] **Step 1: Create HistorialActions**

```typescript
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Bet } from "@/lib/types"
import { SettleModal } from "./SettleModal"
import { ConfirmDialog } from "./ConfirmDialog"
import { ActionButton } from "./ActionButton"
import { adjustBankrollAction, takeWeeklySnapshotAction } from "@/app/actions"

interface Props {
  pendingBets: Bet[]
  currentBankroll: number
}

export function HistorialActions({ pendingBets, currentBankroll }: Props) {
  const router = useRouter()
  const [settleBet, setSettleBet] = useState<Bet | null>(null)
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState(currentBankroll)
  const [adjustReason, setAdjustReason] = useState("")
  const [adjustPending, setAdjustPending] = useState(false)
  const [adjustMsg, setAdjustMsg] = useState("")

  const handleAdjust = async () => {
    setAdjustPending(true)
    const res = await adjustBankrollAction(adjustAmount, adjustReason || undefined)
    setAdjustMsg(res.message)
    setAdjustPending(false)
    if (res.ok) { setShowAdjust(false); router.refresh() }
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowAdjust(true)}
          style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", padding: "6px 12px", fontFamily: "inherit", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          Ajustar bankroll
        </button>
        <ActionButton
          label="Snapshot semanal"
          action={takeWeeklySnapshotAction}
          variant="secondary"
          requireConfirm
          confirmTitle="Guardar snapshot semanal"
          confirmDescription={`¿Guardar $${currentBankroll.toLocaleString("es-CO")} COP como referencia de esta semana?`}
        />
      </div>

      {pendingBets.map(bet => (
        <div key={bet.id} style={{ display: "inline-flex", marginRight: 8, marginBottom: 4 }}>
          <button
            onClick={() => setSettleBet(bet)}
            style={{ background: "transparent", border: "1px solid var(--loss)", color: "var(--loss)", cursor: "pointer", padding: "4px 10px", fontFamily: "inherit", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            Liquidar #{bet.id}
          </button>
        </div>
      ))}

      {settleBet && (
        <SettleModal
          bet={settleBet}
          onClose={(settled) => { setSettleBet(null); if (settled) router.refresh() }}
        />
      )}

      <ConfirmDialog
        open={showAdjust}
        title="Ajustar bankroll"
        description="Ingresa el nuevo balance y una razón opcional."
        confirmLabel={adjustPending ? "Guardando..." : "Confirmar"}
        onConfirm={handleAdjust}
        onCancel={() => setShowAdjust(false)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            type="number"
            value={adjustAmount}
            onChange={e => setAdjustAmount(Number(e.target.value))}
            placeholder="Nuevo balance (COP)"
            style={{ background: "var(--surface-2, #111)", border: "1px solid var(--border)", color: "inherit", padding: "8px", fontFamily: "inherit", fontSize: 14 }}
          />
          <input
            type="text"
            value={adjustReason}
            onChange={e => setAdjustReason(e.target.value)}
            placeholder="Razón (opcional)"
            style={{ background: "var(--surface-2, #111)", border: "1px solid var(--border)", color: "inherit", padding: "8px", fontFamily: "inherit", fontSize: 13 }}
          />
          {adjustMsg && <div style={{ fontSize: 11, color: "var(--loss)" }}>{adjustMsg}</div>}
        </div>
      </ConfirmDialog>
    </>
  )
}
```

- [ ] **Step 2: Wire into `/historial/page.tsx`**

Import `HistorialActions` and `getBankrollState`. Add to the top of the page:

```typescript
import { HistorialActions } from "@/components/HistorialActions"
import { getBankrollState } from "@/lib/kelly/bankroll"
```

Change the data fetching:
```typescript
const [realBets, paperBets, bankrollState] = await Promise.all([
  getBets({ mode: "real" }),
  getBets({ mode: "paper" }),
  getBankrollState(),
])
```

Add `HistorialActions` after the KPI cards grid, before the paper trading banner:
```typescript
{/* after the KPI grid */}
<HistorialActions
  pendingBets={realBets.filter(b => b.result === null)}
  currentBankroll={bankrollState.current}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/HistorialActions.tsx src/app/historial/page.tsx
git commit -m "feat: add settle, bankroll adjust, and snapshot controls to /historial"
```

---

## Self-Review

**Spec coverage:**
- `/hoy` — Pipeline Diario, Pre-Match, Limpiar alertas: covered in Task 6
- `/partido/[id]` — Apostar per market, cuota manual input, Pre-match este partido: covered in Tasks 4, 7
- `/historial` — Liquidar apuesta, Ajustar bankroll, Snapshot semanal: covered in Tasks 5, 8
- All 7 Server Actions: covered in Task 3
- ConfirmDialog, ActionButton: Tasks 1, 2
- BetModal, SettleModal: Tasks 4, 5
- Visual style consistency (accent, dark bg, monospace): followed throughout

**Type check:**
- `MarketResult` has `kellyAmount?: number` — used as `activeBetMarket.kellyAmount ?? 500` ✓
- `Bet.id` is optional in the type (`id?: number`) — used as `bet.id!` in SettleModal, and `settleBetAction(bet.id!, result)` ✓
- `settleBetAction` returns `{ ok: boolean; message: string }` — SettleModal expects this ✓
- `registerBet` receives `Omit<Bet, "id">` — BetModal passes all required fields ✓
- `getBankrollState()` returns `BankrollState` with `.current: number` — used in all action pages ✓
- `runPreMatchAction(fixtureId?: number)` — called with and without arg ✓
