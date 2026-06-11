import { predictMatch } from "@/lib/model/poisson"

type Team = { id: number; name: string; country: string; attackStrength: number; defenseStrength: number; fifaRanking: number }

const TEAMS_BY_GROUP: Record<string, Team[]> = {
  A: [
    { id: 1,  name: "México",               country: "MEX", attackStrength: 1.10, defenseStrength: 1.00, fifaRanking: 16 },
    { id: 2,  name: "Sudáfrica",            country: "RSA", attackStrength: 0.85, defenseStrength: 1.10, fifaRanking: 59 },
    { id: 3,  name: "República de Corea",   country: "KOR", attackStrength: 1.08, defenseStrength: 0.92, fifaRanking: 23 },
    { id: 4,  name: "Chequia",              country: "CZE", attackStrength: 0.95, defenseStrength: 1.00, fifaRanking: 40 },
  ],
  B: [
    { id: 5,  name: "Canadá",               country: "CAN", attackStrength: 0.95, defenseStrength: 1.05, fifaRanking: 43 },
    { id: 6,  name: "Bosnia y Herzegovina", country: "BIH", attackStrength: 0.85, defenseStrength: 1.10, fifaRanking: 70 },
    { id: 7,  name: "Catar",                country: "QAT", attackStrength: 0.82, defenseStrength: 1.12, fifaRanking: 58 },
    { id: 8,  name: "Suiza",                country: "SUI", attackStrength: 1.05, defenseStrength: 0.90, fifaRanking: 22 },
  ],
  C: [
    { id: 9,  name: "Brasil",               country: "BRA", attackStrength: 1.42, defenseStrength: 0.76, fifaRanking: 5  },
    { id: 10, name: "Marruecos",            country: "MAR", attackStrength: 1.05, defenseStrength: 0.90, fifaRanking: 14 },
    { id: 11, name: "Haití",                country: "HAI", attackStrength: 0.75, defenseStrength: 1.20, fifaRanking: 85 },
    { id: 12, name: "Escocia",              country: "SCO", attackStrength: 0.95, defenseStrength: 1.00, fifaRanking: 35 },
  ],
  D: [
    { id: 13, name: "Estados Unidos",       country: "USA", attackStrength: 1.15, defenseStrength: 0.95, fifaRanking: 13 },
    { id: 14, name: "Paraguay",             country: "PAR", attackStrength: 0.88, defenseStrength: 1.08, fifaRanking: 57 },
    { id: 15, name: "Australia",            country: "AUS", attackStrength: 1.05, defenseStrength: 0.95, fifaRanking: 24 },
    { id: 16, name: "Turquía",              country: "TUR", attackStrength: 1.05, defenseStrength: 0.95, fifaRanking: 28 },
  ],
  E: [
    { id: 17, name: "Alemania",             country: "GER", attackStrength: 1.40, defenseStrength: 0.78, fifaRanking: 4  },
    { id: 18, name: "Curazao",              country: "CUW", attackStrength: 0.72, defenseStrength: 1.22, fifaRanking: 85 },
    { id: 19, name: "Costa de Marfil",      country: "CIV", attackStrength: 0.92, defenseStrength: 1.02, fifaRanking: 48 },
    { id: 20, name: "Ecuador",              country: "ECU", attackStrength: 1.00, defenseStrength: 1.00, fifaRanking: 33 },
  ],
  F: [
    { id: 21, name: "Países Bajos",         country: "NED", attackStrength: 1.32, defenseStrength: 0.82, fifaRanking: 7  },
    { id: 22, name: "Japón",                country: "JPN", attackStrength: 1.12, defenseStrength: 0.90, fifaRanking: 18 },
    { id: 23, name: "Suecia",               country: "SWE", attackStrength: 1.08, defenseStrength: 0.92, fifaRanking: 25 },
    { id: 24, name: "Túnez",                country: "TUN", attackStrength: 0.95, defenseStrength: 1.00, fifaRanking: 30 },
  ],
  G: [
    { id: 25, name: "Bélgica",              country: "BEL", attackStrength: 1.30, defenseStrength: 0.82, fifaRanking: 5  },
    { id: 26, name: "Egipto",               country: "EGY", attackStrength: 0.95, defenseStrength: 1.02, fifaRanking: 38 },
    { id: 27, name: "RI de Irán",           country: "IRN", attackStrength: 1.00, defenseStrength: 0.98, fifaRanking: 20 },
    { id: 28, name: "Nueva Zelanda",        country: "NZL", attackStrength: 0.75, defenseStrength: 1.20, fifaRanking: 95 },
  ],
  H: [
    { id: 29, name: "España",               country: "ESP", attackStrength: 1.45, defenseStrength: 0.70, fifaRanking: 1  },
    { id: 30, name: "Islas de Cabo Verde",  country: "CPV", attackStrength: 0.82, defenseStrength: 1.12, fifaRanking: 68 },
    { id: 31, name: "Arabia Saudí",         country: "KSA", attackStrength: 0.85, defenseStrength: 1.10, fifaRanking: 56 },
    { id: 32, name: "Uruguay",              country: "URU", attackStrength: 1.15, defenseStrength: 0.88, fifaRanking: 17 },
  ],
  I: [
    { id: 33, name: "Francia",              country: "FRA", attackStrength: 1.50, defenseStrength: 0.72, fifaRanking: 3  },
    { id: 34, name: "Senegal",              country: "SEN", attackStrength: 1.10, defenseStrength: 0.92, fifaRanking: 20 },
    { id: 35, name: "Irak",                 country: "IRQ", attackStrength: 0.80, defenseStrength: 1.15, fifaRanking: 70 },
    { id: 36, name: "Noruega",              country: "NOR", attackStrength: 1.00, defenseStrength: 1.00, fifaRanking: 34 },
  ],
  J: [
    { id: 37, name: "Argentina",            country: "ARG", attackStrength: 1.50, defenseStrength: 0.75, fifaRanking: 2  },
    { id: 38, name: "Argelia",              country: "ALG", attackStrength: 0.90, defenseStrength: 1.05, fifaRanking: 50 },
    { id: 39, name: "Austria",              country: "AUT", attackStrength: 1.08, defenseStrength: 0.92, fifaRanking: 26 },
    { id: 40, name: "Jordania",             country: "JOR", attackStrength: 0.78, defenseStrength: 1.15, fifaRanking: 80 },
  ],
  K: [
    { id: 41, name: "Portugal",             country: "POR", attackStrength: 1.38, defenseStrength: 0.80, fifaRanking: 6  },
    { id: 42, name: "RD Congo",             country: "COD", attackStrength: 0.85, defenseStrength: 1.10, fifaRanking: 62 },
    { id: 43, name: "Uzbekistán",           country: "UZB", attackStrength: 0.80, defenseStrength: 1.15, fifaRanking: 72 },
    { id: 44, name: "Colombia",             country: "COL", attackStrength: 1.12, defenseStrength: 0.90, fifaRanking: 19 },
  ],
  L: [
    { id: 45, name: "Inglaterra",           country: "ENG", attackStrength: 1.38, defenseStrength: 0.80, fifaRanking: 5  },
    { id: 46, name: "Croacia",              country: "CRO", attackStrength: 1.20, defenseStrength: 0.85, fifaRanking: 10 },
    { id: 47, name: "Ghana",                country: "GHA", attackStrength: 0.88, defenseStrength: 1.08, fifaRanking: 66 },
    { id: 48, name: "Panamá",               country: "PAN", attackStrength: 0.88, defenseStrength: 1.08, fifaRanking: 50 },
  ],
}

