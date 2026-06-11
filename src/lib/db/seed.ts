import { db } from "./client"

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

// WC 2026 group stage schedule. Each group has 6 fixtures (C(4,2)=6).
// Seed order within a group: (0,1),(0,2),(0,3),(1,2),(1,3),(2,3)
// WC matchday pairings: MD1=(0,1)+(2,3), MD2=(0,2)+(1,3), MD3=(0,3)+(1,2)
// So by seed index: MD1=fixtures[0]+fixtures[5], MD2=fixtures[1]+fixtures[4], MD3=fixtures[2]+fixtures[3]
// Group stage: June 11 - July 2, 2026. 2 groups per day for MD1/MD2, then simultaneous MD3.
function buildFixtureSchedule(): Map<number, { date: string; stadium: string; city: string }> {
  const schedule = new Map<number, { date: string; stadium: string; city: string }>()

  const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"]
  // Venues for host cities (used when one team is a host nation)
  const hostVenues: Record<string, { stadium: string; city: string }> = {
    MEX: { stadium: "Estadio Azteca", city: "Ciudad de México" },
    USA: { stadium: "SoFi Stadium",   city: "Los Angeles" },
    CAN: { stadium: "BMO Field",      city: "Toronto" },
  }
  const neutralVenues = [
    { stadium: "AT&T Stadium",       city: "Dallas" },
    { stadium: "MetLife Stadium",    city: "New York" },
    { stadium: "Hard Rock Stadium",  city: "Miami" },
    { stadium: "Levi's Stadium",     city: "San Francisco" },
    { stadium: "Lumen Field",        city: "Seattle" },
    { stadium: "Arrowhead Stadium",  city: "Kansas City" },
    { stadium: "Gillette Stadium",   city: "Boston" },
    { stadium: "BC Place",           city: "Vancouver" },
  ]

  const startJune11 = new Date("2026-06-11T00:00:00Z")
  const addDays = (base: Date, n: number) => {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().split("T")[0]
  }

  // For each group, compute the base fixture ID (groups have 6 fixtures each)
  groups.forEach((g, gi) => {
    const gTeams = TEAMS.filter(t => t.group_name === g)
    // Fixture IDs: gi*6+1 through gi*6+6
    const base = gi * 6 + 1
    // Seed order: (0,1)=base, (0,2)=base+1, (0,3)=base+2, (1,2)=base+3, (1,3)=base+4, (2,3)=base+5
    // MD1: (0,1)=base and (2,3)=base+5   → day offset 0 for first group of day, 0 for second pair
    // MD2: (0,2)=base+1 and (1,3)=base+4 → starts June 18
    // MD3: (0,3)=base+2 and (1,2)=base+3 → starts June 25 (simultaneous)

    // 2 groups per day: groups 0,1 share day 0; groups 2,3 share day 1; etc.
    const md1Day = addDays(startJune11, Math.floor(gi / 2))
    const md2Day = addDays(startJune11, 7 + Math.floor(gi / 2))
    const md3Day = addDays(startJune11, 14 + Math.floor(gi / 2))

    const slot1 = "T16:00:00Z"
    const slot2 = "T19:00:00Z"

    // Venue: prefer host nation venue, else cycle neutral venues
    const venue = (teamIdx: number) => {
      const country = gTeams[teamIdx].country
      return hostVenues[country] ?? neutralVenues[gi % neutralVenues.length]
    }

    const v01 = venue(0)
    const v23 = venue(2)
    const v02 = venue(0)
    const v13 = venue(1)
    const v03 = venue(0)
    const v12 = venue(1)

    // MD1
    schedule.set(base,     { date: `${md1Day}${slot1}`, ...v01 })
    schedule.set(base + 5, { date: `${md1Day}${slot2}`, ...v23 })
    // MD2
    schedule.set(base + 1, { date: `${md2Day}${slot1}`, ...v02 })
    schedule.set(base + 4, { date: `${md2Day}${slot2}`, ...v13 })
    // MD3 (simultaneous — both same day same slots)
    schedule.set(base + 2, { date: `${md3Day}${slot1}`, ...v03 })
    schedule.set(base + 3, { date: `${md3Day}${slot2}`, ...v12 })
  })

  return schedule
}

export async function seed() {
  for (const t of TEAMS) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO teams (id, name, country, group_name, fifa_ranking, attack_strength, defense_strength)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [t.id, t.name, t.country, t.group_name, t.fifa_ranking, t.attack_strength, t.defense_strength],
    })
  }

  const schedule = buildFixtureSchedule()
  let fixtureId = 1
  const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"]
  for (const g of groups) {
    const gTeams = TEAMS.filter(t => t.group_name === g)
    for (let i = 0; i < gTeams.length; i++) {
      for (let j = i + 1; j < gTeams.length; j++) {
        const sched = schedule.get(fixtureId)
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
            sched?.stadium ?? null,
            sched?.city ?? null,
          ],
        })
        fixtureId++
      }
    }
  }

  console.log(`Seed completo: ${TEAMS.length} equipos, ${fixtureId - 1} fixtures de fase de grupos`)
}
