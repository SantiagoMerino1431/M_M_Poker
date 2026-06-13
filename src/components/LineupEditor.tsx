"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { saveManualLineupAction } from "@/app/actions"

interface Props {
  fixtureId: number
  homeName: string
  awayName: string
  initial?: { homeMissing: string[]; awayMissing: string[]; homeConfirmed: boolean; awayConfirmed: boolean }
}

export function LineupEditor({ fixtureId, homeName, awayName, initial }: Props) {
  const router = useRouter()
  const [homeMissing, setHomeMissing] = useState((initial?.homeMissing ?? []).join(", "))
  const [awayMissing, setAwayMissing] = useState((initial?.awayMissing ?? []).join(", "))
  const [homeConfirmed, setHomeConfirmed] = useState(initial?.homeConfirmed ?? false)
  const [awayConfirmed, setAwayConfirmed] = useState(initial?.awayConfirmed ?? false)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState("")

  const parse = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean)

  const save = () => start(async () => {
    const res = await saveManualLineupAction(fixtureId, parse(homeMissing), parse(awayMissing), homeConfirmed, awayConfirmed)
    setMsg(res.message)
    if (res.ok) router.refresh()
  })

  const col = (label: string, val: string, set: (v: string) => void, conf: boolean, setConf: (b: boolean) => void) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <textarea value={val} onChange={e => set(e.target.value)} placeholder="Bajas (nombres separados por coma)"
        style={{ width: "100%", minHeight: 56, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", padding: 8, fontFamily: "inherit", fontSize: 12 }} />
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
        <input type="checkbox" checked={conf} onChange={e => setConf(e.target.checked)} /> Lineup confirmado
      </label>
    </div>
  )

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20, marginBottom: 12 }}>
      <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
        Lineup y lesiones (manual)
      </h3>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {col(homeName, homeMissing, setHomeMissing, homeConfirmed, setHomeConfirmed)}
        {col(awayName, awayMissing, setAwayMissing, awayConfirmed, setAwayConfirmed)}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
        <button onClick={save} disabled={pending}
          style={{ background: "var(--accent)", border: "none", color: "#000", padding: "8px 18px", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", cursor: pending ? "wait" : "pointer", textTransform: "uppercase" }}>
          {pending ? "Guardando…" : "Guardar lineup"}
        </button>
        {msg && <span style={{ fontSize: 11, color: "var(--win)" }}>{msg}</span>}
      </div>
    </div>
  )
}
