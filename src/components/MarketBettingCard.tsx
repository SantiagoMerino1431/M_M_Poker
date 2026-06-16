"use client"

import { useState } from "react"
import { updateMarketOddsAction, registerBet } from "@/app/actions"
import { useUser } from "./UserContext"
import { kellyStake } from "@/lib/kelly/sizing"
import { selectionLabel } from "@/lib/engine/market-labels"
import type { MarketResult } from "@/lib/types"
import { OddsHistorySparkline } from "./OddsHistorySparkline"

interface OddsPoint { odds: number; recordedAt: string }

interface Props {
  fixtureId: number
  title: string
  markets: MarketResult[]
  bankroll: number
  confidence: number
  homeName?: string
  awayName?: string
  exposureRemaining?: number
  oddsHistory?: Record<string, OddsPoint[]>
}

export function MarketBettingCard({
  fixtureId,
  title,
  markets,
  bankroll,
  confidence,
  homeName = "Local",
  awayName = "Visitante",
  exposureRemaining = Infinity,
  oddsHistory,
}: Props) {
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

  function calcKellyAmount(prob: number, odds: number): number | null {
    if (odds <= 1) return null
    const res = kellyStake({ probability: prob, odds, bankroll, confidence })
    return res.amount > 0 ? res.amount : null
  }

  async function handleBlur(market: string, selection: string, value: string) {
    const key = `${market}|${selection}`
    const odds = parseFloat(value)
    setSaving(key)
    await updateMarketOddsAction(fixtureId, market, selection, isNaN(odds) || odds <= 1 ? 0 : odds)
    setSaving(null)
  }

  function openRegister(key: string, kelly: number | null, fairOdds: string, currentOddsRaw: string, prob: number) {
    // If no odds entered, prefill with fair odds
    if (!currentOddsRaw || parseFloat(currentOddsRaw) <= 1) {
      const fair = (1 / prob).toFixed(2)
      setOddsMap(p => ({ ...p, [key]: fair }))
    }
    setRegistering(key)
    setAmountMap(p => ({ ...p, [key]: kelly ? String(Math.round(kelly)) : "" }))
    setModeMap(p => ({ ...p, [key]: "real" }))
  }

  async function handleConfirmBet(m: MarketResult, key: string, odds: number, ev: number) {
    const amount = parseInt(amountMap[key] ?? "0")
    if (!amount || amount <= 0) return
    const mode = modeMap[key] ?? "real"
    setConfirming(key)
    const kellyAmt = calcKellyAmount(m.ourProbability, odds)
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
      kellySuggested: kellyAmt ?? 0,
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

      <div className="table-scroll">
      <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, marginBottom: 8, minWidth: 560 }}>
        {HEADERS.map((h, i) => (
          <div key={i} style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
        ))}
      </div>

      {markets.map(m => {
        const key = `${m.name}|${m.selection}`
        const raw = oddsMap[key] ?? ""
        const odds = parseFloat(raw)
        const fairOdds = (1 / m.ourProbability).toFixed(2)
        const hasOdds = !isNaN(odds) && odds > 1
        const ev = hasOdds ? calcEV(m.ourProbability, odds) : null
        const kelly = hasOdds ? calcKellyAmount(m.ourProbability, odds) : null
        const isSaving = saving === key
        const isRegistering = registering === key
        const isConfirming = confirming === key
        const registeredMode = registered.get(key)
        const wasRegistered = registeredMode != null
        const betMode = modeMap[key] ?? "real"

        // When registering, re-read odds from map (may have been prefilled)
        const activeOdds = isRegistering ? parseFloat(oddsMap[key] ?? "") : odds
        const activeEv = !isNaN(activeOdds) && activeOdds > 1 ? calcEV(m.ourProbability, activeOdds) : null
        const activeKelly = !isNaN(activeOdds) && activeOdds > 1 ? calcKellyAmount(m.ourProbability, activeOdds) : null

        const evColor = ev === null ? "var(--text-muted)"
          : ev >= 0.05 ? "var(--win)"
          : ev > 0 ? "var(--draw)"
          : "var(--loss)"

        const borderColor = ev === null ? "var(--border)"
          : ev >= 0.05 ? "var(--win)"
          : ev > 0 ? "var(--draw)"
          : "var(--border)"

        const betAmount = parseInt(amountMap[key] || "0") || 0
        const exposureExceeded = isFinite(exposureRemaining) && betAmount > exposureRemaining

        return (
          <div key={key} style={{ borderBottom: "1px solid var(--border)" }}>
            <div style={{
              display: "grid", gridTemplateColumns: COLS, gap: 8,
              alignItems: "center", padding: "10px 0",
              minWidth: 560,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {selectionLabel(m.name, m.selection, homeName, awayName)}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  modelo {(m.modelProbability * 100).toFixed(0)}%
                  {m.marketProbability != null && <> · mercado {(m.marketProbability * 100).toFixed(0)}%</>}
                  {" "}· mezcla {(m.ourProbability * 100).toFixed(0)}%
                </div>
                {oddsHistory?.[m.selection] && oddsHistory[m.selection].length >= 2 && (
                  <div style={{ marginTop: 4, opacity: 0.7 }}>
                    <OddsHistorySparkline points={oddsHistory[m.selection]} />
                  </div>
                )}
              </div>

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
                    {registeredMode === "paper" ? "PAPER" : "REAL"}
                  </span>
                ) : isRegistering ? (
                  <button
                    onClick={() => setRegistering(null)}
                    style={{
                      background: "transparent", border: "1px solid var(--border)",
                      color: "var(--text-muted)", padding: "5px 10px", fontSize: 11,
                      cursor: "pointer", width: "100%",
                    }}
                  >
                    X
                  </button>
                ) : (
                  <button
                    onClick={() => openRegister(key, kelly, fairOdds, raw, m.ourProbability)}
                    style={{
                      background: "transparent", border: "1px solid var(--accent)",
                      color: "var(--accent)", padding: "5px 10px", fontSize: 11,
                      fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer",
                      textTransform: "uppercase", width: "100%",
                    }}
                  >
                    APOSTAR
                  </button>
                )}
              </div>
            </div>

            {isRegistering && (
              <div style={{
                padding: "14px 0 16px",
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                <div style={{ display: "flex", gap: 0 }}>
                  {(["real", "paper"] as const).map(mode => (
                    <button key={mode} onClick={() => setModeMap(p => ({ ...p, [key]: mode }))} style={{
                      padding: "6px 14px", fontSize: 11, fontWeight: 700,
                      letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
                      border: "1px solid",
                      borderColor: betMode === mode ? (mode === "paper" ? "var(--draw)" : "var(--accent)") : "var(--border)",
                      background: betMode === mode ? (mode === "paper" ? "rgba(234,179,8,0.15)" : "rgba(232,255,60,0.12)") : "transparent",
                      color: betMode === mode ? (mode === "paper" ? "var(--draw)" : "var(--accent)") : "var(--text-muted)",
                    }}>{mode}</button>
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
                {activeKelly && (
                  <button
                    onClick={() => setAmountMap(p => ({ ...p, [key]: String(Math.round(activeKelly)) }))}
                    style={{
                      background: "transparent", border: "none",
                      color: "var(--text-muted)", fontSize: 11, cursor: "pointer",
                      textDecoration: "underline", padding: 0,
                    }}
                  >
                    Kelly: ${Math.round(activeKelly).toLocaleString("es-CO")}
                  </button>
                )}
                <button
                  onClick={() => {
                    const currentOdds = parseFloat(oddsMap[key] ?? "")
                    const currentEv = !isNaN(currentOdds) && currentOdds > 1 ? calcEV(m.ourProbability, currentOdds) : 0
                    void handleConfirmBet(m, key, currentOdds, currentEv)
                  }}
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
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {activeEv !== null && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      cuota {parseFloat(oddsMap[key] ?? "0").toFixed(2)} · EV {activeEv > 0 ? "+" : ""}{(activeEv * 100).toFixed(1)}% · ganancia potencial ${Math.round((parseFloat(oddsMap[key] ?? "1") - 1) * betAmount).toLocaleString("es-CO")}
                    </span>
                  )}
                  {isFinite(exposureRemaining) && (
                    <span style={{ fontSize: 11, color: exposureExceeded ? "var(--loss)" : "var(--text-muted)" }}>
                      exposición restante hoy: ${Math.round(exposureRemaining).toLocaleString("es-CO")}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
      </div>{/* end table-scroll */}

      <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
        C. justa = mínimo para EV &gt; 0 · Kelly al 50% (half-Kelly), tope 8% · confianza {confidence}
      </div>
    </div>
  )
}
