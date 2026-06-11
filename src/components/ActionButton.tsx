"use client"
import { useState, useTransition } from "react"
import type { CSSProperties } from "react"
import { ConfirmDialog } from "./ConfirmDialog"

interface Props {
  action: () => Promise<{ ok: boolean; message: string }>
  label: string
  pendingLabel?: string
  variant?: "primary" | "secondary" | "ghost"
  requireConfirm?: boolean
  confirmTitle?: string
  confirmDescription?: string
}

const SPINNER = ["-", "\\", "|", "/"]

export function ActionButton({
  action, label, pendingLabel,
  variant = "secondary",
  requireConfirm = false,
  confirmTitle = label,
  confirmDescription = "",
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [spinnerIdx, setSpinnerIdx] = useState(0)

  const execute = () => {
    setResult(null)
    const interval = setInterval(() => setSpinnerIdx(i => (i + 1) % 4), 150)
    startTransition(async () => {
      const res = await action()
      clearInterval(interval)
      setResult(res)
      setTimeout(() => setResult(null), 5000)
    })
  }

  const handleClick = () => {
    if (requireConfirm) { setShowConfirm(true); return }
    execute()
  }

  const baseStyle: CSSProperties = {
    cursor: isPending ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: "6px 12px",
    opacity: isPending ? 0.7 : 1,
  }

  const variantStyles: Record<string, CSSProperties> = {
    primary: { background: "var(--accent)", border: "none", color: "#000", fontWeight: 700 },
    secondary: { background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" },
    ghost: { background: "transparent", border: "none", color: "var(--text-muted)" },
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button onClick={handleClick} disabled={isPending} style={{ ...baseStyle, ...variantStyles[variant] }}>
        {isPending ? `${SPINNER[spinnerIdx]} ${pendingLabel ?? label}...` : label}
      </button>
      {result && (
        <div style={{ fontSize: 10, color: result.ok ? "var(--win)" : "var(--loss)", letterSpacing: "0.06em" }}>
          {result.message}
        </div>
      )}
      <ConfirmDialog
        open={showConfirm}
        title={confirmTitle}
        description={confirmDescription}
        onConfirm={() => { setShowConfirm(false); execute() }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
