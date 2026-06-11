"use client"
import { ActionButton } from "./ActionButton"
import { runDailyCronAction, runPreMatchAction, clearAlertsAction } from "@/app/actions"

export function HoyActions() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <ActionButton
        label="Pipeline diario"
        pendingLabel="Procesando"
        action={runDailyCronAction}
        variant="primary"
      />
      <ActionButton
        label="Pre-match"
        pendingLabel="Cargando lineups"
        action={() => runPreMatchAction()}
        variant="secondary"
      />
      <ActionButton
        label="Limpiar alertas"
        action={clearAlertsAction}
        variant="ghost"
      />
    </div>
  )
}