function projectStandings(teams: Team[]) {
  type Standing = { id: number; name: string; country: string; xPts: number }
  const standings: Record<number, Standing> = {}
  for (const t of teams) {
    standings[t.id] = { id: t.id, name: t.name, country: t.country, xPts: 0 }
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
          Distribución oficial · 12 grupos · 48 selecciones
        </p>
        <h1 className="stat-number" style={{ fontSize: "clamp(36px, 6vw, 72px)", lineHeight: 1 }}>
          Fase de <span style={{ color: "var(--accent)" }}>Grupos</span>
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>
          Puntos esperados (xPTS) calculados con modelo Poisson sobre todas las combinaciones de partidos de cada grupo.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {groups.map(([groupName, teams]) => {
          const standings = projectStandings(teams)
          const maxXPts = standings[0]?.xPts || 1
          return (
            <div key={groupName} style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              {/* Header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}>
                <span className="stat-number" style={{ fontSize: 32, color: "var(--accent)", lineHeight: 1, minWidth: 28 }}>
                  {groupName}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Grupo {groupName}
                </span>
              </div>

              {/* Standings */}
              {standings.map((s, i) => {
                const qualify = i < 2
                return (
                  <div key={s.id} style={{
                    display: "grid",
                    gridTemplateColumns: "20px 1fr 60px",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 16px",
                    borderBottom: i < standings.length - 1 ? "1px solid var(--border)" : "none",
                    borderLeft: qualify ? "3px solid var(--accent)" : "3px solid transparent",
                    opacity: qualify ? 1 : 0.55,
                  }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                      {i + 1}
                    </span>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>
                        {s.name}
                      </div>
                      <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${(s.xPts / maxXPts) * 100}%`,
                          background: qualify ? "var(--accent)" : "var(--text-muted)",
                          borderRadius: 2,
                        }} />
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

              {/* Footer */}
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
