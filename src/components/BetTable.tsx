"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { settleBetAction, deleteBetAction, updateBetAction } from "@/app/actions"
import type { Bet } from "@/lib/types"

interface Props {
  bets: Bet[]
  bankroll?: number
}

const ghostBtn: React.CSSProperties = {
  background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)",
  padding: "3px 8px", fontSize: 11, cursor: "pointer", lineHeight: 1,
}

function ResultBadge({ bet, onEdit }: { bet: Bet; onEdit?: () => void }) {
  let label: React.ReactNode = null
  if (bet.result === "win") {
    label = <span className="stat-number" style={{ fontSize: 15, color: "var(--win)" }}>+${(bet.profitLoss ?? 0).toLocaleString("es-CO")}</span>
  } else if (bet.result === "loss") {
    label = <span className="stat-number" style={{ fontSize: 15, color: "var(--loss)" }}>-${bet.amount.toLocaleString("es-CO")}</span>
  } else if (bet.result === "void") {
    label = <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>VOID</span>
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {label}
      {onEdit && (
        <button onClick={onEdit} title="Editar resultado" style={{
          background: "transparent", border: "none", color: "var(--text-muted)",
          cursor: "pointer", fontSize: 11, padding: "2px 4px", lineHeight: 1,
          opacity: 0.5,
        }}>
          ✎
        </button>
      )}
    </div>
  )
}

