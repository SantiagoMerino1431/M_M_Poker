import { predictMatch } from "@/lib/model/poisson"

const TEAMS_BY_GROUP: Record<string, { id: number; name: string; country: string; attackStrength: number; defenseStrength: number; fifaRanking: number }[]> = {
  A: [
    { id: 1, name: "Estados Unidos", country: "USA", attackStrength: 1.15, defenseStrength: 0.95, fifaRanking: 13 },
    { id: 2, name: "México", country: "MEX", attackStrength: 1.1, defenseStrength: 1.0, fifaRanking: 16 },
    { id: 3, name: "Canadá", country: "CAN", attackStrength: 0.95, defenseStrength: 1.05, fifaRanking: 43 },
    { id: 4, name: "Jamaica", country: "JAM", attackStrength: 0.85, defenseStrength: 1.1, fifaRanking: 55 },
  ],
  B: [
    { id: 5, name: "España", country: "ESP", attackStrength: 1.45, defenseStrength: 0.7, fifaRanking: 1 },
    { id: 6, name: "Croacia", country: "CRO", attackStrength: 1.2, defenseStrength: 0.85, fifaRanking: 10 },
    { id: 7, name: "Albania", country: "ALB", attackStrength: 0.9, defenseStrength: 1.1, fifaRanking: 65 },
    { id: 8, name: "Marruecos", country: "MAR", attackStrength: 1.05, defenseStrength: 0.9, fifaRanking: 14 },
  ],
  C: [
    { id: 9, name: "Argentina", country: "ARG", attackStrength: 1.5, defenseStrength: 0.75, fifaRanking: 2 },
    { id: 10, name: "Ecuador", country: "ECU", attackStrength: 1.0, defenseStrength: 1.0, fifaRanking: 33 },
    { id: 11, name: "Chile", country: "CHI", attackStrength: 0.95, defenseStrength: 1.05, fifaRanking: 45 },
    { id: 12, name: "Perú", country: "PER", attackStrength: 0.9, defenseStrength: 1.05, fifaRanking: 40 },
  ],
  D: [
    { id: 13, name: "Francia", country: "FRA", attackStrength: 1.5, defenseStrength: 0.72, fifaRanking: 3 },
    { id: 14, name: "Bélgica", country: "BEL", attackStrength: 1.3, defenseStrength: 0.82, fifaRanking: 5 },
    { id: 15, name: "Senegal", country: "SEN", attackStrength: 1.1, defenseStrength: 0.92, fifaRanking: 20 },
    { id: 16, name: "Túnez", country: "TUN", attackStrength: 0.95, defenseStrength: 1.0, fifaRanking: 30 },
  ],
  E: [
    { id: 17, name: "Alemania", country: "GER", attackStrength: 1.4, defenseStrength: 0.78, fifaRanking: 4 },
    { id: 18, name: "Portugal", country: "POR", attackStrength: 1.38, defenseStrength: 0.8, fifaRanking: 6 },
    { id: 19, name: "Turquía", country: "TUR", attackStrength: 1.05, defenseStrength: 0.95, fifaRanking: 28 },
    { id: 20, name: "Hungría", country: "HUN", attackStrength: 0.9, defenseStrength: 1.05, fifaRanking: 32 },
  ],
  F: [
    { id: 21, name: "Brasil", country: "BRA", attackStrength: 1.42, defenseStrength: 0.76, fifaRanking: 5 },
    { id: 22, name: "Uruguay", country: "URU", attackStrength: 1.15, defenseStrength: 0.88, fifaRanking: 17 },
    { id: 23, name: "Colombia", country: "COL", attackStrength: 1.12, defenseStrength: 0.9, fifaRanking: 19 },
    { id: 24, name: "Bolivia", country: "BOL", attackStrength: 0.8, defenseStrength: 1.15, fifaRanking: 60 },
  ],
  G: [
    { id: 25, name: "Inglaterra", country: "ENG", attackStrength: 1.38, defenseStrength: 0.8, fifaRanking: 5 },
    { id: 26, name: "Países Bajos", country: "NED", attackStrength: 1.32, defenseStrength: 0.82, fifaRanking: 7 },
    { id: 27, name: "Suiza", country: "SUI", attackStrength: 1.05, defenseStrength: 0.9, fifaRanking: 22 },
    { id: 28, name: "Serbia", country: "SRB", attackStrength: 1.08, defenseStrength: 0.95, fifaRanking: 25 },
  ],
  H: [
    { id: 29, name: "Italia", country: "ITA", attackStrength: 1.25, defenseStrength: 0.82, fifaRanking: 9 },
    { id: 30, name: "Polonia", country: "POL", attackStrength: 1.05, defenseStrength: 0.95, fifaRanking: 27 },
    { id: 31, name: "Ucrania", country: "UKR", attackStrength: 1.08, defenseStrength: 0.92, fifaRanking: 21 },
    { id: 32, name: "Escocia", country: "SCO", attackStrength: 0.95, defenseStrength: 1.0, fifaRanking: 35 },
  ],
  I: [
    { id: 33, name: "Japón", country: "JPN", attackStrength: 1.12, defenseStrength: 0.9, fifaRanking: 18 },
    { id: 34, name: "Corea del Sur", country: "KOR", attackStrength: 1.08, defenseStrength: 0.92, fifaRanking: 23 },
    { id: 35, name: "Arabia Saudita", country: "KSA", attackStrength: 0.85, defenseStrength: 1.1, fifaRanking: 56 },
    { id: 36, name: "Australia", country: "AUS", attackStrength: 1.05, defenseStrength: 0.95, fifaRanking: 24 },
  ],
  J: [
    { id: 37, name: "Costa de Marfil", country: "CIV", attackStrength: 0.92, defenseStrength: 1.02, fifaRanking: 48 },
    { id: 38, name: "Nigeria", country: "NGA", attackStrength: 1.0, defenseStrength: 1.0, fifaRanking: 38 },
    { id: 39, name: "Sudáfrica", country: "RSA", attackStrength: 0.85, defenseStrength: 1.1, fifaRanking: 59 },
    { id: 40, name: "Ghana", country: "GHA", attackStrength: 0.88, defenseStrength: 1.08, fifaRanking: 66 },
  ],
  K: [
    { id: 41, name: "Venezuela", country: "VEN", attackStrength: 0.95, defenseStrength: 1.02, fifaRanking: 44 },
    { id: 42, name: "Honduras", country: "HON", attackStrength: 0.82, defenseStrength: 1.12, fifaRanking: 72 },
    { id: 43, name: "Panamá", country: "PAN", attackStrength: 0.88, defenseStrength: 1.08, fifaRanking: 50 },
    { id: 44, name: "Costa Rica", country: "CRC", attackStrength: 0.9, defenseStrength: 1.05, fifaRanking: 52 },
  ],
  L: [
    { id: 45, name: "Austria", country: "AUT", attackStrength: 1.08, defenseStrength: 0.92, fifaRanking: 26 },
    { id: 46, name: "Dinamarca", country: "DEN", attackStrength: 1.18, defenseStrength: 0.88, fifaRanking: 12 },
    { id: 47, name: "Eslovenia", country: "SVN", attackStrength: 0.88, defenseStrength: 1.05, fifaRanking: 54 },
    { id: 48, name: "Kazajistán", country: "KAZ", attackStrength: 0.7, defenseStrength: 1.2, fifaRanking: 102 },
  ],
}

