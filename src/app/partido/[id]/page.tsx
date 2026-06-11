import { getAnalysisForFixture } from "../../actions"
import { notFound } from "next/navigation"
import Link from "next/link"
import { formatTime } from "@/lib/utils/time"
import { PartidoActions } from "@/components/PartidoActions"
import { getBankrollState } from "@/lib/kelly/bankroll"

function pct(n: number | null) {
  if (n === null) return "--"
  return `${(n * 100).toFixed(1)}%`
}

function evColor(ev: number | null) {
  if (ev === null) return "var(--text-muted)"
  if (ev >= 0.05) return "var(--win)"
  if (ev >= 0.03) return "var(--draw)"
  return "var(--text-muted)"
}

export default async function PartidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fixtureId = Number(id)
  const [analysis, bankrollState] = await Promise.all([
    getAnalysisForFixture(fixtureId),
    getBankrollState(),
  ])
  if (!analysis) notFound()

  const recommended = analysis.markets.filter(m => m.isRecommended)
  const others = analysis.markets.filter(m => !m.isRecommended && m.EV !== null)

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: 12, color: "var(--text-muted)" }}>
        <Link href="/hoy" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Hoy</Link>
        <span>/</span>
        <span>Fixture #{fixtureId}</span>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 10, padding: "2px 8px", background: analysis.isPreliminary ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)", color: analysis.isPreliminary ? "var(--draw)" : "var(--win)" }}>
            {analysis.isPreliminary ? "PRELIMINAR" : "FINAL"}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Actualizado: {formatTime(analysis.lastUpdated)} COT
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {analysis.alerts.map((alert, i) => (
            <div key={i} style={{ fontSize: 11, padding: "4px 10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "var(--draw)" }}>
              {alert}
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
          Modelo estadístico
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Goles esperados local</div>
            <div className="stat-number" style={{ fontSize: 32, color: "var(--accent)" }}>
              {analysis.model.lambdaHome.toFixed(2)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Goles esperados visitante</div>
            <div className="stat-number" style={{ fontSize: 32 }}>
              {analysis.model.lambdaAway.toFixed(2)}
            </div>
          </div>
        </div>
        {analysis.model.adjustmentsApplied.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {analysis.model.adjustmentsApplied.map((adj, i) => (
              <span key={i} style={{ fontSize: 10, padding: "2px 6px", background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                {adj}
              </span>
            ))}
          </div>
        )}
      </div>

      {recommended.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 className="stat-number" style={{ fontSize: 22, textTransform: "uppercase", marginBottom: 12, color: "var(--win)" }}>
            Mercados recomendados
          </h2>
          <div style={{ display: "grid", gap: 6 }}>
            {recommended.map((m, i) => (
              <div key={i} style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderLeft: "3px solid var(--win)",
                padding: "14px 16px",
                display: "grid",
                gridTemplateColumns: "1fr repeat(5, auto)",
                alignItems: "center",
                gap: 16,
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {m.name} — {m.selection}
                  </div>
                  {m.bookmaker && (
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      {m.bookmaker} · cuota {m.odds}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Prob. modelo</div>
                  <div className="stat-number" style={{ fontSize: 18 }}>{pct(m.ourProbability)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Prob. bm</div>
                  <div className="stat-number" style={{ fontSize: 18, color: "var(--text-muted)" }}>{pct(m.bookmakerProbability)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Edge</div>
                  <div className="stat-number" style={{ fontSize: 18, color: "var(--win)" }}>+{pct(m.edge)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>EV</div>
                  <div className="stat-number" style={{ fontSize: 18, color: evColor(m.EV) }}>+{pct(m.EV)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Kelly</div>
                  <div className="stat-number" style={{ fontSize: 20, color: "var(--accent)" }}>${m.kellyAmount}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 className="stat-number" style={{ fontSize: 18, textTransform: "uppercase", marginBottom: 10, color: "var(--text-muted)" }}>
            Otros mercados calculados
          </h2>
          <div style={{ display: "grid", gap: 4 }}>
            {others.slice(0, 8).map((m, i) => (
              <div key={i} style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                padding: "10px 16px",
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                alignItems: "center",
                gap: 12,
                opacity: 0.65,
              }}>
                <div style={{ fontSize: 12 }}>{m.name} — {m.selection}</div>
                <div className="stat-number" style={{ fontSize: 16 }}>{pct(m.ourProbability)}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.odds ? `@${m.odds}` : "--"}</div>
                <div className="stat-number" style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  EV {m.EV !== null ? `${(m.EV * 100).toFixed(1)}%` : "--"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <PartidoActions
        markets={analysis.markets}
        fixtureId={fixtureId}
        bankroll={bankrollState.current}
      />
    </div>
  )
}
