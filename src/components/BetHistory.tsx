"use client"

import { useState } from "react"
import { BetTable } from "@/components/BetTable"
import type { Bet } from "@/lib/types"

export function BetHistory({ bets, bankroll }: { bets: Bet[]; bankroll: number }) {
  const [modeFilter, setModeFilter] = useState<"all" | "real" | "paper">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "settled">("all")

  const filtered = bets.filter(b => {
    if (modeFilter !== "all" && b.mode !== modeFilter) return false
    if (statusFilter === "open" && b.result !== null) return false
    if (statusFilter === "settled" && b.result === null) return false
    return true
  })

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const,
    cursor: "pointer", border: "1px solid", letterSpacing: "0.06em",
    borderColor: active ? "var(--accent)" : "var(--border)",
    background: active ? "rgba(232,255,60,0.10)" : "transparent",
    color: active ? "var(--accent)" : "var(--text-muted)",
  })

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {(["all", "real", "paper"] as const).map(v => (
          <button key={v} style={btnStyle(modeFilter === v)} onClick={() => setModeFilter(v)}>
            {v === "all" ? "Todos" : v}
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px", display: "inline-block" }} />
        {(["all", "open", "settled"] as const).map(v => (
          <button key={v} style={btnStyle(statusFilter === v)} onClick={() => setStatusFilter(v)}>
            {v === "all" ? "Todos" : v === "open" ? "Pendientes" : "Liquidadas"}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
          {filtered.length} apuesta{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>
      <BetTable bets={filtered} bankroll={bankroll} />
    </div>
  )
}
