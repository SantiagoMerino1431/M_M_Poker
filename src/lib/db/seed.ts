import { db } from "./client"

const TEAMS = [
  // Grupo A
  { id: 1, name: "Estados Unidos", country: "USA", group_name: "A", fifa_ranking: 13, attack_strength: 1.15, defense_strength: 0.95 },
  { id: 2, name: "México", country: "MEX", group_name: "A", fifa_ranking: 16, attack_strength: 1.1, defense_strength: 1.0 },
  { id: 3, name: "Canadá", country: "CAN", group_name: "A", fifa_ranking: 43, attack_strength: 0.95, defense_strength: 1.05 },
  { id: 4, name: "Jamaica", country: "JAM", group_name: "A", fifa_ranking: 55, attack_strength: 0.85, defense_strength: 1.1 },
  // Grupo B
  { id: 5, name: "España", country: "ESP", group_name: "B", fifa_ranking: 1, attack_strength: 1.45, defense_strength: 0.7 },
  { id: 6, name: "Croacia", country: "CRO", group_name: "B", fifa_ranking: 10, attack_strength: 1.2, defense_strength: 0.85 },
  { id: 7, name: "Albania", country: "ALB", group_name: "B", fifa_ranking: 65, attack_strength: 0.9, defense_strength: 1.1 },
  { id: 8, name: "Marruecos", country: "MAR", group_name: "B", fifa_ranking: 14, attack_strength: 1.05, defense_strength: 0.9 },
  // Grupo C
  { id: 9, name: "Argentina", country: "ARG", group_name: "C", fifa_ranking: 2, attack_strength: 1.5, defense_strength: 0.75 },
  { id: 10, name: "Ecuador", country: "ECU", group_name: "C", fifa_ranking: 33, attack_strength: 1.0, defense_strength: 1.0 },
  { id: 11, name: "Chile", country: "CHI", group_name: "C", fifa_ranking: 45, attack_strength: 0.95, defense_strength: 1.05 },
  { id: 12, name: "Perú", country: "PER", group_name: "C", fifa_ranking: 40, attack_strength: 0.9, defense_strength: 1.05 },
  // Grupo D
  { id: 13, name: "Francia", country: "FRA", group_name: "D", fifa_ranking: 3, attack_strength: 1.5, defense_strength: 0.72 },
  { id: 14, name: "Bélgica", country: "BEL", group_name: "D", fifa_ranking: 5, attack_strength: 1.3, defense_strength: 0.82 },
  { id: 15, name: "Senegal", country: "SEN", group_name: "D", fifa_ranking: 20, attack_strength: 1.1, defense_strength: 0.92 },
  { id: 16, name: "Túnez", country: "TUN", group_name: "D", fifa_ranking: 30, attack_strength: 0.95, defense_strength: 1.0 },
  // Grupo E
  { id: 17, name: "Alemania", country: "GER", group_name: "E", fifa_ranking: 4, attack_strength: 1.4, defense_strength: 0.78 },
  { id: 18, name: "Portugal", country: "POR", group_name: "E", fifa_ranking: 6, attack_strength: 1.38, defense_strength: 0.8 },
  { id: 19, name: "Turquía", country: "TUR", group_name: "E", fifa_ranking: 28, attack_strength: 1.05, defense_strength: 0.95 },
  { id: 20, name: "Hungría", country: "HUN", group_name: "E", fifa_ranking: 32, attack_strength: 0.9, defense_strength: 1.05 },
  // Grupo F
  { id: 21, name: "Brasil", country: "BRA", group_name: "F", fifa_ranking: 5, attack_strength: 1.42, defense_strength: 0.76 },
  { id: 22, name: "Uruguay", country: "URU", group_name: "F", fifa_ranking: 17, attack_strength: 1.15, defense_strength: 0.88 },
  { id: 23, name: "Colombia", country: "COL", group_name: "F", fifa_ranking: 19, attack_strength: 1.12, defense_strength: 0.9 },
  { id: 24, name: "Bolivia", country: "BOL", group_name: "F", fifa_ranking: 60, attack_strength: 0.8, defense_strength: 1.15 },
  // Grupo G
  { id: 25, name: "Inglaterra", country: "ENG", group_name: "G", fifa_ranking: 5, attack_strength: 1.38, defense_strength: 0.8 },
  { id: 26, name: "Países Bajos", country: "NED", group_name: "G", fifa_ranking: 7, attack_strength: 1.32, defense_strength: 0.82 },
  { id: 27, name: "Suiza", country: "SUI", group_name: "G", fifa_ranking: 22, attack_strength: 1.05, defense_strength: 0.9 },
  { id: 28, name: "Serbia", country: "SRB", group_name: "G", fifa_ranking: 25, attack_strength: 1.08, defense_strength: 0.95 },
  // Grupo H
  { id: 29, name: "Italia", country: "ITA", group_name: "H", fifa_ranking: 9, attack_strength: 1.25, defense_strength: 0.82 },
  { id: 30, name: "Polonia", country: "POL", group_name: "H", fifa_ranking: 27, attack_strength: 1.05, defense_strength: 0.95 },
  { id: 31, name: "Ucrania", country: "UKR", group_name: "H", fifa_ranking: 21, attack_strength: 1.08, defense_strength: 0.92 },
  { id: 32, name: "Escocia", country: "SCO", group_name: "H", fifa_ranking: 35, attack_strength: 0.95, defense_strength: 1.0 },
  // Grupo I
  { id: 33, name: "Japón", country: "JPN", group_name: "I", fifa_ranking: 18, attack_strength: 1.12, defense_strength: 0.9 },
  { id: 34, name: "Corea del Sur", country: "KOR", group_name: "I", fifa_ranking: 23, attack_strength: 1.08, defense_strength: 0.92 },
  { id: 35, name: "Arabia Saudita", country: "KSA", group_name: "I", fifa_ranking: 56, attack_strength: 0.85, defense_strength: 1.1 },
  { id: 36, name: "Australia", country: "AUS", group_name: "I", fifa_ranking: 24, attack_strength: 1.05, defense_strength: 0.95 },
  // Grupo J
  { id: 37, name: "Costa de Marfil", country: "CIV", group_name: "J", fifa_ranking: 48, attack_strength: 0.92, defense_strength: 1.02 },
  { id: 38, name: "Nigeria", country: "NGA", group_name: "J", fifa_ranking: 38, attack_strength: 1.0, defense_strength: 1.0 },
  { id: 39, name: "Sudáfrica", country: "RSA", group_name: "J", fifa_ranking: 59, attack_strength: 0.85, defense_strength: 1.1 },
  { id: 40, name: "Ghana", country: "GHA", group_name: "J", fifa_ranking: 66, attack_strength: 0.88, defense_strength: 1.08 },
  // Grupo K
  { id: 41, name: "México B", country: "MEX2", group_name: "K", fifa_ranking: 16, attack_strength: 1.1, defense_strength: 1.0 },
  { id: 42, name: "Venezuela", country: "VEN", group_name: "K", fifa_ranking: 44, attack_strength: 0.95, defense_strength: 1.02 },
  { id: 43, name: "Honduras", country: "HON", group_name: "K", fifa_ranking: 72, attack_strength: 0.82, defense_strength: 1.12 },
  { id: 44, name: "Panamá", country: "PAN", group_name: "K", fifa_ranking: 50, attack_strength: 0.88, defense_strength: 1.08 },
  // Grupo L
  { id: 45, name: "Austria", country: "AUT", group_name: "L", fifa_ranking: 26, attack_strength: 1.08, defense_strength: 0.92 },
  { id: 46, name: "Dinamarca", country: "DEN", group_name: "L", fifa_ranking: 12, attack_strength: 1.18, defense_strength: 0.88 },
  { id: 47, name: "Eslovenia", country: "SVN", group_name: "L", fifa_ranking: 54, attack_strength: 0.88, defense_strength: 1.05 },
  { id: 48, name: "Kazajistán", country: "KAZ", group_name: "L", fifa_ranking: 102, attack_strength: 0.7, defense_strength: 1.2 },
]

export async function seed() {
  for (const t of TEAMS) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO teams (id, name, country, group_name, fifa_ranking, attack_strength, defense_strength)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [t.id, t.name, t.country, t.group_name, t.fifa_ranking, t.attack_strength, t.defense_strength],
    })
  }

  let fixtureId = 1
  const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"]
  for (const g of groups) {
    const gTeams = TEAMS.filter(t => t.group_name === g)
    for (let i = 0; i < gTeams.length; i++) {
      for (let j = i + 1; j < gTeams.length; j++) {
        await db.execute({
          sql: `INSERT OR REPLACE INTO fixtures (id, home_team_id, away_team_id, stage, status)
                VALUES (?, ?, ?, ?, ?)`,
          args: [fixtureId++, gTeams[i].id, gTeams[j].id, `group_${g}`, "scheduled"],
        })
      }
    }
  }

  console.log(`Seed completo: ${TEAMS.length} equipos, ${fixtureId - 1} fixtures de fase de grupos`)
}
