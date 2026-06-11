// scripts/backtest/constants.ts

/** Average goals per team per WC match — used to normalize attack/defense strengths */
export const WC_AVG_GOALS = 1.35

/** Sentinel value for a team not found in TEAM_IDS — should never appear in practice */
export const UNKNOWN_TEAM_ID = -99

/** Cutoff date — no match data after this is used for form/H2H calculation */
export const QATAR_START = "2022-11-20"

/**
 * Maps variant team names found in CSVs to the canonical name used throughout
 * the backtest. Add entries whenever a CSV uses a non-standard name.
 */
export const TEAM_NAME_MAP: Record<string, string> = {
  "United States":       "USA",
  "IR Iran":             "Iran",
  "Korea Republic":      "South Korea",
  "Republic of Korea":   "South Korea",
  "Australie":           "Australia",
  "Saudi-Arabia":        "Saudi Arabia",
  "KSA":                 "Saudi Arabia",
  "West Germany":        "Germany",
}

/**
 * Synthetic negative IDs for the 32 Qatar 2022 teams.
 * Negative to avoid collision with real Turso fixture/team IDs.
 */
export const TEAM_IDS: Record<string, number> = {
  // Group A
  "Qatar":        -1,  "Ecuador":      -2,  "Senegal":     -3,  "Netherlands": -4,
  // Group B
  "England":      -5,  "Iran":         -6,  "USA":         -7,  "Wales":       -8,
  // Group C
  "Argentina":    -9,  "Saudi Arabia": -10, "Mexico":      -11, "Poland":      -12,
  // Group D
  "France":       -13, "Australia":    -14, "Denmark":     -15, "Tunisia":     -16,
  // Group E
  "Spain":        -17, "Costa Rica":   -18, "Germany":     -19, "Japan":       -20,
  // Group F
  "Belgium":      -21, "Canada":       -22, "Morocco":     -23, "Croatia":     -24,
  // Group G
  "Brazil":       -25, "Serbia":       -26, "Switzerland": -27, "Cameroon":    -28,
  // Group H
  "Portugal":     -29, "Ghana":        -30, "Uruguay":     -31, "South Korea": -32,
}

export const WC2022_TEAMS = Object.keys(TEAM_IDS)

/** Group each Qatar 2022 team belongs to */
export const TEAM_GROUPS: Record<string, string> = {
  "Qatar": "A",       "Ecuador": "A",    "Senegal": "A",      "Netherlands": "A",
  "England": "B",     "Iran": "B",       "USA": "B",          "Wales": "B",
  "Argentina": "C",   "Saudi Arabia": "C","Mexico": "C",       "Poland": "C",
  "France": "D",      "Australia": "D",  "Denmark": "D",      "Tunisia": "D",
  "Spain": "E",       "Costa Rica": "E", "Germany": "E",      "Japan": "E",
  "Belgium": "F",     "Canada": "F",     "Morocco": "F",      "Croatia": "F",
  "Brazil": "G",      "Serbia": "G",     "Switzerland": "G",  "Cameroon": "G",
  "Portugal": "H",    "Ghana": "H",      "Uruguay": "H",      "South Korea": "H",
}
