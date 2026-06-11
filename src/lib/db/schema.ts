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
      goals_per_90 REAL DEFAULT 0.1,
      shots_per_90 REAL DEFAULT 0.5
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
      api_fixture_id INTEGER,
      stadium TEXT,
      city TEXT,
      altitude_m INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS match_analyses (
      id INTEGER PRIMARY KEY,
      fixture_id INTEGER NOT NULL,
      is_preliminary INTEGER NOT NULL DEFAULT 1,
      confidence INTEGER NOT NULL,
      lambda_home REAL NOT NULL,
      lambda_away REAL NOT NULL,
      adjustments_applied TEXT NOT NULL,
      markets TEXT NOT NULL,
      alerts TEXT NOT NULL,
      data_quality INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY,
      fixture_id INTEGER NOT NULL,
      market TEXT NOT NULL,
      selection TEXT NOT NULL,
      our_probability REAL NOT NULL,
      bookmaker_probability REAL,
      odds_used REAL NOT NULL,
      odds_closing REAL,
      amount REAL NOT NULL,
      kelly_suggested REAL NOT NULL,
      ev REAL NOT NULL,
      edge REAL NOT NULL,
      result TEXT,
      profit_loss REAL,
      mode TEXT NOT NULL DEFAULT 'real',
      confidence_at_time INTEGER,
      created_at TEXT NOT NULL,
      settled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS bankroll_snapshots (
      id INTEGER PRIMARY KEY,
      balance REAL NOT NULL,
      snapshot_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY,
      fixture_id INTEGER,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS match_analyses (
      id INTEGER PRIMARY KEY,
      fixture_id INTEGER NOT NULL,
      is_preliminary INTEGER NOT NULL DEFAULT 1,
      confidence INTEGER NOT NULL,
      lambda_home REAL NOT NULL,
      lambda_away REAL NOT NULL,
      adjustments_applied TEXT NOT NULL,
      markets TEXT NOT NULL,
      alerts TEXT NOT NULL,
      data_quality INTEGER NOT NULL,
      home_team TEXT DEFAULT '',
      away_team TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY,
      fixture_id INTEGER NOT NULL,
      market TEXT NOT NULL,
      selection TEXT NOT NULL,
      our_probability REAL NOT NULL,
      bookmaker_probability REAL,
      odds_used REAL NOT NULL,
      odds_closing REAL,
      amount REAL NOT NULL,
      kelly_suggested REAL NOT NULL,
      ev REAL NOT NULL,
      edge REAL NOT NULL,
      result TEXT,
      profit_loss REAL,
      mode TEXT NOT NULL DEFAULT 'real',
      confidence_at_time INTEGER,
      created_at TEXT NOT NULL,
      settled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS bankroll_snapshots (
      id INTEGER PRIMARY KEY,
      balance REAL NOT NULL,
      snapshot_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY,
      fixture_id INTEGER,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `)

  // Add columns to existing tables (safe to run multiple times)
  for (const sql of [
    "ALTER TABLE match_analyses ADD COLUMN home_team TEXT DEFAULT ''",
    "ALTER TABLE match_analyses ADD COLUMN away_team TEXT DEFAULT ''",
    "ALTER TABLE fixtures ADD COLUMN stadium TEXT",
    "ALTER TABLE fixtures ADD COLUMN city TEXT",
    "ALTER TABLE fixtures ADD COLUMN match_date TEXT",
    "ALTER TABLE fixtures ADD COLUMN altitude_m INTEGER DEFAULT 0",
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      initial_bankroll REAL NOT NULL DEFAULT 100000,
      created_at TEXT NOT NULL
    )`,
    "ALTER TABLE bets ADD COLUMN user_id INTEGER",
    "ALTER TABLE bankroll_snapshots ADD COLUMN user_id INTEGER",
  ]) {
    try { await db.execute(sql) } catch { /* already exists */ }
  }
}
