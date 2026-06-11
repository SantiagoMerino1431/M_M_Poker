import { notFound } from "next/navigation"
import Link from "next/link"
import { TEAMS, parseFixtureId, getStadium, getMatchDate, getMatchTime } from "@/lib/data/teams"
import { predictMatch } from "@/lib/model/poisson"
import { predictCards } from "@/lib/model/cards"
import { predictCorners } from "@/lib/model/corners"
import type { MatchData } from "@/lib/types"

function pct(n: number) { return `${(n * 100).toFixed(1)}%` }
function pct0(n: number) { return `${(n * 100).toFixed(0)}%` }

function Bar({ value, color = "var(--accent)" }: { value: number; color?: string }) {
  return (
    <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${Math.min(value * 100, 100)}%`, background: color, borderRadius: 2, transition: "width 0.5s" }} />
    </div>
  )
}

function StatRow({ label, val, max = 1, color }: { label: string; val: number; max?: number; color?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 56px", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <Bar value={val / max} color={color} />
      <span className="stat-number" style={{ fontSize: 20, textAlign: "right", color: color || "var(--text)" }}>{pct0(val)}</span>
    </div>
  )
}

export default async function PartidoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsed = parseFixtureId(id)
  if (!parsed) notFound()

  const home = TEAMS[parsed.homeId]
  const away = TEAMS[parsed.awayId]
  if (!home || !away) notFound()

  if (home.group !== away.group) notFound()

  const pred = predictMatch(home, away)

  const matchData: MatchData = {
    fixture: { id: 0, date: "", stadium: "", city: "", altitudeM: 0, homeTeamId: home.id, awayTeamId: away.id, stage: "" },
    teams: {
      home: { id: home.id, name: home.name, country: home.country, groupName: home.group, fifaRanking: home.fifaRanking, attackStrength: home.attackStrength, defenseStrength: home.defenseStrength },
      away: { id: away.id, name: away.name, country: away.country, groupName: away.group, fifaRanking: away.fifaRanking, attackStrength: away.attackStrength, defenseStrength: away.defenseStrength },
    },
    h2h: [], homeForm: [], awayForm: [],
    injuries: { home: [], away: [] },
    lineups: { home: null, away: null },
    referee: null, weather: null, odds: [],
    dataQuality: 40,
    fetchedAt: new Date().toISOString(),
  }

  const cards = predictCards(matchData, home.group <= "F" ? 1.0 : 1.05)
  const corners = predictCorners(matchData)
  const stadium = getStadium(home.id, away.id)
  const date = getMatchDate(home.id, away.id)
  const time = getMatchTime(home.id)

  const topScores = pred.exactScores.slice(0, 8)
  const maxScoreProb = topScores[0]?.prob || 0.01

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: 12, color: "var(--text-muted)" }}>
        <Link href="/partidos" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Partidos</Link>
        <span>/</span>
        <span style={{ color: "var(--accent)" }}>Grupo {home.group}</span>
        <span>/</span>
        <span>{home.name} vs {away.name}</span>
      </div>

      {/* Match header */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "28px 28px 20px", marginBottom: 20 }}>
        {/* Group & phase badge */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 11, background: "var(--accent-dim)", color: "var(--accent)", padding: "3px 10px", border: "1px solid rgba(232,255,60,0.2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Grupo {home.group}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", border: "1px solid var(--border)", padding: "3px 10px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Fase de Grupos
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", border: "1px solid var(--border)", padding: "3px 10px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            FIFA World Cup 2026
          </span>
        </div>

        {/* Teams */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div>
            <div className="stat-number" style={{ fontSize: "clamp(22px, 4vw, 40px)", textTransform: "uppercase", lineHeight: 1.1 }}>
              {home.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              {home.country} · #{home.fifaRanking} FIFA · Local
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div className="stat-number" style={{ fontSize: 32, color: "var(--text-muted)", letterSpacing: "0.1em" }}>VS</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, letterSpacing: "0.06em" }}>
              Pendiente
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="stat-number" style={{ fontSize: "clamp(22px, 4vw, 40px)", textTransform: "uppercase", lineHeight: 1.1 }}>
              {away.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              {away.country} · #{away.fifaRanking} FIFA · Visitante
            </div>
          </div>
        </div>

        {/* Match info */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1, background: "var(--border)" }}>
          {[
            { label: "Fecha", val: date },
            { label: "Hora (ET)", val: time },
            { label: "Sede", val: stadium },
            { label: "Estado", val: "Programado" },
          ].map(({ label, val }) => (
            <div key={label} style={{ background: "var(--surface-2)", padding: "10px 14px" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* API note */}
        <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(232,255,60,0.04)", border: "1px solid rgba(232,255,60,0.1)", fontSize: 11, color: "var(--text-muted)" }}>
          Fecha y sede son orientativas. Conecta <code style={{ color: "var(--accent)" }}>RAPIDAPI_KEY</code> en <code>.env.local</code> para datos oficiales en tiempo real.
        </div>
      </div>

      {/* Prediction grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>

        {/* Result 1X2 */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px" }}>
          <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
            Resultado 1X2
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[
              { label: "1 Local", val: pred.homeWin, color: "var(--win)" },
              { label: "X Empate", val: pred.draw, color: "var(--draw)" },
              { label: "2 Visitante", val: pred.awayWin, color: "var(--loss)" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: "center", padding: "14px 8px", background: "var(--surface-2)", borderBottom: `3px solid ${color}` }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.06em" }}>{label}</div>
                <div className="stat-number" style={{ fontSize: 32, color }}>{pct0(val)}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{pct(val)}</div>
              </div>
            ))}
          </div>
          {/* Double chance */}
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
            {[
              { label: "1X", val: pred.homeWin + pred.draw },
              { label: "12", val: pred.homeWin + pred.awayWin },
              { label: "X2", val: pred.draw + pred.awayWin },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", background: "var(--bg)" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Doble {label}</span>
                <span className="stat-number" style={{ fontSize: 15 }}>{pct0(val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* xG */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px" }}>
          <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
            Goles Esperados (xG)
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: home.name, val: pred.expectedHomeGoals, color: "var(--accent)" },
              { label: away.name, val: pred.expectedAwayGoals, color: "var(--text-muted)" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: "center", padding: "14px", background: "var(--surface-2)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label.split(" ")[0]}
                </div>
                <div className="stat-number" style={{ fontSize: 40, color, lineHeight: 1 }}>{val.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>xG</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", width: 80 }}>{home.name.split(" ")[0]}</div>
            <div style={{ flex: 1, display: "flex", gap: 2 }}>
              <div style={{ height: 6, background: "var(--accent)", borderRadius: "2px 0 0 2px", width: `${(pred.expectedHomeGoals / (pred.expectedHomeGoals + pred.expectedAwayGoals)) * 100}%` }} />
              <div style={{ height: 6, background: "var(--text-muted)", borderRadius: "0 2px 2px 0", flex: 1 }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", width: 80, textAlign: "right" }}>{away.name.split(" ")[0]}</div>
          </div>
        </div>
      </div>

      {/* Over/Under + BTTS + Clean Sheet */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px" }}>
          <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
            Over / Under · Goles
          </h3>
          <StatRow label="+1.5 Goles"  val={pred.over15} color="var(--win)" />
          <StatRow label="+2.5 Goles"  val={pred.over25} color="var(--accent)" />
          <StatRow label="+3.5 Goles"  val={pred.over35} color="var(--draw)" />
          <div style={{ marginTop: 12 }}>
            <StatRow label="BTTS (Ambos)" val={pred.btts} color="var(--accent)" />
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px" }}>
          <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
            Clean Sheet · Tarjetas · Corners
          </h3>
          <StatRow label="CS Local"    val={pred.cleanSheetHome} color="var(--win)" />
          <StatRow label="CS Visitante" val={pred.cleanSheetAway} color="var(--win)" />
          <StatRow label="+3.5 Tarjetas" val={cards.over35} color="var(--loss)" />
          <StatRow label="Tarjeta Roja" val={cards.redCardProb} color="var(--loss)" />
          <div style={{ marginTop: 12, padding: "8px 0", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Corners esperados</span>
            <span className="stat-number" style={{ fontSize: 20, color: "var(--accent)" }}>{corners.expectedCorners.toFixed(1)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Línea corners</span>
            <span style={{ fontSize: 13 }}>Over 9.5 → {pct0(corners.over95)}</span>
          </div>
        </div>
      </div>

      {/* Exact scores */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px", marginBottom: 12 }}>
        <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
          Marcadores Exactos · Top 8
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
          {topScores.map((s, i) => (
            <div key={s.score} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px",
              background: i === 0 ? "var(--accent-dim)" : "var(--surface-2)",
              border: i === 0 ? "1px solid rgba(232,255,60,0.25)" : "1px solid transparent",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", width: 16 }}>#{i + 1}</span>
                <span className="stat-number" style={{ fontSize: 22, color: i === 0 ? "var(--accent)" : "var(--text)" }}>
                  {s.score}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="stat-number" style={{ fontSize: 16 }}>{pct(s.prob)}</div>
                <div style={{ height: 3, width: 60, background: "var(--border)", borderRadius: 2, marginTop: 3 }}>
                  <div style={{ height: "100%", width: `${(s.prob / maxScoreProb) * 100}%`, background: i === 0 ? "var(--accent)" : "var(--text-muted)", borderRadius: 2 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model info */}
      <div style={{ padding: "12px 16px", border: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
        <span>Modelo: Distribución de Poisson · Fuerza ofensiva/defensiva · Ranking FIFA</span>
        <span style={{ color: "var(--accent)" }}>Análisis estadístico de entretenimiento</span>
      </div>
    </div>
  )
}
