import * as fs from "fs"
import * as path from "path"
import type { H2HRecord, FormRecord } from "../types"

const DATA_DIR = path.join(process.cwd(), "data")

// Maps English team names (used in CSVs) to Spanish names used in the seed/DB
const EN_TO_ES: Record<string, string> = {
  "Mexico": "México",
  "South Africa": "Sudáfrica",
  "South Korea": "República de Corea",
  "Czech Republic": "Chequia",
  "Canada": "Canadá",
  "Bosnia and Herzegovina": "Bosnia y Herzegovina",
  "Qatar": "Catar",
  "Switzerland": "Suiza",
  "Brazil": "Brasil",
  "Morocco": "Marruecos",
  "Haiti": "Haití",
  "Scotland": "Escocia",
  "United States": "Estados Unidos",
  "Paraguay": "Paraguay",
  "Australia": "Australia",
  "Turkey": "Turquía",
  "Germany": "Alemania",
  "Curaçao": "Curazao",
  "Ivory Coast": "Costa de Marfil",
  "Ecuador": "Ecuador",
  "Netherlands": "Países Bajos",
  "Japan": "Japón",
  "Sweden": "Suecia",
  "Tunisia": "Túnez",
  "Belgium": "Bélgica",
  "Egypt": "Egipto",
  "Iran": "RI de Irán",
  "New Zealand": "Nueva Zelanda",
  "Spain": "España",
  "Cape Verde": "Islas de Cabo Verde",
  "Saudi Arabia": "Arabia Saudí",
  "Uruguay": "Uruguay",
  "France": "Francia",
  "Senegal": "Senegal",
  "Iraq": "Irak",
  "Norway": "Noruega",
  "Argentina": "Argentina",
  "Algeria": "Argelia",
  "Austria": "Austria",
  "Jordan": "Jordania",
  "Portugal": "Portugal",
  "DR Congo": "RD Congo",
  "Uzbekistan": "Uzbekistán",
  "Colombia": "Colombia",
  "England": "Inglaterra",
  "Croatia": "Croacia",
  "Ghana": "Ghana",
  "Panama": "Panamá",
}
const ES_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_ES).map(([en, es]) => [es, en])
)

function toSpanish(name: string): string { return EN_TO_ES[name] ?? name }
function toEnglish(name: string): string  { return ES_TO_EN[name] ?? name }

