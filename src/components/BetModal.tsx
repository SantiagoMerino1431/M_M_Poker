"use client"
import { useState, useTransition, useRef, useEffect } from "react"
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const handleConfirm = () => {
    startTransition(async () => {
      await registerBet({
        fixtureId,
        market: market.name,
        selection: market.selection,
        ourProbability: market.ourProbability,
        bookmakerProbability: market.bookmakerProbability,
        oddsUsed: market.odds ?? 0,
        oddsClosing: null,
        amount,
        kellySuggested: market.kellyFraction ?? 0,
        EV: market.EV ?? 0,
        edge: market.edge ?? 0,
        result: null,
        profitLoss: null,
        mode,
        confidenceAtTime: 0,
        createdAt: new Date().toISOString(),
        settledAt: null,
      })
      setMessage(`Apuesta registrada — $${amount.toLocaleString("es-CO")} COP`)
      timerRef.current = setTimeout(() => onClose(true), 1500)
    })
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div role="dialog" aria-modal="true" style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 24, maxWidth: 400, width: "90%", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Registrar apuesta</div>
          <div style={{ fontSize: 16, fontWeight: 700, textTransform: "uppercase" }}>{market.name}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{market.selection}{market.bookmaker ? ` · ${market.bookmaker}` : ""}</div>
          {market.odds != null && (
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
            style={{ width: "100%", background: "var(--surface-2, #111)", border: "1px solid var(--border)", color: "inherit", padding: "8px 10px", fontFamily: "inherit", fontSize: 16, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {(["paper", "real"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: "6px", fontFamily: "inherit", fontSize: 11,
                textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer",
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
          <button onClick={() => onClose(false)} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", padding: "8px 16px", fontFamily: "inherit", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
