// Shared types for the betting assistant

export interface TeamStrength {
  id: number
  name: string
  country: string
  groupName: string
  fifaRanking: number
  attackStrength: number
  defenseStrength: number
}

export interface H2HRecord {
  date: string
  homeTeamId: number
  awayTeamId: number
  homeGoals: number
  awayGoals: number
  competition: 'world_cup' | 'continental' | 'qualifier' | 'friendly'
}

export interface FormRecord {
  date: string
  opponentRanking: number
  goalsFor: number
  goalsAgainst: number
  isHome: boolean
}

export interface Injury {
  playerId: number
  playerName: string
  position: string
  reason: string
  status: 'out' | 'doubtful'
}

export interface Player {
  id: number
  name: string
  position: string
  goals_per_90: number
  shots_per_90: number
  isStarter?: boolean
}

export interface RefereeStats {
  id: number
  name: string
  avgYellowsPerGame: number
  avgRedsPerGame: number
  totalGames: number
}

export interface MarketOdds {
  market: string
  selection: string
  odds: number
  bookmaker: string
  updatedAt: string
}

export interface MatchData {
  fixture: {
    id: number
    date: string
    stadium: string
    city: string
    altitudeM: number
    homeTeamId: number
    awayTeamId: number
    stage: string
  }
  teams: {
    home: TeamStrength
    away: TeamStrength
  }
  h2h: H2HRecord[]
  homeForm: FormRecord[]
  awayForm: FormRecord[]
  injuries: { home: Injury[]; away: Injury[] }
  lineups: { home: Player[] | null; away: Player[] | null }
  referee: RefereeStats | null
  weather: { tempC: number; humidity: number } | null
  odds: MarketOdds[]
  dataQuality: number
  fetchedAt: string
}

export interface ModelOutput {
  lambdaHome: number
  lambdaAway: number
  adjustmentsApplied: string[]
  scoreMatrix: number[][]
}

export interface MarketResult {
  name: string
  selection: string
  ourProbability: number
  bookmakerProbability: number | null
  odds: number | null
  bookmaker: string | null
  EV: number | null
  edge: number | null
  kellyFraction: number | null
  kellyAmount: number | null
  correlationGroup: string
  isRecommended: boolean
  oddsStale: boolean
}

export interface MatchAnalysis {
  fixtureId: number
  confidence: number
  isPreliminary: boolean
  model: ModelOutput
  markets: MarketResult[]
  alerts: string[]
  lastUpdated: string
}

export interface BankrollState {
  current: number
  initial: number
  weeklySnapshot: number
  mode: 'normal' | 'conservative' | 'paused'
  consecutiveLosses: number
  lastUpdated: string
}

export interface Bet {
  id?: number
  fixtureId: number
  market: string
  selection: string
  ourProbability: number
  bookmakerProbability: number | null
  oddsUsed: number
  oddsClosing: number | null
  amount: number
  kellySuggested: number
  EV: number
  edge: number
  result: 'win' | 'loss' | 'void' | null
  profitLoss: number | null
  mode: 'real' | 'paper'
  confidenceAtTime: number
  createdAt: string
  settledAt: string | null
}
