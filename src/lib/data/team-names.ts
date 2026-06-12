// Mapa único de nombres de selección entre el español de la DB, el inglés de los CSV
// y las variantes de las APIs externas (The Odds API, API-Football).

const EN_TO_ES: Record<string, string> = {
  "Mexico": "México", "South Africa": "Sudáfrica", "South Korea": "República de Corea",
  "Czech Republic": "Chequia", "Canada": "Canadá", "Bosnia and Herzegovina": "Bosnia y Herzegovina",
  "Qatar": "Catar", "Switzerland": "Suiza", "Brazil": "Brasil", "Morocco": "Marruecos",
  "Haiti": "Haití", "Scotland": "Escocia", "United States": "Estados Unidos", "Paraguay": "Paraguay",
  "Australia": "Australia", "Turkey": "Turquía", "Germany": "Alemania", "Curaçao": "Curazao",
  "Ivory Coast": "Costa de Marfil", "Ecuador": "Ecuador", "Netherlands": "Países Bajos",
  "Japan": "Japón", "Sweden": "Suecia", "Tunisia": "Túnez", "Belgium": "Bélgica", "Egypt": "Egipto",
  "Iran": "RI de Irán", "New Zealand": "Nueva Zelanda", "Spain": "España",
  "Cape Verde": "Islas de Cabo Verde", "Saudi Arabia": "Arabia Saudí", "Uruguay": "Uruguay",
  "France": "Francia", "Senegal": "Senegal", "Iraq": "Irak", "Norway": "Noruega",
  "Argentina": "Argentina", "Algeria": "Argelia", "Austria": "Austria", "Jordan": "Jordania",
  "Portugal": "Portugal", "DR Congo": "RD Congo", "Uzbekistan": "Uzbekistán", "Colombia": "Colombia",
  "England": "Inglaterra", "Croatia": "Croacia", "Ghana": "Ghana", "Panama": "Panamá",
}

// Alias de las APIs hacia su forma inglesa canónica del mapa de arriba.
const API_ALIASES: Record<string, string> = {
  "usa": "united states",
  "bosnia & herzegovina": "bosnia and herzegovina",
  "bosniaherzegovina": "bosniaandherzegovina",
  "south korea": "south korea",
  "ivory coast": "ivory coast",
  "côte d'ivoire": "ivory coast",
  "cote divoire": "ivory coast",
  "türkiye": "turkey",
  "czechia": "czech republic",
}

const ES_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_ES).map(([en, es]) => [es, en])
)

export function toSpanish(name: string): string { return EN_TO_ES[name] ?? name }
export function toEnglish(name: string): string { return ES_TO_EN[name] ?? name }

// Normaliza a minúsculas sin acentos ni símbolos, conservando solo letras.
export function normName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "").replace(/[^a-z]/g, "")
}

function canonical(name: string): string {
  // Nombre español conocido -> su forma inglesa canónica.
  if (ES_TO_EN[name]) return normName(ES_TO_EN[name])
  // Si no, aplica alias de API (USA, Bosnia &, etc.) y normaliza.
  const lower = name.toLowerCase().trim()
  const aliased = API_ALIASES[lower] ?? lower
  return normName(aliased)
}

// True si dos nombres (en cualquier idioma/variante) refieren a la misma selección.
export function matchesTeam(a: string, b: string): boolean {
  return canonical(a) === canonical(b)
}