function normName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "").replace(/[\s'\-.]/g, "")
}

// --- results.csv --------------------------------------------------------

type ResultRow = {
  date: string; home: string; away: string
  homeScore: number | null; awayScore: number | null
  tournament: string; city: string; country: string; neutral: boolean
}

let resultsCache: ResultRow[] | null = null

function loadResults(): ResultRow[] {
  if (resultsCache) return resultsCache
  const raw = fs.readFileSync(path.join(DATA_DIR, "results.csv"), "utf-8")
  const lines = raw.split("\n").slice(1) // skip header
  resultsCache = lines
    .filter(l => l.trim())
    .map(l => {
      const [date, home, away, hs, as_, tournament, city, country, neutral] = l.split(",")
      return {
        date: date?.trim() ?? "",
        home: home?.trim() ?? "",
        away: away?.trim() ?? "",
        homeScore: hs?.trim() === "NA" || !hs ? null : Number(hs),
        awayScore: as_?.trim() === "NA" || !as_ ? null : Number(as_),
        tournament: tournament?.trim() ?? "",
        city: city?.trim() ?? "",
        country: country?.trim() ?? "",
        neutral: neutral?.trim().toUpperCase() === "TRUE",
      }
    })
  return resultsCache
}

export type WC2026Fixture = {
  date: string; home: string; away: string
  homeEs: string; awayEs: string
  city: string; country: string
}

export function loadWC2026Fixtures(): WC2026Fixture[] {
  return loadResults()
    .filter(r => r.tournament === "FIFA World Cup" && r.date.startsWith("2026"))
    .map(r => ({
      date: r.date,
      home: r.home,
      away: r.away,
      homeEs: toSpanish(r.home),
      awayEs: toSpanish(r.away),
      city: r.city,
      country: r.country,
    }))
}

// Returns H2H records between two teams (by Spanish or English name), up to last N
export function loadH2H(teamAName: string, teamBName: string, lastN = 10): H2HRecord[] {
  const a = normName(toEnglish(teamAName))
  const b = normName(toEnglish(teamBName))
  const results = loadResults()
  const matches = results.filter(r => {
    const h = normName(r.home)
    const aw = normName(r.away)
    return (h === a && aw === b) || (h === b && aw === a)
  })
  // Take most recent N with known scores
  const scored = matches
    .filter(r => r.homeScore !== null && r.awayScore !== null)
    .slice(-lastN)

  return scored.map(r => {
    const homeIsA = normName(r.home) === a
    return {
      date: r.date,
      homeTeamId: 0,
      awayTeamId: 0,
      homeGoals: r.homeScore!,
      awayGoals: r.awayScore!,
      competition: mapTournament(r.tournament),
    }
  })
}

function mapTournament(t: string): H2HRecord["competition"] {
  const n = t.toLowerCase()
  if (n.includes("world cup") && !n.includes("qualif")) return "world_cup"
  if (n.includes("euro") || n.includes("copa") || n.includes("nations") ||
      n.includes("afcon") || n.includes("asian") || n.includes("gold cup")) return "continental"
  if (n.includes("qualif")) return "qualifier"
  return "friendly"
}

// --- teams_form.csv -------------------------------------------------------

type FormRow = {
  team: string; date: string
  avgGoalsScored: number; avgGoalsConceded: number; winRate: number
}

let formCache: Map<string, FormRow[]> | null = null

function loadFormMap(): Map<string, FormRow[]> {
  if (formCache) return formCache
  const raw = fs.readFileSync(path.join(DATA_DIR, "teams_form.csv"), "utf-8")
  const lines = raw.split("\n").slice(1)
  const map = new Map<string, FormRow[]>()
  for (const l of lines) {
    if (!l.trim()) continue
    const [team, date, scored, conceded, winRate] = l.split(",")
    const key = normName(team?.trim() ?? "")
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push({
      team: team?.trim() ?? "",
      date: date?.trim() ?? "",
      avgGoalsScored: Number(scored),
      avgGoalsConceded: Number(conceded),
      winRate: Number(winRate),
    })
  }
  formCache = map
  return map
}

// Returns the most recent form snapshot for a team as FormRecord[]
export function loadTeamFormRecords(teamName: string, lastN = 5): FormRecord[] {
  const map = loadFormMap()
  const key = normName(toEnglish(teamName))
  const rows = map.get(key) ?? []
  return rows.slice(-lastN).map(r => ({
    date: r.date,
    opponentRanking: 50,
    goalsFor: r.avgGoalsScored,
    goalsAgainst: r.avgGoalsConceded,
    isHome: false,
  }))
}

// Returns attack/defense strength derived from rolling form averages (last 24 months)
export function getTeamStrengthFromCSV(teamName: string): { attackStrength: number; defenseStrength: number } | null {
  const map = loadFormMap()
  const key = normName(toEnglish(teamName))
  const rows = map.get(key)
  if (!rows || rows.length === 0) return null

  // Use last 24 months worth of rows (rolling snapshot per match)
  const recent = rows.slice(-24)
  const avgScored    = recent.reduce((s, r) => s + r.avgGoalsScored, 0) / recent.length
  const avgConceded  = recent.reduce((s, r) => s + r.avgGoalsConceded, 0) / recent.length

  const LEAGUE_AVG = 1.4
  return {
    attackStrength:  Math.max(0.5, Math.min(2.0, avgScored   / LEAGUE_AVG)),
    defenseStrength: Math.max(0.5, Math.min(2.0, avgConceded / LEAGUE_AVG)),
  }
}
