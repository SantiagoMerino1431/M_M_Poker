const HOME_ADVANTAGE: Record<string, number> = {
  USA: 1.08,
  CAN: 1.06,
  MEX: 1.10,
}

const ALTITUDE_CITIES: Record<string, number> = {
  "Ciudad de México": 2240,
  "Mexico City": 2240,
  "Guadalajara": 1566,
}

const COLD_CLIMATE_COUNTRIES = new Set(["SCO", "SWE", "NOR", "FIN", "DEN", "ISL", "NED", "BEL", "GER"])

export interface ContextAdjustments {
  homeAdvantage: number
  altitudeFactorHome: number
  heatFactorHome: number
  heatFactorAway: number
  fatigueFactor: number
  cardIntensity: number
  adjustments: string[]
}

export function calcContextAdjustments(params: {
  homeCountry: string
  awayCountry: string
  city: string
  altitudeM: number
  tempC: number | null
  homeRestDays: number
  awayRestDays: number
  refereeAvgYellows: number | null
}): ContextAdjustments {
  const adj: string[] = []

  const homeAdvantage = HOME_ADVANTAGE[params.homeCountry] ?? 1.0
  if (homeAdvantage > 1.0) adj.push(`Ventaja local ${params.homeCountry} +${((homeAdvantage - 1) * 100).toFixed(0)}%`)

  const altitude = ALTITUDE_CITIES[params.city] ?? params.altitudeM
  const altitudeFactorHome = altitude > 1500 ? 1.10 : altitude > 800 ? 1.04 : 1.0
  if (altitudeFactorHome > 1.0) adj.push(`Altitud ${altitude}m`)

  const temp = params.tempC ?? 22
  const awayIsCold = COLD_CLIMATE_COUNTRIES.has(params.awayCountry)
  const homeIsCold = COLD_CLIMATE_COUNTRIES.has(params.homeCountry)
  const heatFactorAway = temp > 32 && awayIsCold ? 0.94 : 1.0
  const heatFactorHome = temp > 32 && homeIsCold ? 0.94 : 1.0
  if (heatFactorAway < 1.0) adj.push(`Calor extremo ${temp}°C afecta ${params.awayCountry}`)
  if (heatFactorHome < 1.0) adj.push(`Calor extremo ${temp}°C afecta ${params.homeCountry}`)

  const fatigueFactor = Math.min(
    params.homeRestDays < 4 ? 0.95 : 1.0,
    params.awayRestDays < 4 ? 0.95 : 1.0
  )
  if (fatigueFactor < 1.0) adj.push("Fatiga por poco descanso")

  const refereeYellows = params.refereeAvgYellows ?? 3.8
  const cardIntensity = refereeYellows > 5.0 ? 1.30 : refereeYellows < 3.0 ? 0.75 : 1.0
  if (cardIntensity !== 1.0) adj.push(`Árbitro tarjetas ${cardIntensity > 1 ? "alto" : "bajo"}`)

  return {
    homeAdvantage,
    altitudeFactorHome,
    heatFactorHome,
    heatFactorAway,
    fatigueFactor,
    cardIntensity,
    adjustments: adj,
  }
}
