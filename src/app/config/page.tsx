import { getSettingsAction } from "@/app/actions"
import { SettingsForm } from "@/components/SettingsForm"

export default async function ConfigPage() {
  const settings = await getSettingsAction()
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <p style={{ fontSize: 12, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
        Configuración
      </p>
      <h1 className="stat-number" style={{ fontSize: "clamp(28px, 4vw, 44px)", marginBottom: 24 }}>
        Criterio y <span style={{ color: "var(--accent)" }}>riesgo</span>
      </h1>
      <SettingsForm initial={settings} />
    </div>
  )
}
