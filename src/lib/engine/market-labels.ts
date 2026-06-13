export function selectionLabel(name: string, selection: string, home: string, away: string): string {
  if (name === "1X2") {
    if (selection === "home") return `${home} gana`
    if (selection === "draw") return "Empate"
    if (selection === "away") return `${away} gana`
  }
  if (name === "Doble Oportunidad") {
    if (selection === "1X") return "Local o Empate (1X)"
    if (selection === "X2") return "Empate o Visitante (X2)"
    if (selection === "12") return "Local o Visitante (12)"
  }
  if (name === "Over/Under") {
    return selection.replace("over_", "Más de ").replace("under_", "Menos de ")
  }
  if (name === "BTTS") return selection === "yes" ? "Ambos anotan — Sí" : "Ambos anotan — No"
  if (name === "Marcador Exacto") return `Exacto ${selection}`
  return `${name} ${selection}`
}

export interface MarketGroup {
  key: string
  title: string
  marketNames: string[]
}

export const MARKET_GROUPS: MarketGroup[] = [
  { key: "Resultado", title: "Resultado 1X2", marketNames: ["1X2"] },
  { key: "DobleOportunidad", title: "Doble Oportunidad", marketNames: ["Doble Oportunidad"] },
  { key: "Goles", title: "Over / Under Goles", marketNames: ["Over/Under"] },
  { key: "BTTS", title: "Ambos Anotan (BTTS)", marketNames: ["BTTS"] },
  { key: "Marcador", title: "Marcador Exacto", marketNames: ["Marcador Exacto"] },
]

export function marketGroupOf(name: string): string {
  if (name === "1X2") return "Resultado"
  if (name === "Doble Oportunidad") return "DobleOportunidad"
  if (name === "Over/Under") return "Goles"
  if (name === "BTTS") return "BTTS"
  if (name === "Marcador Exacto") return "Marcador"
  return "Otros"
}
