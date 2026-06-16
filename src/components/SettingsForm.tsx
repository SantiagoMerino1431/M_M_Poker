"use client"
import { useState } from "react"
import { saveSettingsAction } from "@/app/actions"
import type { AppSettings } from "@/lib/config/settings"

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const [s, setS] = useState<AppSettings>(initial)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function num(key: keyof AppSettings) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setS(p => ({ ...p, [key]: parseFloat(e.target.value) }))
  }

  async function save() {
    setSaving(true)
    const res = await saveSettingsAction(s)
    setMsg(res.message)
    setSaving(false)
  }

  const field = (label: string, key: keyof AppSettings, step: string, hint: string) => (
    <label key={key} style={{ display: "block", marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <input type="number" step={step} value={String(s[key])} onChange={num(key)}
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", fontSize: 15, width: 160 }} />
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{hint}</div>
    </label>
  )

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 24, padding: "14px 16px", background: s.paperOnly ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${s.paperOnly ? "var(--draw)" : "var(--loss)"}` }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={s.paperOnly} onChange={e => setS(p => ({ ...p, paperOnly: e.target.checked }))} />
          <span style={{ fontWeight: 700, color: s.paperOnly ? "var(--draw)" : "var(--loss)" }}>
            {s.paperOnly ? "MODO PAPEL — sin dinero real" : "MODO REAL HABILITADO"}
          </span>
        </label>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
          Con modo papel activo, toda apuesta se registra como paper sin tocar el bankroll real. Recomendado hasta validar el edge con CLV positivo.
        </div>
      </div>
      {field("Fracción de Kelly", "kellyFraction", "0.05", "0.5 = half-Kelly. Menor = más conservador.")}
      {field("Tope por apuesta", "maxStakeFraction", "0.01", "Máximo % del bankroll en una sola apuesta. Default 0.08.")}
      {field("Exposición diaria máx", "dailyExposureFraction", "0.01", "Máximo % comprometido por día. Default 0.15.")}
      {field("Confianza mínima", "minConfidence", "1", "Por debajo de este valor no se recomienda apostar. Default 40.")}
      <button onClick={save} disabled={saving}
        style={{ background: "var(--accent)", border: "none", color: "#000", padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", letterSpacing: "0.06em" }}>
        {saving ? "GUARDANDO…" : "GUARDAR"}
      </button>
      {msg && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>{msg}</p>}
    </div>
  )
}
