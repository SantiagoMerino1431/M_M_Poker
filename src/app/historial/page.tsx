export const maxDuration = 30

import { getBets, calcMetrics } from "@/lib/kelly/tracker"
import { HistorialActions } from "@/components/HistorialActions"
import { BetHistory } from "@/components/BetHistory"
import { getBankrollState } from "@/lib/kelly/bankroll"
import { cookies } from "next/headers"

function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "16px 20px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
        {label}
      </div>
      <div className="stat-number" style={{ fontSize: 28, color: color || "var(--accent)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default async function HistorialPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("mm_uid")?.value ? Number(cookieStore.get("mm_uid")!.value) : undefined

  const [realBets, paperBets, bankrollState] = await Promise.all([
    getBets({ mode: "real", userId }),
    getBets({ mode: "paper", userId }),
    getBankrollState(userId),
  ])

  const realMetrics = calcMetrics(realBets)
  const paperMetrics = calcMetrics(paperBets)

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 12, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
          Apuestas reales · {realMetrics.totalBets} registradas
        </p>
        <h1 className="stat-number" style={{ fontSize: "clamp(32px, 5vw, 56px)" }}>
          Track <span style={{ color: "var(--accent)" }}>Record</span>
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 40 }}>
        <KPICard
          label="ROI"
          value={`${realMetrics.ROI >= 0 ? "+" : ""}${realMetrics.ROI.toFixed(1)}%`}
          color={realMetrics.ROI >= 0 ? "var(--win)" : "var(--loss)"}
        />
        <KPICard
          label="Strike Rate"
          value={`${(realMetrics.strikeRate * 100).toFixed(0)}%`}
          sub={`${realMetrics.totalBets} apuestas`}
        />
        <KPICard
          label="P/L Total"
          value={`${realMetrics.profitLoss >= 0 ? "+" : ""}$${realMetrics.profitLoss.toFixed(0)}`}
          color={realMetrics.profitLoss >= 0 ? "var(--win)" : "var(--loss)"}
        />
        <KPICard
          label="CLV Promedio"
          value={`${(realMetrics.avgCLV * 100).toFixed(2)}%`}
          sub="Cierre de línea"
        />
        <KPICard
          label="Drawdown Máx"
          value={`$${realMetrics.maxDrawdown.toFixed(0)}`}
          color="var(--loss)"
        />
      </div>

      <HistorialActions currentBankroll={bankrollState.current} />

      {paperMetrics.totalBets > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 32, padding: "16px 20px", background: "rgba(234,179,8,0.05)", border: "1px solid rgba(234,179,8,0.2)" }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--draw)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Paper · ROI</div>
            <div className="stat-number" style={{ fontSize: 22, color: paperMetrics.ROI >= 0 ? "var(--win)" : "var(--loss)" }}>
              {paperMetrics.ROI >= 0 ? "+" : ""}{paperMetrics.ROI.toFixed(1)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--draw)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Strike rate</div>
            <div className="stat-number" style={{ fontSize: 22 }}>{(paperMetrics.strikeRate * 100).toFixed(0)}%</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{paperMetrics.totalBets} simulaciones</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--draw)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>P/L simulado</div>
            <div className="stat-number" style={{ fontSize: 22, color: paperMetrics.profitLoss >= 0 ? "var(--win)" : "var(--loss)" }}>
              {paperMetrics.profitLoss >= 0 ? "+" : ""}${paperMetrics.profitLoss.toFixed(0)}
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="stat-number" style={{ fontSize: 20, textTransform: "uppercase", marginBottom: 12 }}>
          Historial de apuestas
        </h2>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <BetHistory
            bets={[...realBets, ...paperBets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40)}
            bankroll={bankrollState.current}
          />
        </div>
      </div>
    </div>
  )
}
