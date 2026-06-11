import { db } from "./client"
import { loadWC2026Fixtures } from "../data/csv-loader"

const TEAMS = [
  // Grupo A: México, Sudáfrica, República de Corea, Chequia
  { id: 1,  name: "México",              country: "MEX", group_name: "A", fifa_ranking: 16,  attack_strength: 1.10, defense_strength: 1.00 },
  { id: 2,  name: "Sudáfrica",           country: "RSA", group_name: "A", fifa_ranking: 59,  attack_strength: 0.85, defense_strength: 1.10 },
  { id: 3,  name: "República de Corea",  country: "KOR", group_name: "A", fifa_ranking: 23,  attack_strength: 1.08, defense_strength: 0.92 },
  { id: 4,  name: "Chequia",             country: "CZE", group_name: "A", fifa_ranking: 40,  attack_strength: 0.95, defense_strength: 1.00 },
  // Grupo B: Canadá, Bosnia y Herzegovina, Catar, Suiza
  { id: 5,  name: "Canadá",              country: "CAN", group_name: "B", fifa_ranking: 43,  attack_strength: 0.95, defense_strength: 1.05 },
  { id: 6,  name: "Bosnia y Herzegovina",country: "BIH", group_name: "B", fifa_ranking: 70,  attack_strength: 0.85, defense_strength: 1.10 },
  { id: 7,  name: "Catar",               country: "QAT", group_name: "B", fifa_ranking: 58,  attack_strength: 0.82, defense_strength: 1.12 },
  { id: 8,  name: "Suiza",               country: "SUI", group_name: "B", fifa_ranking: 22,  attack_strength: 1.05, defense_strength: 0.90 },
  // Grupo C: Brasil, Marruecos, Haití, Escocia
  { id: 9,  name: "Brasil",              country: "BRA", group_name: "C", fifa_ranking: 5,   attack_strength: 1.42, defense_strength: 0.76 },
  { id: 10, name: "Marruecos",           country: "MAR", group_name: "C", fifa_ranking: 14,  attack_strength: 1.05, defense_strength: 0.90 },
  { id: 11, name: "Haití",               country: "HAI", group_name: "C", fifa_ranking: 85,  attack_strength: 0.75, defense_strength: 1.20 },
  { id: 12, name: "Escocia",             country: "SCO", group_name: "C", fifa_ranking: 35,  attack_strength: 0.95, defense_strength: 1.00 },
  // Grupo D: EE. UU., Paraguay, Australia, Turquía
  { id: 13, name: "Estados Unidos",      country: "USA", group_name: "D", fifa_ranking: 13,  attack_strength: 1.15, defense_strength: 0.95 },
  { id: 14, name: "Paraguay",            country: "PAR", group_name: "D", fifa_ranking: 57,  attack_strength: 0.88, defense_strength: 1.08 },
  { id: 15, name: "Australia",           country: "AUS", group_name: "D", fifa_ranking: 24,  attack_strength: 1.05, defense_strength: 0.95 },
  { id: 16, name: "Turquía",             country: "TUR", group_name: "D", fifa_ranking: 28,  attack_strength: 1.05, defense_strength: 0.95 },
  // Grupo E: Alemania, Curazao, Costa de Marfil, Ecuador
  { id: 17, name: "Alemania",            country: "GER", group_name: "E", fifa_ranking: 4,   attack_strength: 1.40, defense_strength: 0.78 },
  { id: 18, name: "Curazao",             country: "CUW", group_name: "E", fifa_ranking: 85,  attack_strength: 0.72, defense_strength: 1.22 },
  { id: 19, name: "Costa de Marfil",     country: "CIV", group_name: "E", fifa_ranking: 48,  attack_strength: 0.92, defense_strength: 1.02 },
  { id: 20, name: "Ecuador",             country: "ECU", group_name: "E", fifa_ranking: 33,  attack_strength: 1.00, defense_strength: 1.00 },
  // Grupo F: Países Bajos, Japón, Suecia, Túnez
  { id: 21, name: "Países Bajos",        country: "NED", group_name: "F", fifa_ranking: 7,   attack_strength: 1.32, defense_strength: 0.82 },
  { id: 22, name: "Japón",               country: "JPN", group_name: "F", fifa_ranking: 18,  attack_strength: 1.12, defense_strength: 0.90 },
  { id: 23, name: "Suecia",              country: "SWE", group_name: "F", fifa_ranking: 25,  attack_strength: 1.08, defense_strength: 0.92 },
  { id: 24, name: "Túnez",               country: "TUN", group_name: "F", fifa_ranking: 30,  attack_strength: 0.95, defense_strength: 1.00 },
  // Grupo G: Bélgica, Egipto, RI de Irán, Nueva Zelanda
  { id: 25, name: "Bélgica",             country: "BEL", group_name: "G", fifa_ranking: 5,   attack_strength: 1.30, defense_strength: 0.82 },
  { id: 26, name: "Egipto",              country: "EGY", group_name: "G", fifa_ranking: 38,  attack_strength: 0.95, defense_strength: 1.02 },
  { id: 27, name: "RI de Irán",          country: "IRN", group_name: "G", fifa_ranking: 20,  attack_strength: 1.00, defense_strength: 0.98 },
  { id: 28, name: "Nueva Zelanda",       country: "NZL", group_name: "G", fifa_ranking: 95,  attack_strength: 0.75, defense_strength: 1.20 },
  // Grupo H: España, Islas de Cabo Verde, Arabia Saudí, Uruguay
  { id: 29, name: "España",              country: "ESP", group_name: "H", fifa_ranking: 1,   attack_strength: 1.45, defense_strength: 0.70 },
  { id: 30, name: "Islas de Cabo Verde", country: "CPV", group_name: "H", fifa_ranking: 68,  attack_strength: 0.82, defense_strength: 1.12 },
  { id: 31, name: "Arabia Saudí",        country: "KSA", group_name: "H", fifa_ranking: 56,  attack_strength: 0.85, defense_strength: 1.10 },
  { id: 32, name: "Uruguay",             country: "URU", group_name: "H", fifa_ranking: 17,  attack_strength: 1.15, defense_strength: 0.88 },
  // Grupo I: Francia, Senegal, Irak, Noruega
  { id: 33, name: "Francia",             country: "FRA", group_name: "I", fifa_ranking: 3,   attack_strength: 1.50, defense_strength: 0.72 },
  { id: 34, name: "Senegal",             country: "SEN", group_name: "I", fifa_ranking: 20,  attack_strength: 1.10, defense_strength: 0.92 },
  { id: 35, name: "Irak",                country: "IRQ", group_name: "I", fifa_ranking: 70,  attack_strength: 0.80, defense_strength: 1.15 },
  { id: 36, name: "Noruega",             country: "NOR", group_name: "I", fifa_ranking: 34,  attack_strength: 1.00, defense_strength: 1.00 },
  // Grupo J: Argentina, Argelia, Austria, Jordania
  { id: 37, name: "Argentina",           country: "ARG", group_name: "J", fifa_ranking: 2,   attack_strength: 1.50, defense_strength: 0.75 },
  { id: 38, name: "Argelia",             country: "ALG", group_name: "J", fifa_ranking: 50,  attack_strength: 0.90, defense_strength: 1.05 },
  { id: 39, name: "Austria",             country: "AUT", group_name: "J", fifa_ranking: 26,  attack_strength: 1.08, defense_strength: 0.92 },
  { id: 40, name: "Jordania",            country: "JOR", group_name: "J", fifa_ranking: 80,  attack_strength: 0.78, defense_strength: 1.15 },
  // Grupo K: Portugal, RD Congo, Uzbekistán, Colombia
  { id: 41, name: "Portugal",            country: "POR", group_name: "K", fifa_ranking: 6,   attack_strength: 1.38, defense_strength: 0.80 },
  { id: 42, name: "RD Congo",            country: "COD", group_name: "K", fifa_ranking: 62,  attack_strength: 0.85, defense_strength: 1.10 },
  { id: 43, name: "Uzbekistán",          country: "UZB", group_name: "K", fifa_ranking: 72,  attack_strength: 0.80, defense_strength: 1.15 },
  { id: 44, name: "Colombia",            country: "COL", group_name: "K", fifa_ranking: 19,  attack_strength: 1.12, defense_strength: 0.90 },
  // Grupo L: Inglaterra, Croacia, Ghana, Panamá
  { id: 45, name: "Inglaterra",          country: "ENG", group_name: "L", fifa_ranking: 5,   attack_strength: 1.38, defense_strength: 0.80 },
  { id: 46, name: "Croacia",             country: "CRO", group_name: "L", fifa_ranking: 10,  attack_strength: 1.20, defense_strength: 0.85 },
  { id: 47, name: "Ghana",               country: "GHA", group_name: "L", fifa_ranking: 66,  attack_strength: 0.88, defense_strength: 1.08 },
  { id: 48, name: "Panamá",              country: "PAN", group_name: "L", fifa_ranking: 50,  attack_strength: 0.88, defense_strength: 1.08 },
]

