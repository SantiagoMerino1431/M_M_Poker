export type Team = {
  id: number
  name: string
  country: string
  group: string
  attackStrength: number
  defenseStrength: number
  fifaRanking: number
}

export const TEAMS: Record<number, Team> = {
  1:  { id: 1,  name: "México",               country: "MEX", group: "A", attackStrength: 1.10, defenseStrength: 1.00, fifaRanking: 16 },
  2:  { id: 2,  name: "Sudáfrica",            country: "RSA", group: "A", attackStrength: 0.85, defenseStrength: 1.10, fifaRanking: 59 },
  3:  { id: 3,  name: "República de Corea",   country: "KOR", group: "A", attackStrength: 1.08, defenseStrength: 0.92, fifaRanking: 23 },
  4:  { id: 4,  name: "Chequia",              country: "CZE", group: "A", attackStrength: 0.95, defenseStrength: 1.00, fifaRanking: 40 },
  5:  { id: 5,  name: "Canadá",               country: "CAN", group: "B", attackStrength: 0.95, defenseStrength: 1.05, fifaRanking: 43 },
  6:  { id: 6,  name: "Bosnia y Herzegovina", country: "BIH", group: "B", attackStrength: 0.85, defenseStrength: 1.10, fifaRanking: 70 },
  7:  { id: 7,  name: "Catar",                country: "QAT", group: "B", attackStrength: 0.82, defenseStrength: 1.12, fifaRanking: 58 },
  8:  { id: 8,  name: "Suiza",                country: "SUI", group: "B", attackStrength: 1.05, defenseStrength: 0.90, fifaRanking: 22 },
  9:  { id: 9,  name: "Brasil",               country: "BRA", group: "C", attackStrength: 1.42, defenseStrength: 0.76, fifaRanking: 5  },
  10: { id: 10, name: "Marruecos",            country: "MAR", group: "C", attackStrength: 1.05, defenseStrength: 0.90, fifaRanking: 14 },
  11: { id: 11, name: "Haití",                country: "HAI", group: "C", attackStrength: 0.75, defenseStrength: 1.20, fifaRanking: 85 },
  12: { id: 12, name: "Escocia",              country: "SCO", group: "C", attackStrength: 0.95, defenseStrength: 1.00, fifaRanking: 35 },
  13: { id: 13, name: "Estados Unidos",       country: "USA", group: "D", attackStrength: 1.15, defenseStrength: 0.95, fifaRanking: 13 },
  14: { id: 14, name: "Paraguay",             country: "PAR", group: "D", attackStrength: 0.88, defenseStrength: 1.08, fifaRanking: 57 },
  15: { id: 15, name: "Australia",            country: "AUS", group: "D", attackStrength: 1.05, defenseStrength: 0.95, fifaRanking: 24 },
  16: { id: 16, name: "Turquía",              country: "TUR", group: "D", attackStrength: 1.05, defenseStrength: 0.95, fifaRanking: 28 },
  17: { id: 17, name: "Alemania",             country: "GER", group: "E", attackStrength: 1.40, defenseStrength: 0.78, fifaRanking: 4  },
  18: { id: 18, name: "Curazao",              country: "CUW", group: "E", attackStrength: 0.72, defenseStrength: 1.22, fifaRanking: 85 },
  19: { id: 19, name: "Costa de Marfil",      country: "CIV", group: "E", attackStrength: 0.92, defenseStrength: 1.02, fifaRanking: 48 },
  20: { id: 20, name: "Ecuador",              country: "ECU", group: "E", attackStrength: 1.00, defenseStrength: 1.00, fifaRanking: 33 },
  21: { id: 21, name: "Países Bajos",         country: "NED", group: "F", attackStrength: 1.32, defenseStrength: 0.82, fifaRanking: 7  },
  22: { id: 22, name: "Japón",                country: "JPN", group: "F", attackStrength: 1.12, defenseStrength: 0.90, fifaRanking: 18 },
  23: { id: 23, name: "Suecia",               country: "SWE", group: "F", attackStrength: 1.08, defenseStrength: 0.92, fifaRanking: 25 },
  24: { id: 24, name: "Túnez",                country: "TUN", group: "F", attackStrength: 0.95, defenseStrength: 1.00, fifaRanking: 30 },
  25: { id: 25, name: "Bélgica",              country: "BEL", group: "G", attackStrength: 1.30, defenseStrength: 0.82, fifaRanking: 5  },
  26: { id: 26, name: "Egipto",               country: "EGY", group: "G", attackStrength: 0.95, defenseStrength: 1.02, fifaRanking: 38 },
  27: { id: 27, name: "RI de Irán",           country: "IRN", group: "G", attackStrength: 1.00, defenseStrength: 0.98, fifaRanking: 20 },
  28: { id: 28, name: "Nueva Zelanda",        country: "NZL", group: "G", attackStrength: 0.75, defenseStrength: 1.20, fifaRanking: 95 },
  29: { id: 29, name: "España",               country: "ESP", group: "H", attackStrength: 1.45, defenseStrength: 0.70, fifaRanking: 1  },
  30: { id: 30, name: "Islas de Cabo Verde",  country: "CPV", group: "H", attackStrength: 0.82, defenseStrength: 1.12, fifaRanking: 68 },
  31: { id: 31, name: "Arabia Saudí",         country: "KSA", group: "H", attackStrength: 0.85, defenseStrength: 1.10, fifaRanking: 56 },
  32: { id: 32, name: "Uruguay",              country: "URU", group: "H", attackStrength: 1.15, defenseStrength: 0.88, fifaRanking: 17 },
  33: { id: 33, name: "Francia",              country: "FRA", group: "I", attackStrength: 1.50, defenseStrength: 0.72, fifaRanking: 3  },
  34: { id: 34, name: "Senegal",              country: "SEN", group: "I", attackStrength: 1.10, defenseStrength: 0.92, fifaRanking: 20 },
  35: { id: 35, name: "Irak",                 country: "IRQ", group: "I", attackStrength: 0.80, defenseStrength: 1.15, fifaRanking: 70 },
  36: { id: 36, name: "Noruega",              country: "NOR", group: "I", attackStrength: 1.00, defenseStrength: 1.00, fifaRanking: 34 },
  37: { id: 37, name: "Argentina",            country: "ARG", group: "J", attackStrength: 1.50, defenseStrength: 0.75, fifaRanking: 2  },
  38: { id: 38, name: "Argelia",              country: "ALG", group: "J", attackStrength: 0.90, defenseStrength: 1.05, fifaRanking: 50 },
  39: { id: 39, name: "Austria",              country: "AUT", group: "J", attackStrength: 1.08, defenseStrength: 0.92, fifaRanking: 26 },
  40: { id: 40, name: "Jordania",             country: "JOR", group: "J", attackStrength: 0.78, defenseStrength: 1.15, fifaRanking: 80 },
  41: { id: 41, name: "Portugal",             country: "POR", group: "K", attackStrength: 1.38, defenseStrength: 0.80, fifaRanking: 6  },
  42: { id: 42, name: "RD Congo",             country: "COD", group: "K", attackStrength: 0.85, defenseStrength: 1.10, fifaRanking: 62 },
  43: { id: 43, name: "Uzbekistán",           country: "UZB", group: "K", attackStrength: 0.80, defenseStrength: 1.15, fifaRanking: 72 },
  44: { id: 44, name: "Colombia",             country: "COL", group: "K", attackStrength: 1.12, defenseStrength: 0.90, fifaRanking: 19 },
  45: { id: 45, name: "Inglaterra",           country: "ENG", group: "L", attackStrength: 1.38, defenseStrength: 0.80, fifaRanking: 5  },
  46: { id: 46, name: "Croacia",              country: "CRO", group: "L", attackStrength: 1.20, defenseStrength: 0.85, fifaRanking: 10 },
  47: { id: 47, name: "Ghana",                country: "GHA", group: "L", attackStrength: 0.88, defenseStrength: 1.08, fifaRanking: 66 },
  48: { id: 48, name: "Panamá",               country: "PAN", group: "L", attackStrength: 0.88, defenseStrength: 1.08, fifaRanking: 50 },
}

