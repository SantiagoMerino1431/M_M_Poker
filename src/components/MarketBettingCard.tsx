"use client"

import { useState } from "react"
import { updateMarketOddsAction, registerBet } from "@/app/actions"
import { useUser } from "./UserContext"
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
  const { user } = useUser()
  const [oddsMap, setOddsMap] = useState<Record<string, string>>(
    Object.fromEntries(
      markets.map(m => [`${m.name}|${m.selection}`, m.odds != null ? String(m.odds) : ""])
    )
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [registering, setRegistering] = useState<string | null>(null)
  const [amountMap, setAmountMap] = useState<Record<string, string>>({})
  const [modeMap, setModeMap] = useState<Record<string, "real" | "paper">>({})
  const [confirming, setConfirming] = useState<string | null>(null)
  const [registered, setRegistered] = useState<Map<string, "real" | "paper">>(new Map())

  function calcEV(prob: number, odds: number) { return prob * odds - 1 }
  function calcKelly(prob: number, odds: number, ev: number) {
    if (ev <= 0 || odds <= 1) return 0
    return bankroll * (ev / (odds - 1)) * 0.25 * confMultiplier(confidence)
  }

  async function handleBlur(market: string, selection: string, value: string) {
    const key = `${market}|${selection}`
    const odds = parseFloat(value)
    setSaving(key)
    await updateMarketOddsAction(fixtureId, market, selection, isNaN(odds) || odds <= 1 ? 0 : odds)
    setSaving(null)
  }

  function openRegister(key: string, kellyAmount: number | null) {
    setRegistering(key)
    setAmountMap(p => ({ ...p, [key]: kellyAmount ? String(Math.round(kellyAmount)) : "" }))
    setModeMap(p => ({ ...p, [key]: "real" }))
  }

  async function handleConfirmBet(m: MarketResult, key: string, odds: number, ev: number) {
    const amount = parseInt(amountMap[key] ?? "0")
    if (!amount || amount <= 0) return
    const mode = modeMap[key] ?? "real"
    setConfirming(key)
    const res = await registerBet({
      fixtureId,
      userId: user?.id,
      market: m.name,
      selection: m.selection,
      ourProbability: m.ourProbability,
      bookmakerProbability: 1 / odds,
      oddsUsed: odds,
      oddsClosing: null,
      amount,
      kellySuggested: calcKelly(m.ourProbability, odds, ev),
      EV: ev,
      edge: m.ourProbability - 1 / odds,
      result: null,
      profitLoss: null,
      mode,
      confidenceAtTime: confidence,
      createdAt: new Date().toISOString(),
      settledAt: null,
    })
    setConfirming(null)
    if (!res.ok) { alert(res.message ?? "Apuesta rechazada por control de riesgo"); return }
    setRegistering(null)
    setRegistered(prev => new Map(prev).set(key, mode))
  }

  const COLS = "1fr 80px 88px 120px 80px 80px 90px"
  const HEADERS = ["Mercado", "Prob", "C. justa", "Mi cuota", "EV", "Kelly", ""]

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px", marginBottom: 12 }}>
      <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
        {title}
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, marginBottom: 8 }}>
        {HEADERS.map((h, i) => (
          <div key={i} style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
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
        const isRegistering = registering === key
        const isConfirming = confirming === key
        const registeredMode = registered.get(key)
        const wasRegistered = registeredMode != null
        const betMode = modeMap[key] ?? "real"
        const hasOdds = !isNaN(odds) && odds > 1

        const evColor = ev === null ? "var(--text-muted)"
          : ev >= 0.05 ? "var(--win)"
          : ev > 0 ? "var(--draw)"
          : "var(--loss)"

        const borderColor = ev === null ? "var(--border)"
          : ev >= 0.05 ? "var(--win)"
          : ev > 0 ? "var(--draw)"
          : "var(--border)"

        return (
          <div key={key} style={{ borderBottom: "1px solid var(--border)" }}>
            <div style={{
              display: "grid", gridTemplateColumns: COLS, gap: 8,
              alignItems: "center", padding: "10px 0",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{labelFor(m.name, m.selection)}</div>

              <div className="stat-number" style={{ fontSize: 17 }}>
                {(m.ourProbability * 100).toFixed(1)}%
              </div>

              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>≥ {fairOdds}</div>

              <input
                type="number" step="0.01" min="1.01"
                value={raw} placeholder="1.00"
                onChange={e => setOddsMap(p => ({ ...p, [key]: e.target.value }))}
                onBlur={e => handleBlur(m.name, m.selection, e.target.value)}
                style={{
                  background: "var(--surface-2)", border: `1px solid ${borderColor}`,
                  color: "var(--text)", padding: "6px 10px", fontSize: 14,
                  fontFamily: "var(--font-mono, monospace)", width: "100%",
                  outline: "none", opacity: isSaving ? 0.5 : 1,
                }}
              />

              <div className="stat-number" style={{ fontSize: 15, color: evColor }}>
                {ev === null ? "--" : ev > 0 ? `+${(ev * 100).toFixed(1)}%` : `${(ev * 100).toFixed(1)}%`}
              </div>

              <div className="stat-number" style={{ fontSize: 15, color: kelly ? "var(--accent)" : "var(--text-muted)" }}>
                {kelly ? `$${Math.round(kelly).toLocaleString("es-CO")}` : "--"}
              </div>

              <div>
                {wasRegistered ? (
                  <span style={{ fontSize: 11, color: registeredMode === "paper" ? "var(--draw)" : "var(--win)", fontWeight: 700 }}>
                    ✓ {registeredMode === "paper" ? "PAPER" : "REAL"}
                  </span>
                ) : hasOdds && !isRegistering ? (
                  <button
                    onClick={() => openRegister(key, kelly)}
                    style={{
                      background: "transparent", border: "1px solid var(--accent)",
                      color: "var(--accent)", padding: "5px 10px", fontSize: 11,
                      fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer",
                      textTransform: "uppercase", width: "100%",
                    }}
                  >
                    APOSTAR
                  </button>
                ) : isRegistering ? (
                  <button
                    onClick={() => setRegistering(null)}
                    style={{
                      background: "transparent", border: "1px solid var(--border)",
                      color: "var(--text-muted)", padding: "5px 10px", fontSize: 11,
                      cursor: "pointer", width: "100%",
                    }}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>

            {isRegistering && ev !== null && (
              <div style={{
                padding: "14px 0 16px",
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                <div style={{ display: "flex", gap: 0 }}>
                  {(["real", "paper"] as const).map(m => (
                    <button key={m} onClick={() => setModeMap(p => ({ ...p, [key]: m }))} style={{
                      padding: "6px 14px", fontSize: 11, fontWeight: 700,
                      letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
                      border: "1px solid",
                      borderColor: betMode === m ? (m === "paper" ? "var(--draw)" : "var(--accent)") : "var(--border)",
                      background: betMode === m ? (m === "paper" ? "rgba(234,179,8,0.15)" : "rgba(232,255,60,0.12)") : "transparent",
                      color: betMode === m ? (m === "paper" ? "var(--draw)" : "var(--accent)") : "var(--text-muted)",
                    }}>{m}</button>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  Monto a apostar (COP)
                </span>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={amountMap[key] ?? ""}
                  placeholder="Ej: 5000"
                  onChange={e => setAmountMap(p => ({ ...p, [key]: e.target.value }))}
                  autoFocus
                  style={{
                    background: "var(--surface-2)", border: "1px solid var(--accent)",
                    color: "var(--text)", padding: "8px 12px", fontSize: 15,
                    fontFamily: "var(--font-mono, monospace)", width: 160,
                    outline: "none",
                  }}
                />
                {kelly && (
                  <button
                    onClick={() => setAmountMap(p => ({ ...p, [key]: String(Math.round(kelly)) }))}
                    style={{
                      background: "transparent", border: "none",
                      color: "var(--text-muted)", fontSize: 11, cursor: "pointer",
                      textDecoration: "underline", padding: 0,
                    }}
                  >
                    Kelly: ${Math.round(kelly).toLocaleString("es-CO")}
                  </button>
                )}
                <button
                  onClick={() => handleConfirmBet(m, key, odds, ev)}
                  disabled={isConfirming || !amountMap[key]}
                  style={{
                    background: "var(--accent)", border: "none",
                    color: "#000", padding: "8px 20px", fontSize: 13,
                    fontWeight: 700, cursor: isConfirming ? "wait" : "pointer",
                    letterSpacing: "0.06em", opacity: isConfirming ? 0.6 : 1,
                  }}
                >
                  {isConfirming ? "GUARDANDO..." : "CONFIRMAR"}
                </button>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  cuota {odds.toFixed(2)} · EV {ev > 0 ? "+" : ""}{(ev * 100).toFixed(1)}% · ganancia potencial ${Math.round((odds - 1) * parseInt(amountMap[key] || "0")).toLocaleString("es-CO")}
                </span>
              </div>
            )}
          </div>
        )
      })}

      <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
        C. justa = mínimo para EV &gt; 0 · Kelly al 25% · confianza {confidence}
      </div>
    </div>
  )
}