function SettleRow({ bet, onSettled }: { bet: Bet; onSettled: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<"win" | "loss" | "void" | null>(null)

  function settle(result: "win" | "loss" | "void") {
    startTransition(async () => {
      const res = await settleBetAction(bet.id!, result)
      if (res.ok) { setDone(result); onSettled() }
    })
  }

  if (done) return <ResultBadge bet={{ ...bet, result: done }} />

  return (
    <div style={{ display: "flex", gap: 4 }}>
      <button
        onClick={() => settle("win")}
        disabled={isPending}
        style={{
          background: "rgba(34,197,94,0.1)", border: "1px solid var(--win)",
          color: "var(--win)", padding: "4px 10px", cursor: isPending ? "wait" : "pointer",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
        }}
      >
        WIN
      </button>
      <button
        onClick={() => settle("loss")}
        disabled={isPending}
        style={{
          background: "rgba(239,68,68,0.1)", border: "1px solid var(--loss)",
          color: "var(--loss)", padding: "4px 10px", cursor: isPending ? "wait" : "pointer",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
        }}
      >
        LOSS
      </button>
      <button
        onClick={() => settle("void")}
        disabled={isPending}
        style={{
          background: "transparent", border: "1px solid var(--border)",
          color: "var(--text-muted)", padding: "4px 8px", cursor: isPending ? "wait" : "pointer",
          fontSize: 10,
        }}
      >
        VOID
      </button>
    </div>
  )
}

export function BetTable({ bets }: Props) {
  const router = useRouter()
  const [settleEditing, setSettleEditing] = useState<Set<number>>(new Set())
  const [inlineEditing, setInlineEditing] = useState<Set<number>>(new Set())
  const [, start] = useTransition()

  function toggleSettleEdit(id: number) {
    setSettleEditing(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleInlineEdit(id: number) {
    setInlineEditing(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (bets.length === 0) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        Sin apuestas registradas aún. Ve a un partido y registra tu primera apuesta.
      </div>
    )
  }

  // gridTemplateColumns: modo | fix | mercado | cuota | monto | EV | CLV | resultado | acciones
  const cols = "52px 48px 1fr 70px 90px 60px 60px 1fr 80px"

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: cols,
        gap: 10, padding: "8px 16px",
        borderBottom: "1px solid var(--border)",
        fontSize: 10, color: "var(--text-muted)",
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>
        <span>Modo</span>
        <span>Fix.</span>
        <span>Mercado</span>
        <span>Cuota</span>
        <span>Monto</span>
        <span>EV</span>
        <span>CLV</span>
        <span>Resultado</span>
        <span>Acc.</span>
      </div>

      {bets.map(bet => {
        const isPending = bet.result === null
        const borderColor = bet.result === "win" ? "var(--win)"
          : bet.result === "loss" ? "var(--loss)"
          : isPending ? "var(--draw)"
          : "var(--border)"

        const clvValue = bet.oddsClosing != null ? (bet.oddsUsed / bet.oddsClosing - 1) : null
        const clvColor = clvValue == null ? "var(--text-muted)" : clvValue >= 0 ? "var(--win)" : "var(--loss)"

        return (
          <div key={`${bet.mode}-${bet.id}`}>
            {/* Main row */}
            <div style={{
              display: "grid",
              gridTemplateColumns: cols,
              gap: 10, padding: "10px 16px",
              borderBottom: inlineEditing.has(bet.id!) ? "none" : "1px solid var(--border)",
              borderLeft: `3px solid ${borderColor}`,
              alignItems: "center",
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                color: bet.mode === "paper" ? "var(--draw)" : "var(--text-muted)",
              }}>
                {bet.mode === "paper" ? "PAPER" : "REAL"}
              </span>

              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>#{bet.fixtureId}</span>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{bet.market}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{bet.selection}</div>
              </div>

              <span className="stat-number" style={{ fontSize: 16 }}>{bet.oddsUsed}</span>

              <div>
                <div className="stat-number" style={{ fontSize: 16 }}>${bet.amount.toLocaleString("es-CO")}</div>
                {bet.mode === "paper" && (
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>simulado</div>
                )}
              </div>

              <span style={{ fontSize: 12, color: bet.EV >= 0.03 ? "var(--win)" : "var(--text-muted)" }}>
                {bet.EV >= 0 ? "+" : ""}{(bet.EV * 100).toFixed(1)}%
              </span>

              {/* CLV */}
              <span style={{ fontSize: 12, color: clvColor }}>
                {clvValue == null ? "—" : `${(clvValue * 100).toFixed(1)}%`}
              </span>

              <div>
                {isPending || settleEditing.has(bet.id!) ? (
                  <SettleRow
                    bet={bet}
                    onSettled={() => {
                      setSettleEditing(prev => { const n = new Set(prev); n.delete(bet.id!); return n })
                      router.refresh()
                    }}
                  />
                ) : (
                  <ResultBadge bet={bet} onEdit={bet.result !== null ? () => toggleSettleEdit(bet.id!) : undefined} />
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => toggleInlineEdit(bet.id!)} title="Editar" style={ghostBtn}>✎</button>
                <button
                  title="Eliminar"
                  style={{ ...ghostBtn, color: "var(--loss)" }}
                  onClick={() => {
                    if (!confirm("¿Eliminar esta apuesta?")) return
                    start(async () => { await deleteBetAction(bet.id!); router.refresh() })
                  }}
                >✕</button>
              </div>
            </div>

            {/* Inline edit row */}
            {inlineEditing.has(bet.id!) && (
              <div style={{
                gridColumn: "1 / -1", display: "flex", gap: 8, padding: "8px 16px",
                alignItems: "center", borderBottom: "1px solid var(--border)",
                borderLeft: `3px solid ${borderColor}`,
                background: "rgba(255,255,255,0.02)",
              }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 60 }}>Monto:</span>
                <input
                  type="number"
                  defaultValue={bet.amount}
                  step="1000"
                  id={`amt-${bet.id}`}
                  style={{ width: 100, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", padding: "4px 8px", fontSize: 12 }}
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 42 }}>Cuota:</span>
                <input
                  type="number"
                  defaultValue={bet.oddsUsed}
                  step="0.01"
                  id={`odd-${bet.id}`}
                  style={{ width: 72, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", padding: "4px 8px", fontSize: 12 }}
                />
                <button
                  style={{ background: "var(--accent)", border: "none", color: "#000", padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  onClick={() => start(async () => {
                    const amount = Number((document.getElementById(`amt-${bet.id}`) as HTMLInputElement).value)
                    const oddsUsed = Number((document.getElementById(`odd-${bet.id}`) as HTMLInputElement).value)
                    await updateBetAction(bet.id!, { amount, oddsUsed })
                    toggleInlineEdit(bet.id!)
                    router.refresh()
                  })}
                >Guardar</button>
                <button onClick={() => toggleInlineEdit(bet.id!)} style={ghostBtn}>Cancelar</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