export const GROUP_IDS: Record<string, number[]> = {
  A: [1, 2, 3, 4],   B: [5, 6, 7, 8],
  C: [9, 10, 11, 12], D: [13, 14, 15, 16],
  E: [17, 18, 19, 20], F: [21, 22, 23, 24],
  G: [25, 26, 27, 28], H: [29, 30, 31, 32],
  I: [33, 34, 35, 36], J: [37, 38, 39, 40],
  K: [41, 42, 43, 44], L: [45, 46, 47, 48],
}

// Sedes del Mundial 2026 asignadas por zona geográfica
const STADIUMS = [
  "MetLife Stadium, Nueva Jersey",
  "AT&T Stadium, Dallas",
  "SoFi Stadium, Los Ángeles",
  "Levi's Stadium, San José",
  "Arrowhead Stadium, Kansas City",
  "Hard Rock Stadium, Miami",
  "Lincoln Financial Field, Filadelfia",
  "Gillette Stadium, Boston",
  "NRG Stadium, Houston",
  "BC Place, Vancouver",
  "BMO Field, Toronto",
  "Estadio Azteca, Ciudad de México",
  "Estadio BBVA, Monterrey",
  "Estadio Akron, Guadalajara",
  "Mercedes-Benz Stadium, Atlanta",
  "Rose Bowl, Pasadena",
]

export function getFixtureId(homeId: number, awayId: number) {
  return `${homeId}-${awayId}`
}

export function parseFixtureId(id: string): { homeId: number; awayId: number } | null {
  const parts = id.split("-")
  if (parts.length !== 2) return null
  return { homeId: Number(parts[0]), awayId: Number(parts[1]) }
}

export function getStadium(homeId: number, awayId: number): string {
  return STADIUMS[(homeId + awayId) % STADIUMS.length]
}

export function getMatchDate(homeId: number, awayId: number): string {
  const base = new Date("2026-06-11")
  base.setDate(base.getDate() + Math.floor((homeId + awayId) % 18))
  return base.toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", year: "numeric", month: "long", day: "numeric" })
}

export function getMatchTime(homeId: number): string {
  // Horarios en COT (UTC-5). WC 2026 usa ET (EDT=UTC-4) → COT = ET -1h
  const times = ["13:00", "16:00", "19:00", "22:00"]
  return times[homeId % 4]
}