// Build a map from "homeEs|awayEs" → { date, city } using the real CSV schedule
function buildFixtureScheduleFromCSV(): Map<string, { date: string; city: string }> {
  const map = new Map<string, { date: string; city: string }>()
  try {
    const fixtures = loadWC2026Fixtures()
    for (const f of fixtures) {
      map.set(`${f.homeEs}|${f.awayEs}`, { date: `${f.date}T16:00:00Z`, city: f.city })
    }
  } catch {
    // CSV not available — fall back to empty (dates will be null)
  }
  return map
}

export async function seed() {
  for (const t of TEAMS) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO teams (id, name, country, group_name, fifa_ranking, attack_strength, defense_strength)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [t.id, t.name, t.country, t.group_name, t.fifa_ranking, t.attack_strength, t.defense_strength],
    })
  }

  const schedule = buildFixtureScheduleFromCSV()
  let fixtureId = 1
  const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"]
  for (const g of groups) {
    const gTeams = TEAMS.filter(t => t.group_name === g)
    for (let i = 0; i < gTeams.length; i++) {
      for (let j = i + 1; j < gTeams.length; j++) {
        const key = `${gTeams[i].name}|${gTeams[j].name}`
        const sched = schedule.get(key)
        await db.execute({
          sql: `INSERT OR REPLACE INTO fixtures
                (id, home_team_id, away_team_id, stage, status, match_date, stadium, city)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            fixtureId,
            gTeams[i].id,
            gTeams[j].id,
            `group_${g}`,
            "scheduled",
            sched?.date ?? null,
            null,
            sched?.city ?? null,
          ],
        })
        fixtureId++
      }
    }
  }

  console.log(`Seed completo: ${TEAMS.length} equipos, ${fixtureId - 1} fixtures de fase de grupos`)
}
