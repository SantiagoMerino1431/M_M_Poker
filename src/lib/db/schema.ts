import { db } from "./client"

export async function migrate() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      group_name TEXT NOT NULL,
      fifa_ranking INTEGER DEFAULT 50,
      attack_strength REAL DEFAULT 1.0,
      defense_strength REAL DEFAULT 1.0
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY,
      team_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      position TEXT,
      goals_per_90 REAL DEFAULT 0.1
    );

    CREATE TABLE IF NOT EXISTS fixtures (
      id INTEGER PRIMARY KEY,
      home_team_id INTEGER NOT NULL,
      away_team_id INTEGER NOT NULL,
      match_date TEXT,
      stage TEXT NOT NULL,
      status TEXT DEFAULT 'scheduled',
      home_score INTEGER,
      away_score INTEGER,
      api_fixture_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS match_stats (
      id INTEGER PRIMARY KEY,
      fixture_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      corners INTEGER DEFAULT 0,
      yellow_cards INTEGER DEFAULT 0,
      red_cards INTEGER DEFAULT 0,
      shots_on_target INTEGER DEFAULT 0,
      possession REAL DEFAULT 50.0
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY,
      fixture_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      home_win REAL NOT NULL,
      draw REAL NOT NULL,
      away_win REAL NOT NULL,
      over_15 REAL NOT NULL,
      over_25 REAL NOT NULL,
      over_35 REAL NOT NULL,
      btts REAL NOT NULL,
      expected_home_goals REAL NOT NULL,
      expected_away_goals REAL NOT NULL,
      exact_scores TEXT NOT NULL,
      corners_over REAL NOT NULL,
      cards_over REAL NOT NULL,
      clean_sheet_home REAL NOT NULL,
      clean_sheet_away REAL NOT NULL
    );
  `)
}
