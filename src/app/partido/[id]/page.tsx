import { getAnalysisForFixture, getFixtureDetails } from "../../actions"
import { getBankrollState } from "@/lib/kelly/bankroll"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Bar, StatRow } from "@/components/StatBar"
import { MarketBettingCard } from "@/components/MarketBettingCard"
import type { MarketResult } from "@/lib/types"

function pct0(n: number) { return `${Math.round(n * 100)}%` }
function fmt(d: string | null) {
  if (!d) return "Por confirmar"
  const date = new Date(d)
  return date.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}
function fmtTime(d: string | null) {
  if (!d) return "--:--"
  return new Date(d).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })
}

function find(markets: MarketResult[], name: string, sel: string) {
  return markets.find(m => m.name === name && m.selection === sel)
}
function prob(markets: MarketResult[], name: string, sel: string) {
  return find(markets, name, sel)?.ourProbability ?? 0
}

function cleanSheet(lambda: number) { return Math.exp(-lambda) }

function selectionLabel(name: string, sel: string, home: string, away: string): string {
  if (name === "1X2") {
    if (sel === "home") return `${home} gana`
    if (sel === "draw") return "Empate"
    if (sel === "away") return `${away} gana`
  }
  if (name === "Over/Under") return sel.replace("over_", "Más de ").replace("under_", "Menos de ").replace("_", ".")
  if (name === "BTTS") return sel === "yes" ? "Ambos anotan" : "No ambos anotan"
  if (name === "Marcador Exacto") return `Exacto ${sel}`
  return `${name} ${sel}`
}

function buildExplanation(
  m: MarketResult,
  lH: number, lA: number,
  adjustments: string[],
  confidence: number,
  home: string, away: string
): string {
  const lines: string[] = []
  const totalXG = lH + lA
  const edge = m.bookmakerProbability ? ((m.ourProbability - m.bookmakerProbability) * 100).toFixed(1) : null

  if (m.name === "1X2" && m.selection === "home") {
    lines.push(`El modelo asigna ${(m.ourProbability * 100).toFixed(1)}% de probabilidad a ${home}, vs ${m.bookmakerProbability ? (m.bookmakerProbability * 100).toFixed(1) + "% implícito en la cuota" : "la cuota ingresada"}.`)
    lines.push(`Con λ=${lH.toFixed(2)} goles esperados para local frente a λ=${lA.toFixed(2)} del visitante, el modelo ve clara ventaja ofensiva.`)
  } else if (m.name === "1X2" && m.selection === "away") {
    lines.push(`${away} tiene ${(m.ourProbability * 100).toFixed(1)}% según el modelo — el mercado está sobrevalorando al local.`)
    lines.push(`λ visitante ${lA.toFixed(2)} vs λ local ${lH.toFixed(2)}.`)
  } else if (m.name === "1X2" && m.selection === "draw") {
    lines.push(`Empate con ${(m.ourProbability * 100).toFixed(1)}%: el modelo ve equipos equilibrados (λ ${lH.toFixed(2)} vs ${lA.toFixed(2)}).`)
  } else if (m.name === "Over/Under" && m.selection.includes("over")) {
    const line = m.selection.replace("over_", "").replace("_", ".")
    lines.push(`Se esperan ${totalXG.toFixed(2)} goles totales (λ ${lH.toFixed(2)}+${lA.toFixed(2)}), dando ${(m.ourProbability * 100).toFixed(1)}% de probabilidad a más de ${line}.`)
    lines.push(`El modelo ve un partido con buen ritmo ofensivo de ambos lados.`)
  } else if (m.name === "BTTS" && m.selection === "yes") {
    lines.push(`Con ${home} (λ=${lH.toFixed(2)}) y ${away} (λ=${lA.toFixed(2)}), la probabilidad de que ambos anoten es ${(m.ourProbability * 100).toFixed(1)}%.`)
    lines.push(`Solo sería mala apuesta si un equipo cierra defensivamente — no hay señal de eso en el modelo.`)
  } else {
    lines.push(`Probabilidad modelo: ${(m.ourProbability * 100).toFixed(1)}%. Cuota justa: ${(1 / m.ourProbability).toFixed(2)}.`)
  }

  const adjFiltered = adjustments.filter(a => !a.includes("0%"))
  if (adjFiltered.length > 0) {
    lines.push(`Ajustes aplicados: ${adjFiltered.slice(0, 3).join(", ")}.`)
  }

  if (edge) lines.push(`Edge vs casa: +${edge}%.`)
  lines.push(`Confianza del modelo: ${confidence}/100 — Kelly al 25%.`)

  return lines.join(" ")
}