function projectStandings(teams: typeof TEAMS_BY_GROUP[string]) {
  type Standing = { id: number; name: string; country: string; pts: number; xPts: number; qualify: number }
  const standings: Record<number, Standing> = {}
  for (const t of teams) {
    standings[t.id] = { id: t.id, name: t.name, country: t.country, pts: 0, xPts: 0, qualify: 0 }
  }

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const h = teams[i], a = teams[j]
      const pred = predictMatch(h, a)
      standings[h.id].xPts += pred.homeWin * 3 + pred.draw
      standings[a.id].xPts += pred.awayWin * 3 + pred.draw
    }
  }

  return Object.values(standings).sort((a, b) => b.xPts - a.xPts)
}

function pct(n: number) { return `${(n * 100).toFixed(0)}%` }

export default function GruposPage() {
  const groups = Object.entries(TEAMS_BY_GROUP)

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 12, letterSpacing: "0.12em", color: "var(--accent)", textTransform: "uppercase", marginBottom: 8 }}>
          Proyección estadística · Puntos esperados por grupo
        </p>
        <h1 className="stat-number" style={{ fontSize: "clamp(36px, 6vw, 72px)", lineHeight: 1 }}>
          Fase de <span style={{ color: "var(--accent)" }}>Grupos</span>
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {groups.map(([groupName, teams]) => {
          const standings = projectStandings(teams)
          return (
            <div key={groupName} style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              {/* Group header */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}>
                <span className="stat-number" style={{
                  fontSize: 32,
                  color: "var(--accent)",
                  lineHeight: 1,
                  minWidth: 28,
                }}>
                  {groupName}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Grupo {groupName}
                </span>
              </div>

              {/* Standings */}
              <div>
                {standings.map((s, i) => {
                  const qualify = i < 2
                  return (
                    <div key={s.id} style={{
                      display: "grid",
                      gridTemplateColumns: "20px 1fr 52px",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 16px",
                      borderBottom: i < standings.length - 1 ? "1px solid var(--border)" : "none",
                      borderLeft: qualify ? "3px solid var(--accent)" : "3px solid transparent",
                      opacity: qualify ? 1 : 0.6,
                    }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                        {i + 1}
                      </span>
                      <div>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {s.name}
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{
                              height: "100%",
                              width: `${Math.min((s.xPts / 9) * 100, 100)}%`,
                              background: qualify ? "var(--accent)" : "var(--text-muted)",
                              borderRadius: 2,
                            }} />
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="stat-number" style={{ fontSize: 20, color: qualify ? "var(--accent)" : "var(--text)" }}>
                          {s.xPts.toFixed(1)}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em" }}>xPTS</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Classification note */}
              <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, background: "var(--accent)", borderRadius: 1 }} />
                <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Clasifican top 2
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
