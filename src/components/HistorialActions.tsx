"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Bet } from "@/lib/types"
import { SettleModal } from "./SettleModal"
import { ConfirmDialog } from "./ConfirmDialog"
import { ActionButton } from "./ActionButton"
import { adjustBankrollAction, takeWeeklySnapshotAction } from "@/app/actions"

interface Props {
  pendingBets: Bet[]
  currentBankroll: number
}

export function HistorialActions({ pendingBets, currentBankroll }: Props) {
  const router = useRouter()
  const [settleBet, setSettleBet] = useState<Bet | null>(null)
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState(currentBankroll)
  const [adjustReason, setAdjustReason] = useState("")
  const [isPendingAdjust, startAdjustTransition] = useTransition()
  const [adjustMsg, setAdjustMsg] = useState("")

  const handleAdjust = () => {
    startAdjustTransition(async () => {
      const res = await adjustBankrollAction(adjustAmount, adjustReason || undefined)
      setAdjustMsg(res.message)
      if (res.ok) {
        setShowAdjust(false)
        router.refresh()
      }
    })
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowAdjust(true)}
          style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", padding: "6px 12px", fontFamily: "inherit", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          Ajustar bankroll
        </button>
        <ActionButton
          label="Snapshot semanal"
          action={async () => {
            const res = await takeWeeklySnapshotAction()
            if (res.ok) router.refresh()
            return res
          }}
          variant="secondary"
          requireConfirm
          confirmTitle="Guardar snapshot semanal"
          confirmDescription={`¿Guardar $${currentBankroll.toLocaleString("es-CO")} COP como referencia de esta semana?`}
        />
      </div>

      {pendingBets.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {pendingBets.map(bet => (
            <button
              key={bet.id}
              onClick={() => setSettleBet(bet)}
              style={{ background: "transparent", border: "1px solid var(--loss)", color: "var(--loss)", cursor: "pointer", padding: "4px 10px", fontFamily: "inherit", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}
            >
              Liquidar #{bet.id}
            </button>
          ))}
        </div>
      )}

      {settleBet && (
        <SettleModal
          bet={settleBet}
          onClose={(settled) => {
            setSettleBet(null)
            if (settled) router.refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={showAdjust}
        title="Ajustar bankroll"
        description="Ingresa el nuevo balance y una razón opcional."
        confirmLabel={isPendingAdjust ? "Guardando..." : "Confirmar"}
        onConfirm={handleAdjust}
        onCancel={() => { setShowAdjust(false); setAdjustMsg("") }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            type="number"
            value={adjustAmount}
            onChange={e => setAdjustAmount(Number(e.target.value))}
            placeholder="Nuevo balance (COP)"
            style={{ background: "var(--surface-2, #111)", border: "1px solid var(--border)", color: "inherit", padding: "8px", fontFamily: "inherit", fontSize: 14 }}
          />
          <input
            type="text"
            value={adjustReason}
            onChange={e => setAdjustReason(e.target.value)}
            placeholder="Razón (opcional)"
            style={{ background: "var(--surface-2, #111)", border: "1px solid var(--border)", color: "inherit", padding: "8px", fontFamily: "inherit", fontSize: 13 }}
          />
          {adjustMsg && <div style={{ fontSize: 11, color: "var(--loss)" }}>{adjustMsg}</div>}
        </div>
      </ConfirmDialog>
    </>
  )
}
