"use client"

import { useState, useEffect } from "react"
import { useUser } from "./UserContext"
import { getUsers } from "@/app/actions"
import type { User } from "@/lib/types"

export function NavUser() {
  const { user, setUser, ready } = useUser()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    if (open) getUsers().then(setUsers)
  }, [open])

  if (!ready) return null

  if (!user) {
    return (
      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
        Sin usuario
      </span>
    )
  }

  return (
    <div style={{ marginLeft: "auto", position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: "transparent", border: "1px solid var(--border)",
          color: "var(--text)", padding: "4px 12px", cursor: "pointer",
          fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <span style={{ color: "var(--accent)" }}>●</span>
        {user.name.toUpperCase()}
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>▾</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 100,
            background: "var(--surface)", border: "1px solid var(--border)",
            minWidth: 180, boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Cambiar usuario
            </div>
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => { setUser(u); setOpen(false) }}
                style={{
                  display: "block", width: "100%", background: u.id === user.id ? "var(--surface-2)" : "transparent",
                  border: "none", color: u.id === user.id ? "var(--accent)" : "var(--text)",
                  padding: "10px 14px", cursor: "pointer", fontSize: 13,
                  fontWeight: u.id === user.id ? 700 : 400, textAlign: "left",
                }}
              >
                {u.name}
                {u.id === user.id && <span style={{ fontSize: 10, marginLeft: 6 }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
