import Link from "next/link"
import { predictMatch } from "@/lib/model/poisson"
import { TEAMS, GROUP_IDS, getFixtureId } from "@/lib/data/teams"

function getGroupFixtures(ids: number[]) {
  const fixtures = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const home = TEAMS[ids[i]]
      const away = TEAMS[ids[j]]
      const pred = predictMatch(home, away)
      fixtures.push({ home, away, pred, id: getFixtureId(home.id, away.id) })
    }
  }
  return fixtures
}

function pct(n: number) { return `${(n * 100).toFixed(0)}%` }

function probColor(val: number): string {
  if (val >= 0.55) return "var(--win)"
  if (val >= 0.35) return "var(--draw)"
  return "var(--text-muted)"
}

export default function PartidosPage() {
  const groups = Object.entries(GROUP_IDS)

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 12, letterSpacing: "0.12em", color: "var(--accent)", textTransform: "uppercase", marginBottom: 8 }}>
          Modelo Poisson · Todos los mercados · Fase de grupos
        </p>
        <h1 className="stat-number" style={{ fontSize: "clamp(36px, 6vw, 72px)", lineHeight: 1 }}>
          Partidos <span style={{ color: "var(--accent)" }}>2026</span>
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>
          72 partidos · resultado 1X2, over/under, BTTS, marcadores probables y clean sheet.
        </p>
      </div>

      {/* Groups */}
      {groups.map(([groupName, ids]) => {
        const fixtures = getGroupFixtures(ids)
        return (
          <section key={groupName} style={{ marginBottom: 48 }}>
            {/* Group title */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              marginBottom: 12, paddingBottom: 10,
              borderBottom: "1px solid var(--border)",
            }}>
              <span className="stat-number" style={{ fontSize: 36, color: "var(--accent)", lineHeight: 1 }}>
                {groupName}
              </span>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Grupo {groupName}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {TEAMS[ids[0]]?.name} · {TEAMS[ids[1]]?.name} · {TEAMS[ids[2]]?.name} · {TEAMS[ids[3]]?.name}
                </div>
              </div>
            </div>

            {/* Fixtures grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 8 }}>
              {fixtures.map(({ home, away, pred, id }) => (
                <Link key={id} href={`/partidos/${id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <div style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  padding: "16px",
                }}>
                  {/* Teams */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div>
                      <div className="stat-number" style={{ fontSize: 15, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {home.name}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>#{home.fifaRanking} FIFA</div>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "2px 8px", border: "1px solid var(--border)" }}>
                      VS
                    </span>
                    <div style={{ textAlign: "right" }}>
                      <div className="stat-number" style={{ fontSize: 15, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {away.name}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>#{away.fifaRanking} FIFA</div>
                    </div>
                  </div>

                  {/* 1X2 */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, marginBottom: 10 }}>
                    {[
                      { label: "1", val: pred.homeWin },
                      { label: "X", val: pred.draw },
                      { label: "2", val: pred.awayWin },
                    ].map(({ label, val }) => (
                      <div key={label} style={{
                        textAlign: "center", padding: "7px 4px",
                        background: "var(--surface-2)",
                        borderBottom: `2px solid ${probColor(val)}`,
                      }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
                        <div className="stat-number" style={{ fontSize: 20, color: probColor(val) }}>{pct(val)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Markets row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, marginBottom: 10 }}>
                    {[
                      { label: "+1.5G", val: pred.over15 },
                      { label: "+2.5G", val: pred.over25 },
                      { label: "+3.5G", val: pred.over35 },
                      { label: "BTTS",  val: pred.btts },
                    ].map(({ label, val }) => (
                      <div key={label} style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        padding: "5px 2px", background: "var(--bg)",
                      }}>
                        <span style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</span>
                        <span className="stat-number" style={{ fontSize: 15 }}>{pct(val)}</span>
                      </div>
                    ))}
                  </div>

                  {/* xG + clean sheet */}
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    borderTop: "1px solid var(--border)", paddingTop: 10, marginBottom: 10,
                  }}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>xG Local </span>
                        <span className="stat-number" style={{ fontSize: 16, color: "var(--accent)" }}>
                          {pred.expectedHomeGoals.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>xG Visitante </span>
                        <span className="stat-number" style={{ fontSize: 16, color: "var(--accent)" }}>
                          {pred.expectedAwayGoals.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: "var(--text-muted)" }}>CS L</div>
                        <div className="stat-number" style={{ fontSize: 13 }}>{pct(pred.cleanSheetHome)}</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: "var(--text-muted)" }}>CS V</div>
                        <div className="stat-number" style={{ fontSize: 13 }}>{pct(pred.cleanSheetAway)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Top scores */}
                  <div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>
                      Marcadores más probables
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {pred.exactScores.slice(0, 4).map(s => (
                        <span key={s.score} style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 13, fontWeight: 700,
                          padding: "2px 7px",
                          background: "var(--accent-dim)",
                          color: "var(--accent)",
                          border: "1px solid rgba(232,255,60,0.15)",
                        }}>
                          {s.score} <span style={{ fontSize: 10, fontWeight: 400 }}>{pct(s.prob)}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Ver detalle */}
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "right" }}>
                    Ver análisis completo →
                  </div>
                </div>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
