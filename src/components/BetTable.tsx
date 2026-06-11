"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { settleBetAction } from "@/app/actions"
import type { Bet } from "@/lib/types"

interface Props {
  bets: Bet[]
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
  const [editing, setEditing] = useState<Set<number>>(new Set())

  function toggleEdit(id: number) {
    setEditing(prev => {
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

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "52px 48px 1fr 70px 90px 60px 1fr",
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
        <span>Resultado</span>
      </div>

      {bets.map(bet => {
        const isPending = bet.result === null
        const borderColor = bet.result === "win" ? "var(--win)"
          : bet.result === "loss" ? "var(--loss)"
          : isPending ? "var(--draw)"
          : "var(--border)"

        return (
          <div key={`${bet.mode}-${bet.id}`} style={{
            display: "grid",
            gridTemplateColumns: "52px 48px 1fr 70px 90px 60px 1fr",
            gap: 10, padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
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

            <div>
              {isPending || editing.has(bet.id!) ? (
                <SettleRow
                  bet={bet}
                  onSettled={() => { setEditing(prev => { const n = new Set(prev); n.delete(bet.id!); return n }); router.refresh() }}
                />
              ) : (
                <ResultBadge bet={bet} onEdit={bet.result !== null ? () => toggleEdit(bet.id!) : undefined} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
