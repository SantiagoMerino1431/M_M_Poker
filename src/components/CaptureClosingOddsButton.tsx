"use client"
import { useState, useTransition } from "react"
import { captureClosingOddsAction } from "@/app/actions"

export function CaptureClosingOddsButton({ fixtureId }: { fixtureId: number }) {
  const [msg, setMsg] = useState("")
  const [pending, start] = useTransition()

  const capture = () => start(async () => {
    const res = await captureClosingOddsAction(fixtureId)
    setMsg(res.message)
  })

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button
        onClick={capture}
        disabled={pending}
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
          padding: "6px 14px",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          cursor: pending ? "wait" : "pointer",
        }}
      >
        {pending ? "Capturando..." : "Capturar cuotas de cierre"}
      </button>
      {msg && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{msg}</span>}
    </div>
  )
}
