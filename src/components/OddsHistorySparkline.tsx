interface OddsPoint { odds: number; recordedAt: string }

interface Props {
  points: OddsPoint[]
  width?: number
  height?: number
}

export function OddsHistorySparkline({ points, width = 80, height = 24 }: Props) {
  if (points.length < 2) return null

  const values = points.map(p => p.odds)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 0.01

  const toX = (i: number) => (i / (values.length - 1)) * width
  const toY = (v: number) => height - ((v - min) / range) * height

  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(" ")

  const first = values[0]
  const last = values[values.length - 1]
  const trend = last < first ? "var(--win)" : last > first ? "var(--loss)" : "var(--text-muted)"

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
      aria-label={`Cuota: ${first.toFixed(2)} → ${last.toFixed(2)}`}
    >
      <path d={d} fill="none" stroke={trend} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={toX(values.length - 1).toFixed(1)} cy={toY(last).toFixed(1)} r={2} fill={trend} />
    </svg>
  )
}
