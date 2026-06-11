import { predictMatch } from "@/lib/model/poisson"
import { runMonteCarlo } from "@/lib/model/montecarlo"

const CONTENDERS = [
  { id: 5, name: "España", group: "B", attackStrength: 1.45, defenseStrength: 0.7, fifaRanking: 1 },
  { id: 9, name: "Argentina", group: "C", attackStrength: 1.5, defenseStrength: 0.75, fifaRanking: 2 },
  { id: 13, name: "Francia", group: "D", attackStrength: 1.5, defenseStrength: 0.72, fifaRanking: 3 },
  { id: 17, name: "Alemania", group: "E", attackStrength: 1.4, defenseStrength: 0.78, fifaRanking: 4 },
  { id: 21, name: "Brasil", group: "F", attackStrength: 1.42, defenseStrength: 0.76, fifaRanking: 5 },
  { id: 25, name: "Inglaterra", group: "G", attackStrength: 1.38, defenseStrength: 0.8, fifaRanking: 5 },
  { id: 18, name: "Portugal", group: "E", attackStrength: 1.38, defenseStrength: 0.8, fifaRanking: 6 },
  { id: 26, name: "Países Bajos", group: "G", attackStrength: 1.32, defenseStrength: 0.82, fifaRanking: 7 },
]

const SAMPLE_FIXTURES = [
  { id: 1, home: CONTENDERS[0], away: CONTENDERS[1], stage: "group_B", label: "ESP vs ARG" },
  { id: 2, home: CONTENDERS[2], away: CONTENDERS[3], stage: "group_D", label: "FRA vs ALE" },
  { id: 3, home: CONTENDERS[4], away: CONTENDERS[6], stage: "group_F", label: "BRA vs POR" },
]

function pct(n: number) { return `${(n * 100).toFixed(0)}%` }

export default function HomePage() {
  const mcResult = runMonteCarlo(
    CONTENDERS,
    CONTENDERS.flatMap((t1, i) => CONTENDERS.slice(i + 1).map(t2 => ({
      homeId: t1.id, awayId: t2.id, stage: `group_${t1.group}`
    }))),
    2000
  )

  const champRanked = Object.entries(mcResult.champion)
    .map(([id, prob]) => ({ team: CONTENDERS.find(t => t.id === Number(id))!, prob }))
    .filter(e => e.team)
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 5)

  const samplePreds = SAMPLE_FIXTURES.map(f => ({
    label: f.label,
    home: f.home.name,
    away: f.away.name,
    pred: predictMatch(f.home, f.away),
  }))

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

      {/* Hero */}
      <div style={{ marginBottom: 48 }}>
        <p style={{ fontSize: 12, letterSpacing: "0.12em", color: "var(--accent)", textTransform: "uppercase", marginBottom: 8 }}>
          Modelo estadístico · Poisson + Monte Carlo · 10k simulaciones
        </p>
        <h1 className="stat-number" style={{ fontSize: "clamp(48px, 8vw, 96px)", color: "var(--text)", lineHeight: 1 }}>
          Mundial<br />
          <span style={{ color: "var(--accent)" }}>2026</span>
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 16, maxWidth: 480 }}>
          Proyecciones de resultado, goles, tarjetas, corners y goleadores para cada partido. Recálculo diario con datos reales.
        </p>
      </div>

      {/* Champion odds */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
          <h2 className="stat-number" style={{ fontSize: 28, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Campeón
          </h2>
          <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Monte Carlo · {(2000).toLocaleString()} sim.
          </span>
        </div>
        <div style={{ display: "grid", gap: 2 }}>
          {champRanked.map((e, i) => (
            <div key={e.team.id} style={{
              display: "grid",
              gridTemplateColumns: "24px 160px 1fr 64px",
              alignItems: "center",
              gap: 16,
              padding: "12px 16px",
              background: i === 0 ? "var(--accent-dim)" : "var(--surface)",
              borderLeft: i === 0 ? "3px solid var(--accent)" : "3px solid transparent",
            }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                {i + 1}
              </span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {e.team.name}
              </span>
              <div className="prob-bar">
                <div className="prob-bar-fill" style={{ width: pct(e.prob) }} />
              </div>
              <span className="stat-number" style={{
                fontSize: 24,
                color: i === 0 ? "var(--accent)" : "var(--text)",
                textAlign: "right",
              }}>
                {pct(e.prob)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Sample match predictions */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
          <h2 className="stat-number" style={{ fontSize: 28, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Partidos destacados
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {samplePreds.map(m => (
            <div key={m.label} style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              padding: "20px",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                Fase de Grupos
              </div>

              {/* Teams and result odds */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span className="stat-number" style={{ fontSize: 20, textTransform: "uppercase" }}>{m.home}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>vs</span>
                <span className="stat-number" style={{ fontSize: 20, textTransform: "uppercase", textAlign: "right" }}>{m.away}</span>
              </div>

              {/* 1X2 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 16 }}>
                {[
                  { label: "1", val: m.pred.homeWin, color: "var(--win)" },
                  { label: "X", val: m.pred.draw, color: "var(--draw)" },
                  { label: "2", val: m.pred.awayWin, color: "var(--loss)" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: "center", padding: "8px 4px", background: "var(--surface-2)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
                    <div className="stat-number" style={{ fontSize: 22, color }}>{pct(val)}</div>
                  </div>
                ))}
              </div>

              {/* Over/Under */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                {[
                  { label: "+1.5G", val: m.pred.over15 },
                  { label: "+2.5G", val: m.pred.over25 },
                  { label: "BTTS", val: m.pred.btts },
                ].map(({ label, val }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", background: "var(--bg)" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
                    <span className="stat-number" style={{ fontSize: 16 }}>{pct(val)}</span>
                  </div>
                ))}
              </div>

              {/* Top marcador */}
              <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Marcador más probable
                </span>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {m.pred.exactScores.slice(0, 3).map(s => (
                    <span key={s.score} style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 14,
                      fontWeight: 700,
                      padding: "2px 8px",
                      background: "var(--accent-dim)",
                      color: "var(--accent)",
                      border: "1px solid rgba(232,255,60,0.2)",
                    }}>
                      {s.score} <span style={{ fontSize: 11, fontWeight: 400 }}>{pct(s.prob)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
