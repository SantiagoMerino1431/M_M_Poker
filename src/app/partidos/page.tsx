import { predictMatch } from "@/lib/model/poisson"

type Team = { id: number; name: string; country: string; attackStrength: number; defenseStrength: number; fifaRanking: number }

const TEAMS: Record<number, Team> = {
  1:  { id: 1,  name: "México",               country: "MEX", attackStrength: 1.10, defenseStrength: 1.00, fifaRanking: 16 },
  2:  { id: 2,  name: "Sudáfrica",            country: "RSA", attackStrength: 0.85, defenseStrength: 1.10, fifaRanking: 59 },
  3:  { id: 3,  name: "República de Corea",   country: "KOR", attackStrength: 1.08, defenseStrength: 0.92, fifaRanking: 23 },
  4:  { id: 4,  name: "Chequia",              country: "CZE", attackStrength: 0.95, defenseStrength: 1.00, fifaRanking: 40 },
  5:  { id: 5,  name: "Canadá",               country: "CAN", attackStrength: 0.95, defenseStrength: 1.05, fifaRanking: 43 },
  6:  { id: 6,  name: "Bosnia y Herzegovina", country: "BIH", attackStrength: 0.85, defenseStrength: 1.10, fifaRanking: 70 },
  7:  { id: 7,  name: "Catar",                country: "QAT", attackStrength: 0.82, defenseStrength: 1.12, fifaRanking: 58 },
  8:  { id: 8,  name: "Suiza",                country: "SUI", attackStrength: 1.05, defenseStrength: 0.90, fifaRanking: 22 },
  9:  { id: 9,  name: "Brasil",               country: "BRA", attackStrength: 1.42, defenseStrength: 0.76, fifaRanking: 5  },
  10: { id: 10, name: "Marruecos",            country: "MAR", attackStrength: 1.05, defenseStrength: 0.90, fifaRanking: 14 },
  11: { id: 11, name: "Haití",                country: "HAI", attackStrength: 0.75, defenseStrength: 1.20, fifaRanking: 85 },
  12: { id: 12, name: "Escocia",              country: "SCO", attackStrength: 0.95, defenseStrength: 1.00, fifaRanking: 35 },
  13: { id: 13, name: "Estados Unidos",       country: "USA", attackStrength: 1.15, defenseStrength: 0.95, fifaRanking: 13 },
  14: { id: 14, name: "Paraguay",             country: "PAR", attackStrength: 0.88, defenseStrength: 1.08, fifaRanking: 57 },
  15: { id: 15, name: "Australia",            country: "AUS", attackStrength: 1.05, defenseStrength: 0.95, fifaRanking: 24 },
  16: { id: 16, name: "Turquía",              country: "TUR", attackStrength: 1.05, defenseStrength: 0.95, fifaRanking: 28 },
  17: { id: 17, name: "Alemania",             country: "GER", attackStrength: 1.40, defenseStrength: 0.78, fifaRanking: 4  },
  18: { id: 18, name: "Curazao",              country: "CUW", attackStrength: 0.72, defenseStrength: 1.22, fifaRanking: 85 },
  19: { id: 19, name: "Costa de Marfil",      country: "CIV", attackStrength: 0.92, defenseStrength: 1.02, fifaRanking: 48 },
  20: { id: 20, name: "Ecuador",              country: "ECU", attackStrength: 1.00, defenseStrength: 1.00, fifaRanking: 33 },
  21: { id: 21, name: "Países Bajos",         country: "NED", attackStrength: 1.32, defenseStrength: 0.82, fifaRanking: 7  },
  22: { id: 22, name: "Japón",                country: "JPN", attackStrength: 1.12, defenseStrength: 0.90, fifaRanking: 18 },
  23: { id: 23, name: "Suecia",               country: "SWE", attackStrength: 1.08, defenseStrength: 0.92, fifaRanking: 25 },
  24: { id: 24, name: "Túnez",                country: "TUN", attackStrength: 0.95, defenseStrength: 1.00, fifaRanking: 30 },
  25: { id: 25, name: "Bélgica",              country: "BEL", attackStrength: 1.30, defenseStrength: 0.82, fifaRanking: 5  },
  26: { id: 26, name: "Egipto",               country: "EGY", attackStrength: 0.95, defenseStrength: 1.02, fifaRanking: 38 },
  27: { id: 27, name: "RI de Irán",           country: "IRN", attackStrength: 1.00, defenseStrength: 0.98, fifaRanking: 20 },
  28: { id: 28, name: "Nueva Zelanda",        country: "NZL", attackStrength: 0.75, defenseStrength: 1.20, fifaRanking: 95 },
  29: { id: 29, name: "España",               country: "ESP", attackStrength: 1.45, defenseStrength: 0.70, fifaRanking: 1  },
  30: { id: 30, name: "Islas de Cabo Verde",  country: "CPV", attackStrength: 0.82, defenseStrength: 1.12, fifaRanking: 68 },
  31: { id: 31, name: "Arabia Saudí",         country: "KSA", attackStrength: 0.85, defenseStrength: 1.10, fifaRanking: 56 },
  32: { id: 32, name: "Uruguay",              country: "URU", attackStrength: 1.15, defenseStrength: 0.88, fifaRanking: 17 },
  33: { id: 33, name: "Francia",              country: "FRA", attackStrength: 1.50, defenseStrength: 0.72, fifaRanking: 3  },
  34: { id: 34, name: "Senegal",              country: "SEN", attackStrength: 1.10, defenseStrength: 0.92, fifaRanking: 20 },
  35: { id: 35, name: "Irak",                 country: "IRQ", attackStrength: 0.80, defenseStrength: 1.15, fifaRanking: 70 },
  36: { id: 36, name: "Noruega",              country: "NOR", attackStrength: 1.00, defenseStrength: 1.00, fifaRanking: 34 },
  37: { id: 37, name: "Argentina",            country: "ARG", attackStrength: 1.50, defenseStrength: 0.75, fifaRanking: 2  },
  38: { id: 38, name: "Argelia",              country: "ALG", attackStrength: 0.90, defenseStrength: 1.05, fifaRanking: 50 },
  39: { id: 39, name: "Austria",              country: "AUT", attackStrength: 1.08, defenseStrength: 0.92, fifaRanking: 26 },
  40: { id: 40, name: "Jordania",             country: "JOR", attackStrength: 0.78, defenseStrength: 1.15, fifaRanking: 80 },
  41: { id: 41, name: "Portugal",             country: "POR", attackStrength: 1.38, defenseStrength: 0.80, fifaRanking: 6  },
  42: { id: 42, name: "RD Congo",             country: "COD", attackStrength: 0.85, defenseStrength: 1.10, fifaRanking: 62 },
  43: { id: 43, name: "Uzbekistán",           country: "UZB", attackStrength: 0.80, defenseStrength: 1.15, fifaRanking: 72 },
  44: { id: 44, name: "Colombia",             country: "COL", attackStrength: 1.12, defenseStrength: 0.90, fifaRanking: 19 },
  45: { id: 45, name: "Inglaterra",           country: "ENG", attackStrength: 1.38, defenseStrength: 0.80, fifaRanking: 5  },
  46: { id: 46, name: "Croacia",              country: "CRO", attackStrength: 1.20, defenseStrength: 0.85, fifaRanking: 10 },
  47: { id: 47, name: "Ghana",                country: "GHA", attackStrength: 0.88, defenseStrength: 1.08, fifaRanking: 66 },
  48: { id: 48, name: "Panamá",               country: "PAN", attackStrength: 0.88, defenseStrength: 1.08, fifaRanking: 50 },
}

const GROUP_IDS: Record<string, number[]> = {
  A: [1, 2, 3, 4],
  B: [5, 6, 7, 8],
  C: [9, 10, 11, 12],
  D: [13, 14, 15, 16],
  E: [17, 18, 19, 20],
  F: [21, 22, 23, 24],
  G: [25, 26, 27, 28],
  H: [29, 30, 31, 32],
  I: [33, 34, 35, 36],
  J: [37, 38, 39, 40],
  K: [41, 42, 43, 44],
  L: [45, 46, 47, 48],
}

function getGroupFixtures(ids: number[]) {
  const fixtures = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const home = TEAMS[ids[i]]
      const away = TEAMS[ids[j]]
      const pred = predictMatch(home, away)
      fixtures.push({ home, away, pred })
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
              {fixtures.map(({ home, away, pred }) => (
                <div key={`${home.id}-${away.id}`} style={{
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
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
