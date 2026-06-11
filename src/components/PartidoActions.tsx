"use client"
import { useState, useRef, useEffect } from "react"
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
  const oddsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (oddsTimerRef.current) clearTimeout(oddsTimerRef.current) }
  }, [])

  const recommended = markets.filter(m => m.isRecommended)

  const handleSaveOdds = async (m: MarketResult) => {
    const key = `${m.name}|${m.selection}`
    const val = parseFloat(oddsInputs[key] ?? "")
    if (isNaN(val) || val < 1) return
    const res = await updateMarketOddsAction(fixtureId, m.name, m.selection, val)
    setOddsMessages(prev => ({ ...prev, [key]: res.message }))
    oddsTimerRef.current = setTimeout(() => setOddsMessages(prev => {
      const n = { ...prev }
      delete n[key]
      return n
    }), 4000)
    router.refresh()
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <ActionButton
          label="Pre-match este partido"
          pendingLabel="Cargando lineups"
          action={async () => {
            const res = await runPreMatchAction(fixtureId)
            if (res.ok) router.refresh()
            return res
          }}
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
            {m.odds == null && (
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
