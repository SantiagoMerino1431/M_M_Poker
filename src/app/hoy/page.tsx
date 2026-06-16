export const maxDuration = 30

import { getTodayAnalyses, getDashboardData, getOpenBetsToday } from "../actions"
import Link from "next/link"
import { todayLabel } from "@/lib/utils/time"
import { HoyActions } from "@/components/HoyActions"
import { correlationWarnings } from "@/lib/engine/correlation"
import { cookies } from "next/headers"

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 70 ? "var(--win)" : score >= 40 ? "var(--draw)" : "var(--loss)"
  const label = score >= 70 ? "ALTO" : score >= 40 ? "MEDIO" : "BAJO"
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", background: color, color: "#000", letterSpacing: "0.08em" }}>
      {label} {score}
    </span>
  )
}

function pct(n: number | null) {
  if (n === null) return "--"
  return `${(n * 100).toFixed(0)}%`
}

export default async function HoyPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("mm_uid")?.value ? Number(cookieStore.get("mm_uid")!.value) : undefined

  const [analyses, dashboard, openBets] = await Promise.all([
    getTodayAnalyses(),
    getDashboardData(userId),
    getOpenBetsToday(),
  ])

  const { bankroll, metrics } = dashboard
  const realExposure = openBets.filter(b => b.mode === "real").reduce((s, b) => s + b.amount, 0)
  const warnings = correlationWarnings(openBets.map(b => ({ fixtureId: b.fixtureId, market: b.market, selection: b.selection })))
  const dailyExposure = analyses
    .flatMap(a => a.markets)
    .filter(m => m.isRecommended && m.kellyAmount)
    .reduce((s, m) => s + (m.kellyAmount ?? 0), 0)

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, marginBottom: 40 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            Bankroll
          </div>
          <div className="stat-number" style={{ fontSize: 36, color: "var(--accent)", marginBottom: 4 }}>
            ${bankroll.current.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            {metrics.ROI >= 0 ? "+" : ""}{metrics.ROI.toFixed(1)}% ROI · {metrics.totalBets} apuestas
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Exposure hoy: <span style={{ color: "var(--text)" }}>${dailyExposure.toFixed(0)}</span>
            {" / "}
            <span style={{ color: dailyExposure > bankroll.current * 0.15 ? "var(--loss)" : "var(--text-muted)" }}>
              máx ${(bankroll.current * 0.15).toFixed(0)}
            </span>
          </div>
          {bankroll.mode !== "normal" && (
            <div style={{ marginTop: 12, padding: "8px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid var(--loss)", fontSize: 11, color: "var(--loss)" }}>
              {bankroll.mode === "paused" ? "SISTEMA EN PAUSA — 5 pérdidas consecutivas" : "MODO CONSERVADOR — drawdown > 30%"}
            </div>
          )}
        </div>

        <div>
          <p style={{ fontSize: 12, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
            Partidos del día · {todayLabel()}
          </p>
          <h1 className="stat-number" style={{ fontSize: "clamp(32px, 5vw, 56px)" }}>
            Análisis <span style={{ color: "var(--accent)" }}>Hoy</span>
          </h1>
          <div style={{ marginTop: 16 }}>
            <HoyActions />
          </div>
        </div>
      </div>

      {openBets.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            Apuestas abiertas hoy ({openBets.length})
          </div>
          {openBets.map(b => (
            <div key={b.id} style={{ display: "flex", gap: 12, justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-muted)" }}>{b.market} · {b.selection}</span>
              <span style={{ color: b.mode === "real" ? "var(--accent)" : "var(--text-muted)", fontWeight: 600 }}>
                ${b.amount.toLocaleString("es-CO")} ({b.mode})
              </span>
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
              Exposición real comprometida: ${realExposure.toLocaleString("es-CO")} / ${Math.round(bankroll.current * 0.15).toLocaleString("es-CO")} máx.
            </div>
            <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 3 }}>
              <div style={{ height: 6, borderRadius: 3, width: `${Math.min(100, (realExposure / (bankroll.current * 0.15)) * 100).toFixed(0)}%`, background: realExposure > bankroll.current * 0.15 ? "var(--loss)" : "var(--win)" }} />
            </div>
          </div>
          {warnings.length > 0 && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.3)" }}>
              {warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 11, color: "rgba(255,200,0,0.9)", marginBottom: i < warnings.length - 1 ? 4 : 0 }}>⚠ {w}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {analyses.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>--</div>
          <p>No hay partidos analizados hoy. El cron corre a las 08:00 AM.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            Configura <code style={{ color: "var(--accent)" }}>RAPIDAPI_KEY</code> y ejecuta <code>pnpm cron:run</code>
          </p>
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {analyses.map(analysis => {
          const bestMarket = analysis.markets.find(m => m.isRecommended)
          const evColor = bestMarket?.EV && bestMarket.EV >= 0.05 ? "var(--win)" : "var(--draw)"

          return (
            <Link key={analysis.fixtureId} href={`/partido/${analysis.fixtureId}`}
              style={{ textDecoration: "none", display: "block" }}>
              <div style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderLeft: bestMarket ? `3px solid ${evColor}` : "3px solid var(--border)",
                padding: "16px 20px",
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                alignItems: "center",
                gap: 16,
              }}>
                <div>
                  <div className="stat-number" style={{ fontSize: 18, textTransform: "uppercase", marginBottom: 4 }}>
                    {analysis.homeTeam && analysis.awayTeam
                      ? `${analysis.homeTeam} vs ${analysis.awayTeam}`
                      : `Fixture #${analysis.fixtureId}`}
                  </div>
                  {analysis.alerts.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--draw)" }}>
                      {analysis.alerts[0]}
                    </div>
                  )}
                </div>
                <ConfidenceBadge score={analysis.confidence} />
                {bestMarket ? (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                      {bestMarket.name} · {bestMarket.selection}
                    </div>
                    <div className="stat-number" style={{ fontSize: 22, color: evColor }}>
                      EV +{pct(bestMarket.EV)}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Sin mercados recomendados</div>
                )}
                {bestMarket?.kellyAmount && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Kelly</div>
                    <div className="stat-number" style={{ fontSize: 20 }}>${bestMarket.kellyAmount}</div>
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
