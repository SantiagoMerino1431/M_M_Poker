"use client"
import { useState } from "react"
import type { ReactNode } from "react"

export interface HoyRow {
  fixtureId: number
  confidence: number
  recommended: boolean
}

export function HoyFilters({ rows, children }: { rows: HoyRow[]; children: (visible: HoyRow[]) => ReactNode }) {
  const [minConf, setMinConf] = useState(0)
  const [onlyRecommended, setOnlyRecommended] = useState(false)
  const visible = rows.filter(r =>
    r.confidence >= minConf && (!onlyRecommended || r.recommended)
  )
  return (
    <div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16, fontSize: 12, color: "var(--text-muted)", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          Confianza mín: {minConf}
          <input type="range" min={0} max={100} step={5} value={minConf} onChange={e => setMinConf(Number(e.target.value))} />
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={onlyRecommended} onChange={e => setOnlyRecommended(e.target.checked)} />
          Solo recomendados
        </label>
        <span>{visible.length} de {rows.length}</span>
      </div>
      {children(visible)}
    </div>
  )
}