export default async function PartidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fixtureId = Number(id)

  const [analysis, fixture, bankroll] = await Promise.all([
    getAnalysisForFixture(fixtureId),
    getFixtureDetails(fixtureId),
    getBankrollState(),
  ])
  if (!analysis) notFound()

  const { model, markets, alerts, confidence } = analysis
  const lH = model.lambdaHome
  const lA = model.lambdaAway

  const homeWin  = prob(markets, "1X2", "home")
  const draw     = prob(markets, "1X2", "draw")
  const awayWin  = prob(markets, "1X2", "away")
  const over15   = prob(markets, "Over/Under", "over_1.5")
  const over25   = prob(markets, "Over/Under", "over_2.5")
  const over35   = prob(markets, "Over/Under", "over_3.5")
  const btts     = prob(markets, "BTTS", "yes")
  const csHome   = cleanSheet(lA)
  const csAway   = cleanSheet(lH)

  const exactScores = markets
    .filter(m => m.name === "Marcador Exacto")
    .sort((a, b) => b.ourProbability - a.ourProbability)
    .slice(0, 8)
  const maxExact = exactScores[0]?.ourProbability ?? 0.01

  const markets1x2   = markets.filter(m => m.name === "1X2")
  const marketsOU    = markets.filter(m => m.name === "Over/Under" && ["over_1.5","over_2.5","over_3.5"].includes(m.selection))
  const marketsBTTS  = markets.filter(m => m.name === "BTTS")

  const homeName = fixture?.home.name ?? analysis.homeTeam ?? `Equipo local`
  const awayName = fixture?.away.name ?? analysis.awayTeam ?? `Equipo visitante`
  const groupLabel = fixture?.groupName ? `Grupo ${fixture.groupName}` : "Grupo"

  const confColor = confidence >= 70 ? "var(--win)" : confidence >= 40 ? "var(--draw)" : "var(--loss)"
  const confLabel = confidence >= 70 ? "ALTO" : confidence >= 40 ? "MEDIO" : "BAJO"

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 24px" }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: 12, color: "var(--text-muted)" }}>
        <Link href="/hoy" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Hoy</Link>
        <span>/</span>
        <span style={{ color: "var(--accent)" }}>{groupLabel}</span>
        <span>/</span>
        <span>{homeName} vs {awayName}</span>
      </div>

      {/* Match header */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "28px 28px 0", marginBottom: 12 }}>
        {/* Badges */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, background: "var(--accent-dim)", color: "var(--accent)", padding: "3px 10px", border: "1px solid rgba(232,255,60,0.2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {groupLabel}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", border: "1px solid var(--border)", padding: "3px 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Fase de Grupos
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", border: "1px solid var(--border)", padding: "3px 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            FIFA World Cup 2026
          </span>
          <span style={{ fontSize: 11, padding: "3px 10px", background: confColor + "22", color: confColor, border: `1px solid ${confColor}44`, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Confianza {confLabel} {confidence}
          </span>
          {analysis.isPreliminary && (
            <span style={{ fontSize: 11, padding: "3px 10px", background: "rgba(245,158,11,0.1)", color: "var(--draw)", border: "1px solid rgba(245,158,11,0.3)", textTransform: "uppercase" }}>
              Preliminar
            </span>
          )}
        </div>

        {/* Teams */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div>
            <div className="stat-number" style={{ fontSize: "clamp(22px,4vw,42px)", textTransform: "uppercase", lineHeight: 1.05 }}>
              {homeName}
            </div>
            {fixture && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                {fixture.home.country} · #{fixture.home.fifaRanking} FIFA · Local
              </div>
            )}
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="stat-number" style={{ fontSize: 28, color: "var(--text-muted)", letterSpacing: "0.1em" }}>VS</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, letterSpacing: "0.06em" }}>Pendiente</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="stat-number" style={{ fontSize: "clamp(22px,4vw,42px)", textTransform: "uppercase", lineHeight: 1.05 }}>
              {awayName}
            </div>
            {fixture && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                {fixture.away.country} · #{fixture.away.fifaRanking} FIFA · Visitante
              </div>
            )}
          </div>
        </div>

        {/* Match info bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 1, background: "var(--border)", margin: "0 -28px" }}>
          {[
            { label: "Fecha", val: fmt(fixture?.matchDate ?? null) },
            { label: "Hora (COT)", val: fmtTime(fixture?.matchDate ?? null) },
            { label: "Sede", val: fixture?.city ?? "Por confirmar" },
            { label: "Estado", val: "Programado" },
          ].map(({ label, val }) => (
            <div key={label} style={{ background: "var(--surface-2)", padding: "10px 14px" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {alerts.map((a, i) => (
            <div key={i} style={{ fontSize: 11, padding: "4px 10px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "var(--draw)" }}>
              {a}
            </div>
          ))}
        </div>
      )}

      {/* Stats grid row 1: 1X2 + xG */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>

        {/* 1X2 */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px" }}>
          <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
            Resultado 1X2
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
            {[
              { label: "1 Local", val: homeWin, color: "var(--win)" },
              { label: "X Empate", val: draw,    color: "var(--draw)" },
              { label: "2 Visitante", val: awayWin, color: "var(--loss)" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: "center", padding: "14px 8px", background: "var(--surface-2)", borderBottom: `3px solid ${color}` }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.06em" }}>{label}</div>
                <div className="stat-number" style={{ fontSize: 30, color }}>{pct0(val)}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>{(val * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
            {[
              { label: "1X", val: homeWin + draw },
              { label: "12", val: homeWin + awayWin },
              { label: "X2", val: draw + awayWin },
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
            Goles esperados (λ)
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: homeName.split(" ")[0], val: lH, color: "var(--accent)" },
              { label: awayName.split(" ")[0], val: lA, color: "var(--text-muted)" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: "center", padding: "14px", background: "var(--surface-2)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                <div className="stat-number" style={{ fontSize: 40, color, lineHeight: 1 }}>{val.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>xG</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 70 }}>{homeName.split(" ")[0]}</span>
            <div style={{ flex: 1, display: "flex", gap: 2 }}>
              <div style={{ height: 6, background: "var(--accent)", borderRadius: "2px 0 0 2px", width: `${(lH / (lH + lA)) * 100}%`, transition: "width 0.4s" }} />
              <div style={{ height: 6, background: "var(--border)", borderRadius: "0 2px 2px 0", flex: 1 }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 70, textAlign: "right" }}>{awayName.split(" ")[0]}</span>
          </div>
        </div>
      </div>

      {/* Stats grid row 2: O/U + CS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px" }}>
          <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
            Over / Under · Goles
          </h3>
          <StatRow label="+1.5 Goles" val={over15} color="var(--win)" />
          <StatRow label="+2.5 Goles" val={over25} color="var(--accent)" />
          <StatRow label="+3.5 Goles" val={over35} color="var(--draw)" />
          <div style={{ marginTop: 12 }}>
            <StatRow label="BTTS (Ambos)" val={btts} color="var(--accent)" />
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px" }}>
          <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
            Clean Sheet · Ajustes modelo
          </h3>
          <StatRow label="CS Local"     val={csHome} color="var(--win)" />
          <StatRow label="CS Visitante" val={csAway} color="var(--win)" />
          <div style={{ marginTop: 16, display: "grid", gap: 4 }}>
            {model.adjustmentsApplied.map((adj, i) => (
              <div key={i} style={{ fontSize: 11, padding: "3px 8px", background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                {adj}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Exact scores */}
      {exactScores.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px", marginBottom: 12 }}>
          <h3 style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
            Marcadores exactos · Top 8
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
            {exactScores.map((m, i) => (
              <div key={m.selection} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px",
                background: i === 0 ? "var(--accent-dim)" : "var(--surface-2)",
                border: i === 0 ? "1px solid rgba(232,255,60,0.25)" : "1px solid transparent",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", width: 16 }}>#{i + 1}</span>
                  <span className="stat-number" style={{ fontSize: 22, color: i === 0 ? "var(--accent)" : "var(--text)" }}>
                    {m.selection}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="stat-number" style={{ fontSize: 16 }}>{(m.ourProbability * 100).toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                    c. justa {(1 / m.ourProbability).toFixed(1)}x
                  </div>
                  <div style={{ height: 3, width: 60, background: "var(--border)", borderRadius: 2, marginTop: 3 }}>
                    <div style={{ height: "100%", width: `${(m.ourProbability / maxExact) * 100}%`, background: i === 0 ? "var(--accent)" : "var(--text-muted)", borderRadius: 2 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOP APUESTAS — aparece cuando hay odds guardados con EV > 0 */}
      {(() => {
        const top = markets
          .filter(m => m.odds != null && m.EV != null && m.EV > 0)
          .sort((a, b) => (b.EV ?? 0) - (a.EV ?? 0))
          .slice(0, 3)
        if (top.length === 0) return null
        return (
          <div style={{ background: "rgba(232,255,60,0.04)", border: "1px solid rgba(232,255,60,0.25)", padding: "20px 24px", marginBottom: 12, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <h2 className="stat-number" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)" }}>
                ▲ Top {top.length} Apuestas con Valor
              </h2>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Recarga la página para actualizar después de ingresar cuotas
              </span>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              {top.map((m, i) => {
                const kelly = m.kellyAmount ?? 0
                const evPct = ((m.EV ?? 0) * 100).toFixed(1)
                const evColor = (m.EV ?? 0) >= 0.08 ? "var(--win)" : "var(--draw)"
                const explanation = buildExplanation(m, lH, lA, model.adjustmentsApplied, confidence, homeName, awayName)

                return (
                  <div key={`${m.name}|${m.selection}`} style={{
                    borderLeft: `3px solid ${evColor}`,
                    paddingLeft: 16,
                  }}>
                    {/* Header row */}
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr repeat(3, auto)", gap: 16, alignItems: "center", marginBottom: 10 }}>
                      <span className="stat-number" style={{ fontSize: 28, color: evColor }}>#{i + 1}</span>
                      <div>
                        <div className="stat-number" style={{ fontSize: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {selectionLabel(m.name, m.selection, homeName, awayName)}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {m.name} · {m.bookmaker ?? "manual"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Cuota</div>
                        <div className="stat-number" style={{ fontSize: 22 }}>@{m.odds?.toFixed(2)}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>EV</div>
                        <div className="stat-number" style={{ fontSize: 22, color: evColor }}>+{evPct}%</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Kelly 25%</div>
                        <div className="stat-number" style={{ fontSize: 22, color: "var(--accent)" }}>
                          {kelly > 0 ? `$${Math.round(kelly).toLocaleString("es-CO")}` : "--"}
                        </div>
                      </div>
                    </div>

                    {/* Por qué es viable */}
                    <div style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      padding: "10px 14px",
                      fontSize: 12,
                      color: "var(--text-muted)",
                      lineHeight: 1.6,
                    }}>
                      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                        Por qué invertir aquí
                      </span>
                      {explanation}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Betting layer */}
      <div style={{ marginTop: 28, marginBottom: 8 }}>
        <h2 className="stat-number" style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 4 }}>
          Ingresa cuotas · Calcula EV en tiempo real
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          La cuota justa es el mínimo para EV positivo. Kelly al 25% fraccionado.
        </p>
      </div>

      {markets1x2.length > 0 && (
        <MarketBettingCard
          fixtureId={fixtureId}
          title="Resultado 1X2"
          markets={markets1x2}
          bankroll={bankroll.current}
          confidence={confidence}
        />
      )}
      {marketsOU.length > 0 && (
        <MarketBettingCard
          fixtureId={fixtureId}
          title="Over / Under Goles"
          markets={marketsOU}
          bankroll={bankroll.current}
          confidence={confidence}
        />
      )}
      {marketsBTTS.length > 0 && (
        <MarketBettingCard
          fixtureId={fixtureId}
          title="Ambos Anotan (BTTS)"
          markets={marketsBTTS}
          bankroll={bankroll.current}
          confidence={confidence}
        />
      )}

      <div style={{ padding: "12px 16px", border: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <span>Poisson + Dixon-Coles · CSV fallback H2H + form</span>
        <span style={{ color: "var(--accent)" }}>Herramienta de análisis personal</span>
      </div>
    </div>
  )
}
