"use client"
import { useState } from "react"
import { runPreMatchAction } from "@/app/actions"

export function PreMatchFixtureButton({ fixtureId }: { fixtureId: number }) {
  const [pending, setPending] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run() {
    setPending(true)
    setMsg(null)
    const res = await runPreMatchAction(fixtureId)
    setMsg(res.message)
    setPending(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        onClick={run}
        disabled={pending}
        style={{
          background: "transparent", border: "1px solid var(--accent)",
          color: "var(--accent)", padding: "6px 14px", fontSize: 12,
          fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          cursor: pending ? "wait" : "pointer", opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? "Actualizando…" : "Actualizar pre-match"}
      </button>
      {msg && <span style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 420 }}>{msg}</span>}
    </div>
  )
}
