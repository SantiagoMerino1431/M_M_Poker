import { getBets, calcMetrics } from "@/lib/kelly/tracker"

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
  const [realBets, paperBets] = await Promise.all([
    getBets({ mode: "real" }),
    getBets({ mode: "paper" }),
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

      {paperMetrics.totalBets > 0 && (
        <div style={{ background: "rgba(232,255,60,0.05)", border: "1px solid rgba(232,255,60,0.2)", padding: "14px 20px", marginBottom: 32 }}>
          <span style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Paper Trading · {paperMetrics.totalBets} simulaciones
          </span>
          <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 16 }}>
            ROI simulado: {paperMetrics.ROI >= 0 ? "+" : ""}{paperMetrics.ROI.toFixed(1)}% · Strike: {(paperMetrics.strikeRate * 100).toFixed(0)}%
          </span>
        </div>
      )}

      <div>
        <h2 className="stat-number" style={{ fontSize: 20, textTransform: "uppercase", marginBottom: 12 }}>
          Historial de apuestas
        </h2>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto auto", gap: 12, padding: "8px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Fixture</span><span>Mercado</span><span>Cuota</span><span>Monto</span><span>EV</span><span>Resultado</span>
          </div>
          {realBets.slice(0, 20).map(bet => (
            <div key={bet.id} style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto auto auto auto",
              gap: 12,
              padding: "10px 16px",
              borderBottom: "1px solid var(--border)",
              borderLeft: `3px solid ${bet.result === "win" ? "var(--win)" : bet.result === "loss" ? "var(--loss)" : "var(--border)"}`,
            }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>#{bet.fixtureId}</span>
              <span style={{ fontSize: 13 }}>{bet.market} · {bet.selection}</span>
              <span className="stat-number" style={{ fontSize: 16 }}>{bet.oddsUsed}</span>
              <span className="stat-number" style={{ fontSize: 16 }}>${bet.amount}</span>
              <span style={{ fontSize: 12, color: bet.EV >= 0.03 ? "var(--win)" : "var(--text-muted)" }}>
                +{(bet.EV * 100).toFixed(1)}%
              </span>
              <span className="stat-number" style={{
                fontSize: 16,
                color: bet.result === "win" ? "var(--win)" : bet.result === "loss" ? "var(--loss)" : "var(--text-muted)",
              }}>
                {bet.result === "win" ? `+$${bet.profitLoss?.toFixed(0)}` :
                 bet.result === "loss" ? `-$${bet.amount}` : "PEND."}
              </span>
            </div>
          ))}
          {realBets.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Sin apuestas registradas aún. Comienza con paper trading en /partido/[id].
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
