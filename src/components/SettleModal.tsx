"use client"
import { useState, useTransition, useRef, useEffect } from "react"
import type { CSSProperties } from "react"
import type { Bet } from "@/lib/types"
import { settleBetAction } from "@/app/actions"

interface Props {
  bet: Bet
  onClose: (settled: boolean) => void
}

export function SettleModal({ bet, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const settle = (result: "win" | "loss" | "void") => {
    startTransition(async () => {
      const res = await settleBetAction(bet.id!, result)
      setMessage(res.message)
      if (res.ok) {
        timerRef.current = setTimeout(() => onClose(true), 1500)
      }
    })
  }

  const btnBase: CSSProperties = {
    flex: 1, padding: "10px", fontFamily: "inherit", fontSize: 12,
    textTransform: "uppercase", letterSpacing: "0.08em",
    cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div role="dialog" aria-modal="true" style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 24, maxWidth: 400, width: "90%", display: "flex", flexDirection: "column", gap: 16 }}>
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
          <button onClick={() => onClose(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
