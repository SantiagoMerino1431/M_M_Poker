"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { recordResultAction } from "@/app/actions"

interface Props {
  fixtureId: number
  initialHome?: number | null
  initialAway?: number | null
}

export function MatchResultModal({ fixtureId, initialHome, initialAway }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [home, setHome] = useState(String(initialHome ?? ""))
  const [away, setAway] = useState(String(initialAway ?? ""))
  const [autoSettle, setAutoSettle] = useState(true)
  const [msg, setMsg] = useState("")
  const [pending, start] = useTransition()

  const homeN = parseInt(home)
  const awayN = parseInt(away)
  const valid = Number.isInteger(homeN) && Number.isInteger(awayN) && homeN >= 0 && awayN >= 0

  const save = () => start(async () => {
    if (!valid) { setMsg("Ingresa marcador válido"); return }
    const res = await recordResultAction(fixtureId, homeN, awayN, autoSettle)
    setMsg(res.message)
    if (res.ok) { setOpen(false); router.refresh() }
  })

  const inp: React.CSSProperties = {
    width: 60,
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    padding: "8px",
    fontSize: 24,
    fontWeight: 700,
    textAlign: "center",
    fontFamily: "inherit",
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      style={{
        background: "transparent",
        border: "1px solid var(--border)",
        color: "var(--text-muted)",
        padding: "6px 14px",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        cursor: "pointer",
      }}
    >
      Registrar resultado
    </button>
  )

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: 32,
        minWidth: 280,
      }}>
        <div style={{
          fontSize: 11, color: "var(--accent)", textTransform: "uppercase",
          letterSpacing: "0.1em", marginBottom: 20,
        }}>
          Resultado final
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          justifyContent: "center", marginBottom: 20,
        }}>
          <input
            style={inp}
            type="number"
            min={0}
            max={20}
            value={home}
            onChange={e => setHome(e.target.value)}
          />
          <span style={{ fontSize: 20, color: "var(--text-muted)" }}>—</span>
          <input
            style={inp}
            type="number"
            min={0}
            max={20}
            value={away}
            onChange={e => setAway(e.target.value)}
          />
        </div>

        <label style={{
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 12, color: "var(--text-muted)", marginBottom: 20, cursor: "pointer",
        }}>
          <input
            type="checkbox"
            checked={autoSettle}
            onChange={e => setAutoSettle(e.target.checked)}
          />
          Liquidar apuestas abiertas automáticamente
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={save}
            disabled={pending || !valid}
            style={{
              flex: 1,
              background: "var(--accent)",
              border: "none",
              color: "#000",
              padding: "10px",
              fontSize: 12,
              fontWeight: 700,
              cursor: pending ? "wait" : "pointer",
              textTransform: "uppercase",
            }}
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              padding: "10px 16px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>

        {msg && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  )
}
