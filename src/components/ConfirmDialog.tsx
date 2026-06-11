"use client"
import { useEffect, useRef } from "react"

interface Props {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "danger"
  onConfirm: () => void
  onCancel: () => void
  children?: React.ReactNode
}

export function ConfirmDialog({
  open, title, description,
  confirmLabel = "Confirmar", cancelLabel = "Cancelar",
  variant = "default", onConfirm, onCancel, children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onCancel])

  if (!open) return null

  const confirmStyle: React.CSSProperties = variant === "danger"
    ? { background: "transparent", border: "1px solid var(--loss)", color: "var(--loss)", cursor: "pointer", padding: "8px 16px", fontFamily: "inherit", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: "0.08em" }
    : { background: "var(--accent)", border: "none", color: "#000", cursor: "pointer", padding: "8px 16px", fontFamily: "inherit", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 700 }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div ref={ref} style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 24, maxWidth: 440, width: "90%", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{description}</div>
        </div>
        {children && <div>{children}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", padding: "8px 16px", fontFamily: "inherit", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} style={confirmStyle}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
