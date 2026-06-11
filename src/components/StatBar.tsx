export function Bar({ value, color = "var(--accent)" }: { value: number; color?: string }) {
  return (
    <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${Math.min(value * 100, 100)}%`, background: color, borderRadius: 2, transition: "width 0.4s" }} />
    </div>
  )
}

export function StatRow({ label, val, max = 1, color }: { label: string; val: number; max?: number; color?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 52px", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <Bar value={val / max} color={color} />
      <span className="stat-number" style={{ fontSize: 20, textAlign: "right", color: color || "var(--text)" }}>
        {Math.round(val * 100)}%
      </span>
    </div>
  )
}
