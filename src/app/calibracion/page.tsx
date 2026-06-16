import { Fragment } from "react"
import { getBets } from "@/lib/kelly/tracker"
import { calibrationReport } from "@/lib/engine/calibration"
import Link from "next/link"

export default async function CalibracionPage() {
  const allBets = await getBets({})
  const realBets = allBets.filter(b => b.mode === "real")
  const paperBets = allBets.filter(b => b.mode === "paper")
  const report = calibrationReport(realBets)
  const paperReport = calibrationReport(paperBets)

  function pct(n: number | null) {
    if (n == null) return "—"
    return `${(n * 100).toFixed(1)}%`
  }
  function fmt(n: number | null, decimals = 3) {
    if (n == null) return "—"
    return n.toFixed(decimals)
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Calibración del modelo</h1>
        <Link href="/historial" style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em" }}>← Historial</Link>
      </div>

      {/* Summary stats — real bets */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
        {[
          ["Apuestas reales", String(report.settledBets)],
          ["Win rate", pct(report.winRate)],
          ["ROI", pct(report.roi)],
          ["Beneficio", `$${report.totalProfit.toLocaleString("es-CO")}`],
          ["Brier score", fmt(report.brierScore)],
          ["Log loss", fmt(report.logLoss)],
          ["CLV medio", pct(report.clvAvg)],
        ].map(([label, val]) => (
          <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Calibration chart — SVG */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Curva de calibración (real — predicho vs observado)</div>
        <svg width="100%" viewBox="0 0 500 160" style={{ display: "block" }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
            <line key={i} x1={0} y1={160 - v * 150} x2={500} y2={160 - v * 150} stroke="var(--border)" strokeWidth={0.5} />
          ))}
          {/* Perfect calibration diagonal */}
          <line x1={0} y1={160} x2={500} y2={10} stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 4" opacity={0.4} />
          {/* Actual calibration points */}
          {report.buckets.filter(b => b.count > 0).map((b, i) => {
            const x = b.predicted * 500
            const y = 160 - b.actual * 150
            return <circle key={i} cx={x} cy={y} r={Math.min(8, 3 + b.count)} fill="var(--win)" opacity={0.8} />
          })}
          {/* Connect points */}
          {(() => {
            const pts = report.buckets.filter(b => b.count > 0)
            if (pts.length < 2) return null
            const d = pts.map((b, i) => `${i === 0 ? "M" : "L"}${(b.predicted * 500).toFixed(0)},${(160 - b.actual * 150).toFixed(0)}`).join(" ")
            return <path d={d} fill="none" stroke="var(--win)" strokeWidth={1.5} />
          })()}
        </svg>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8 }}>Cada punto = rango de confianza del modelo. Tamaño del punto proporcional al nro. de apuestas. La diagonal amarilla = calibración perfecta.</div>
      </div>

      {/* Bucket table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Detalle por rango</div>
        <div style={{ display: "grid", gridTemplateColumns: "80px 80px 80px 60px", gap: "4px 16px", fontSize: 11 }}>
          {["Rango", "Predicho", "Real", "Apuestas"].map(h => (
            <span key={h} style={{ color: "var(--text-muted)", fontWeight: 600, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>{h}</span>
          ))}
          {report.buckets.map(b => (
            <Fragment key={b.label}>
              <span style={{ paddingTop: 4 }}>{b.label}</span>
              <span style={{ paddingTop: 4 }}>{pct(b.predicted)}</span>
              <span style={{ paddingTop: 4, color: b.count === 0 ? "var(--text-muted)" : Math.abs(b.actual - b.predicted) < 0.1 ? "var(--win)" : "var(--loss)" }}>
                {b.count > 0 ? pct(b.actual) : "—"}
              </span>
              <span style={{ paddingTop: 4, color: "var(--text-muted)" }}>{b.count}</span>
            </Fragment>
          ))}
        </div>
      </div>

      {/* Paper bets summary */}
      {paperReport.settledBets > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Paper trading ({paperReport.settledBets} apuestas)</div>
          <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
            <span>Win rate: <strong>{pct(paperReport.winRate)}</strong></span>
            <span>ROI: <strong>{pct(paperReport.roi)}</strong></span>
            <span>Brier: <strong>{fmt(paperReport.brierScore)}</strong></span>
          </div>
        </div>
      )}
    </div>
  )
}
