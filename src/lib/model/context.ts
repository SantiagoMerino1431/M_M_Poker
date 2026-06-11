interface ContextInput {
  homeCountry: string
  awayCountry: string
  city: string
  altitudeM: number
  tempC: number | null
  homeRestDays: number
  awayRestDays: number
  refereeAvgYellows: number | null
}

interface ContextOutput {
  homeAdvantage: number
  altitudeFactorHome: number
  altitudeFactorAway: number
  heatFactorHome: number
  heatFactorAway: number
  fatigueFactor: number
  adjustments: string[]
}

// WC 2026 host cities for home-adjacent advantage
const HOST_CITIES: Record<string, string> = {
  "East Rutherford": "USA",
  "Dallas": "USA",
  "Los Ángeles": "USA",
  "Los Angeles": "USA",
  "San José": "USA",
  "Kansas City": "USA",
  "Miami": "USA",
  "Filadelfia": "USA",
  "Philadelphia": "USA",
  "Boston": "USA",
  "Houston": "USA",
  "Atlanta": "USA",
  "Pasadena": "USA",
  "Vancouver": "CAN",
  "Toronto": "CAN",
  "Ciudad de México": "MEX",
  "Mexico City": "MEX",
  "Monterrey": "MEX",
  "Guadalajara": "MEX",
}

export function calcContextAdjustments(input: ContextInput): ContextOutput {
  const adjustments: string[] = []

  // Neutral venue (WC 2026) — minimal home advantage
  let homeAdvantage = 1.0
  const hostCountry = HOST_CITIES[input.city]
  if (hostCountry === input.homeCountry) {
    if (input.homeCountry === "MEX") homeAdvantage = 1.10
    else if (input.homeCountry === "CAN") homeAdvantage = 1.06
    else homeAdvantage = 1.08
    adjustments.push(`Sede local ${input.homeCountry}: +${((homeAdvantage - 1) * 100).toFixed(0)}%`)
  }

  // Altitude: >2000m hurts un-adapted teams
  let altitudeFactorHome = 1.0
  let altitudeFactorAway = 1.0
  if (input.altitudeM > 2000) {
    altitudeFactorAway = 0.93
    adjustments.push(`Altitud ${input.altitudeM}m: visitante -7%`)
  } else if (input.altitudeM > 1000) {
    altitudeFactorAway = 0.97
  }

  // Heat: >32°C reduces scoring slightly
  let heatFactorHome = 1.0
  let heatFactorAway = 1.0
  if (input.tempC !== null && input.tempC > 32) {
    heatFactorHome = 0.96
    heatFactorAway = 0.96
    adjustments.push(`Calor extremo ${input.tempC}°C: ambos -4%`)
  } else if (input.tempC !== null && input.tempC > 28) {
    heatFactorHome = 0.98
    heatFactorAway = 0.98
  }

  // Fatigue: short rest (<4 days)
  let fatigueFactor = 1.0
  const minRest = Math.min(input.homeRestDays, input.awayRestDays)
  if (minRest <= 3) {
    fatigueFactor = 0.95
    adjustments.push("Descanso corto: goles -5%")
  }

  return {
    homeAdvantage,
    altitudeFactorHome,
    altitudeFactorAway,
    heatFactorHome,
    heatFactorAway,
    fatigueFactor,
    adjustments,
  }
}
