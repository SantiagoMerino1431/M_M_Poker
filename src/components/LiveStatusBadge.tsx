"use client"
import { useEffect, useState } from "react"
import { getLiveStatusAction } from "@/app/actions"

interface StatusData {
  status: string
  homeScore: number | null
  awayScore: number | null
  elapsed: number | null
}

interface Props {
  fixtureId: number
  initial?: StatusData
}

function badgeStyle(status: string): React.CSSProperties {
  const isLive = status === "1H" || status === "2H" || status === "HT" || status === "ET" || status === "P"
  const isFinal = status === "FT" || status === "AET" || status === "PEN"
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    border: "1px solid",
    borderColor: isLive ? "var(--win)" : isFinal ? "var(--border)" : "var(--border)",
    color: isLive ? "var(--win)" : isFinal ? "var(--text-muted)" : "var(--text-muted)",
    background: isLive ? "rgba(0,200,100,0.08)" : "transparent",
  }
}

function statusLabel(s: StatusData): string {
  const { status, homeScore, awayScore, elapsed } = s
  if (status === "1H" || status === "2H") {
    const score = homeScore != null ? ` ${homeScore}—${awayScore}` : ""
    return `${elapsed != null ? elapsed + "'" : "EN VIVO"}${score}`
  }
  if (status === "HT") return "Descanso"
  if (status === "FT") {
    return homeScore != null ? `Final ${homeScore}—${awayScore}` : "Finalizado"
  }
  if (status === "AET") return homeScore != null ? `Final ET ${homeScore}—${awayScore}` : "Final ET"
  if (status === "PEN") return homeScore != null ? `Final Pen ${homeScore}—${awayScore}` : "Final Pen"
  if (status === "NS" || status === "scheduled") return "Por jugar"
  if (status === "PST") return "Aplazado"
  if (status === "CANC") return "Cancelado"
  return status
}

export function LiveStatusBadge({ fixtureId, initial }: Props) {
  const [data, setData] = useState<StatusData>(
    initial ?? { status: "NS", homeScore: null, awayScore: null, elapsed: null }
  )

  useEffect(() => {
    let mounted = true
    const poll = async () => {
      try {
        const next = await getLiveStatusAction(fixtureId)
        if (mounted) setData(next)
      } catch { /* silently ignore network errors */ }
    }

    poll()
    const id = setInterval(poll, 60_000)
    return () => { mounted = false; clearInterval(id) }
  }, [fixtureId])

  const isLive = data.status === "1H" || data.status === "2H" || data.status === "HT" || data.status === "ET" || data.status === "P"

  return (
    <span style={badgeStyle(data.status)}>
      {isLive && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--win)",
          display: "inline-block",
          animation: "pulse 1.5s ease-in-out infinite",
        }} />
      )}
      {statusLabel(data)}
    </span>
  )
}
