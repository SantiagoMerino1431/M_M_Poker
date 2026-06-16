"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { registerBet } from "@/app/actions"
import { kellyStake } from "@/lib/kelly/sizing"

interface Props { fixtureId: number; bankroll: number; confidence: number }

export function CustomBetForm({ fixtureId, bankroll, confidence }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [market, setMarket] = useState("")
  const [selection, setSelection] = useState("")
  const [odds, setOdds] = useState("")
  const [prob, setProb] = useState("")
  const [amount, setAmount] = useState("")
  const [mode, setMode] = useState<"real" | "paper">("real")
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState("")

  const oddsN = parseFloat(odds)
  const probN = prob ? parseFloat(prob) / 100 : (oddsN > 1 ? 1 / oddsN : 0)
  const amtN = parseInt(amount || "0")
  const ev = oddsN > 1 && probN > 0 ? probN * oddsN - 1 : null
  const kelly = ev != null && ev > 0 ? kellyStake({ probability: probN, odds: oddsN, bankroll, confidence }).amount : 0

  const save = () => start(async () => {
    if (!market.trim() || !selection.trim() || !(oddsN > 1) || !(amtN > 0)) {
      setMsg("Completa mercado, selección, cuota y monto")
      return
    }
    const res = await registerBet({
      fixtureId,
      market: market.trim(),
      selection: selection.trim(),
      ourProbability: probN > 0 ? probN : 1 / oddsN,
      bookmakerProbability: 1 / oddsN,
      oddsUsed: oddsN,
      oddsClosing: null,
      amount: amtN,
      kellySuggested: kelly,
      EV: ev ?? 0,
      edge: probN > 0 ? probN - 1 / oddsN : 0,
      result: null,
      profitLoss: null,
      mode,
      confidenceAtTime: confidence,
      createdAt: new Date().toISOString(),
      settledAt: null,
    })
    setMsg(res.message ?? (res.ok ? "Apuesta registrada" : "Rechazada"))
    if (res.ok) { setOpen(false); router.refresh() }
  })

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ background: "transparent", border: "1px dashed var(--border)", color: "var(--text-muted)", padding: "8px 14px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer", width: "100%", marginBottom: 12 }}>
      + Apuesta libre (mercado de tu casa)
    </button>
  )

  const inp: React.CSSProperties = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%" }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", padding: 16, marginBottom: 12 }}>
      <h3 style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Apuesta libre</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 8 }}>
        <input style={inp} placeholder="Mercado (ej: Hándicap -1)" value={market} onChange={e => setMarket(e.target.value)} />
        <input style={inp} placeholder="Selección (ej: Brasil -1)" value={selection} onChange={e => setSelection(e.target.value)} />
        <input style={inp} type="number" step="0.01" placeholder="Cuota" value={odds} onChange={e => setOdds(e.target.value)} />
        <input style={inp} type="number" step="1" placeholder="Tu prob % (opcional)" value={prob} onChange={e => setProb(e.target.value)} />
        <input style={inp} type="number" step="1000" placeholder="Monto COP" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        {(["real", "paper"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", border: "1px solid", borderColor: mode === m ? "var(--accent)" : "var(--border)", background: mode === m ? "rgba(232,255,60,0.12)" : "transparent", color: mode === m ? "var(--accent)" : "var(--text-muted)" }}>{m}</button>
        ))}
        {ev != null && (
          <span style={{ fontSize: 11, color: ev > 0 ? "var(--win)" : "var(--loss)" }}>
            EV {ev > 0 ? "+" : ""}{(ev * 100).toFixed(1)}%{kelly > 0 ? ` · Kelly $${kelly.toLocaleString("es-CO")}` : ""}
          </span>
        )}
        <button onClick={save} disabled={pending} style={{ background: "var(--accent)", border: "none", color: "#000", padding: "8px 18px", fontSize: 12, fontWeight: 700, cursor: pending ? "wait" : "pointer", textTransform: "uppercase" }}>
          {pending ? "Guardando…" : "Registrar"}
        </button>
        <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
      </div>
      {msg && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>{msg}</div>}
    </div>
  )
}
