"use client"

import { useState, useEffect, useTransition } from "react"
import { useUser } from "./UserContext"
import { getUsers, createUser } from "@/app/actions"
import type { User } from "@/lib/types"

export function UserSetupModal() {
  const { user, setUser, ready } = useUser()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [mode, setMode] = useState<"select" | "create">("select")
  const [name, setName] = useState("")
  const [bankroll, setBankroll] = useState("100000")
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (ready && !user) setOpen(true)
  }, [ready, user])

  useEffect(() => {
    if (!open) return
    getUsers().then(setUsers)
  }, [open])

  function handleSelect(u: User) {
    setUser(u)
    setOpen(false)
  }

  function handleCreate() {
    if (!name.trim()) { setError("Ingresa un nombre"); return }
    const amount = parseInt(bankroll.replace(/\D/g, ""))
    if (!amount || amount < 1000) { setError("Bankroll mínimo: $1,000 COP"); return }
    setError("")
    startTransition(async () => {
      const { id } = await createUser(name.trim(), amount)
      setUser({ id, name: name.trim(), initialBankroll: amount, createdAt: new Date().toISOString() })
      setOpen(false)
    })
  }

  if (!open) return null

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.85)", display: "flex",
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        padding: 32, width: 400, maxWidth: "calc(100vw - 32px)",
      }}>
        <div style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
          Mundial 2026 · Betting Assistant
        </div>
        <h2 style={{ fontSize: 22, fontFamily: "var(--font-display)", fontWeight: 800, marginBottom: 24 }}>
          ¿Quién eres?
        </h2>

        {mode === "select" && (
          <>
            {users.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  Seleccionar usuario
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {users.map(u => (
                    <button key={u.id} onClick={() => handleSelect(u)} style={{
                      background: "var(--surface-2)", border: "1px solid var(--border)",
                      color: "var(--text)", padding: "12px 16px", cursor: "pointer",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      fontSize: 14, fontWeight: 600, textAlign: "left",
                    }}>
                      <span>{u.name}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
                        BK inicial: ${u.initialBankroll.toLocaleString("es-CO")}
                      </span>
                    </button>
                  ))}
                </div>
                <div style={{ margin: "16px 0", borderTop: "1px solid var(--border)" }} />
              </div>
            )}
            <button onClick={() => setMode("create")} style={{
              background: "transparent", border: "1px solid var(--accent)",
              color: "var(--accent)", padding: "10px 20px", cursor: "pointer",
              fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", width: "100%",
            }}>
              + Nuevo usuario
            </button>
          </>
        )}

        {mode === "create" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                Tu nombre
              </label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                placeholder="Ej: Seba"
                style={{
                  background: "var(--surface-2)", border: "1px solid var(--border)",
                  color: "var(--text)", padding: "10px 14px", fontSize: 15,
                  width: "100%", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                Bankroll inicial (COP)
              </label>
              <input
                type="number"
                min="1000"
                step="10000"
                value={bankroll}
                onChange={e => setBankroll(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                placeholder="100000"
                style={{
                  background: "var(--surface-2)", border: "1px solid var(--border)",
                  color: "var(--text)", padding: "10px 14px", fontSize: 15,
                  fontFamily: "var(--font-mono, monospace)", width: "100%",
                  outline: "none", boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Kelly máx/apuesta: ${Math.round(parseInt(bankroll || "0") * 0.08).toLocaleString("es-CO")} COP
              </div>
            </div>
            {error && <div style={{ fontSize: 12, color: "var(--loss)" }}>{error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              {users.length > 0 && (
                <button onClick={() => setMode("select")} style={{
                  background: "transparent", border: "1px solid var(--border)",
                  color: "var(--text-muted)", padding: "10px 16px", cursor: "pointer",
                  fontSize: 12, flex: 1,
                }}>
                  Volver
                </button>
              )}
              <button onClick={handleCreate} disabled={isPending} style={{
                background: "var(--accent)", border: "none",
                color: "#000", padding: "10px 20px", cursor: isPending ? "wait" : "pointer",
                fontSize: 13, fontWeight: 700, letterSpacing: "0.06em",
                textTransform: "uppercase", flex: 2, opacity: isPending ? 0.7 : 1,
              }}>
                {isPending ? "Creando..." : "Empezar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
