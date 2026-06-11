"use client"

import { useState } from "react"
import { updateMarketOddsAction } from "@/app/actions"
import type { MarketResult } from "@/lib/types"

interface Props {
  fixtureId: number
  title: string
  markets: MarketResult[]
  bankroll: number
  confidence: number
}

function confMultiplier(c: number) {
  if (c >= 80) return 1.0
  if (c >= 60) return 0.75
  if (c >= 40) return 0.5
  return 0
}

function labelFor(name: string, selection: string): string {
  if (name === "1X2") {
    if (selection === "home") return "Local gana (1)"
    if (selection === "draw") return "Empate (X)"
    if (selection === "away") return "Visitante gana (2)"
  }
  if (name === "Over/Under") return selection.replace("over_", "Más de ").replace("under_", "Menos de ").replace("_", ".")
  if (name === "BTTS") return selection === "yes" ? "Ambos anotan — Sí" : "Ambos anotan — No"
  if (name === "Marcador Exacto") return `Exacto ${selection}`
  return `${name} ${selection}`
}

export function MarketBettingCard({ fixtureId, title, markets, bankroll, confidence }: Props) {
  const [oddsMap, setOddsMap] = useState<Record<string, string>>(
    Object.fromEntries(
      markets.map(m => [`${m.name}|${m.selection}`, m.odds != null ? String(m.odds) : ""])
    )
  )
  const [saving, setSaving] = useState<string | null>(null)

  function calcEV(prob: number, odds: number) { return prob * odds - 1 }
  function calcKelly(prob: number, odds: number, ev: number) {
    if (ev <= 0 || odds <= 1) return 0
    const kelly = ev / (odds - 1)
    return bankroll * kelly * 0.25 * confMultiplier(confidence)
  }

  async function handleBlur(market: string, selection: string, value: string) {
    const key = `${market}|${selection}`
    const odds = parseFloat(value)
    setSaving(key)
    await updateMarketOddsAction(fixtureId, market, selection, isNaN(odds) || odds <= 1 ? 0 : odds)
    setSaving(null)
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px", marginBottom: 12 }}>
      <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
        {title}
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 88px 120px 80px 80px", gap: 8, marginBottom: 8 }}>
        {["Mercado", "Prob", "C. justa", "Mi cuota", "EV", "Kelly"].map(h => (
          <div key={h} style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
        ))}
      </div>

      {markets.map(m => {
        const key = `${m.name}|${m.selection}`
        const raw = oddsMap[key] ?? ""
        const odds = parseFloat(raw)
        const fairOdds = (1 / m.ourProbability).toFixed(2)
        const ev = !isNaN(odds) && odds > 1 ? calcEV(m.ourProbability, odds) : null
        const kelly = ev !== null && ev > 0 ? calcKelly(m.ourProbability, odds, ev) : null
        const isSaving = saving === key

        const evColor = ev === null ? "var(--text-muted)"
          : ev >= 0.05 ? "var(--win)"
          : ev > 0 ? "var(--draw)"
          : "var(--loss)"

        const borderColor = ev === null ? "var(--border)"
          : ev >= 0.05 ? "var(--win)"
          : ev > 0 ? "var(--draw)"
          : "var(--border)"

        return (
          <div key={key} style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 88px 120px 80px 80px",
            gap: 8,
            alignItems: "center",
            padding: "10px 0",
            borderBottom: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{labelFor(m.name, m.selection)}</div>

            <div className="stat-number" style={{ fontSize: 17 }}>
              {(m.ourProbability * 100).toFixed(1)}%
            </div>

            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              ≥ {fairOdds}
            </div>

            <input
              type="number"
              step="0.01"
              min="1.01"
              value={raw}
              placeholder="1.00"
              onChange={e => setOddsMap(p => ({ ...p, [key]: e.target.value }))}
              onBlur={e => handleBlur(m.name, m.selection, e.target.value)}
              style={{
                background: "var(--surface-2)",
                border: `1px solid ${borderColor}`,
                color: "var(--text)",
                padding: "6px 10px",
                fontSize: 14,
                fontFamily: "var(--font-mono, monospace)",
                width: "100%",
                outline: "none",
                opacity: isSaving ? 0.5 : 1,
              }}
            />

            <div className="stat-number" style={{ fontSize: 15, color: evColor }}>
              {ev === null ? "--"
                : ev > 0 ? `+${(ev * 100).toFixed(1)}%`
                : `${(ev * 100).toFixed(1)}%`}
            </div>

            <div className="stat-number" style={{ fontSize: 15, color: kelly ? "var(--accent)" : "var(--text-muted)" }}>
              {kelly ? `$${Math.round(kelly).toLocaleString("es-CO")}` : "--"}
            </div>
          </div>
        )
      })}

      <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
        C. justa = mínimo para EV &gt; 0 · Kelly al 25% · confianza {confidence}
      </div>
    </div>
  )
}
