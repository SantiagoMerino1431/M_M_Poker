export interface MissingPlayer {
  goalsPer90?: number
  position?: string
  key?: boolean
}

export function lineupAttackMultiplier(missing: MissingPlayer[]): number {
  let impact = 0
  for (const p of missing) {
    if (p.goalsPer90 != null) impact += Math.min(0.10, p.goalsPer90 * 0.15)
    else impact += p.key ? 0.08 : 0.03
  }
  return Math.max(0.80, 1 - impact)
}

export function lineupConcedeMultiplier(missing: MissingPlayer[]): number {
  let impact = 0
  for (const p of missing) {
    const isDef = p.position === "DEF" || p.position === "GK"
    if (isDef) impact += p.key ? 0.08 : 0.04
  }
  return Math.min(1.20, 1 + impact)
}
