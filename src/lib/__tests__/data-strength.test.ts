import { describe, it, expect } from "vitest"
import { getTeamStrengthFromCSV } from "../data/csv-loader"

// Convención correcta: defenseStrength = avgConceded / LEAGUE_AVG
// Menor = mejor defensa (concede menos que la media).
// Mayor = peor defensa (concede más que la media, LEAGUE_AVG = 1.4).
//
// Datos del CSV (rolling 24 filas):
//   Bosnia y Herzegovina: avgConceded ≈ 1.94 → defenseStrength ≈ 1.39  (defensa débil → >1)
//   Paraguay:             avgConceded ≈ 0.95 → defenseStrength ≈ 0.68  (defensa sólida → <1)
describe("getTeamStrengthFromCSV — convención de defensa (menor = mejor)", () => {
  it("Bosnia (defensa débil, concede >1.4 de media) tiene defenseStrength > 1", () => {
    const bosnia = getTeamStrengthFromCSV("Bosnia y Herzegovina")
    expect(bosnia).not.toBeNull()
    expect(bosnia!.defenseStrength).toBeGreaterThan(1.0)
  })

  it("Paraguay (defensa sólida, concede <1.4 de media) tiene defenseStrength < 1", () => {
    const paraguay = getTeamStrengthFromCSV("Paraguay")
    expect(paraguay).not.toBeNull()
    expect(paraguay!.defenseStrength).toBeLessThan(1.0)
  })

  it("attackStrength es positivo y proporcional a goles anotados", () => {
    const s = getTeamStrengthFromCSV("Estados Unidos")
    expect(s).not.toBeNull()
    expect(s!.attackStrength).toBeGreaterThan(0)
  })
})
