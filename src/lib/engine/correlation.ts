interface BetLike { fixtureId: number; market: string; selection: string }

function tag(b: BetLike): string {
  if (b.market === "Over/Under") return b.selection.startsWith("over") ? "over" : "under"
  if (b.market === "BTTS") return b.selection === "yes" ? "btts_yes" : "btts_no"
  if (b.market === "1X2") return `res_${b.selection}`
  if (b.market === "Doble Oportunidad") return `dc_${b.selection}`
  return `${b.market}:${b.selection}`
}

const CORRELATED: [string, string][] = [
  ["over", "btts_yes"],
  ["under", "btts_no"],
  ["res_home", "dc_1X"], ["res_home", "dc_12"],
  ["res_away", "dc_X2"], ["res_away", "dc_12"],
  ["res_draw", "dc_1X"], ["res_draw", "dc_X2"],
]

function isCorrelated(a: string, b: string): boolean {
  return CORRELATED.some(([x, y]) => (a === x && b === y) || (a === y && b === x))
}

export function correlationWarnings(bets: BetLike[]): string[] {
  const out: string[] = []
  for (let i = 0; i < bets.length; i++) {
    for (let j = i + 1; j < bets.length; j++) {
      if (bets[i].fixtureId !== bets[j].fixtureId) continue
      if (isCorrelated(tag(bets[i]), tag(bets[j]))) {
        out.push(`Correlación: "${bets[i].market} ${bets[i].selection}" y "${bets[j].market} ${bets[j].selection}" cubren riesgo similar · el Kelly combinado sobreestima el tamaño.`)
      }
    }
  }
  return out
}
