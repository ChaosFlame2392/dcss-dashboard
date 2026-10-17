/**
 * DCSS SQLite Database Schema & Initialization
 * Utilizes Node.js built-in `node:sqlite` for high performance, zero-dependency operations.
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DEFAULT_DB_PATH = path.resolve(__dirname, '../../dcss_stats.db');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  species_abbr TEXT NOT NULL,
  background TEXT NOT NULL,
  background_abbr TEXT NOT NULL,
  combo TEXT NOT NULL,
  char_name TEXT NOT NULL,
  god TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  turns INTEGER NOT NULL DEFAULT 0,
  aut INTEGER DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  start_time TEXT,
  end_time TEXT,
  place TEXT,
  branch TEXT,
  level INTEGER,
  xl INTEGER DEFAULT 1,
  hp INTEGER,
  max_hp INTEGER,
  mp INTEGER,
  max_mp INTEGER,
  killer TEXT,
  ktyp TEXT,
  dam INTEGER DEFAULT 0,
  outcome TEXT,
  is_win INTEGER NOT NULL DEFAULT 0,
  runes_count INTEGER NOT NULL DEFAULT 0,
  runes_list TEXT,
  turn_speed REAL NOT NULL DEFAULT 0.0,
  source_file TEXT,
  morgue_file TEXT,
  version TEXT,
  seed TEXT,
  game_type TEXT DEFAULT 'normal',
  is_active INTEGER NOT NULL DEFAULT 0,
  raw_data TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_games_end_time ON games(end_time);
CREATE INDEX IF NOT EXISTS idx_games_start_time ON games(start_time);
CREATE INDEX IF NOT EXISTS idx_games_combo ON games(combo);
CREATE INDEX IF NOT EXISTS idx_games_species_abbr ON games(species_abbr);
CREATE INDEX IF NOT EXISTS idx_games_background_abbr ON games(background_abbr);
CREATE INDEX IF NOT EXISTS idx_games_god ON games(god);
CREATE INDEX IF NOT EXISTS idx_games_is_win ON games(is_win);
CREATE INDEX IF NOT EXISTS idx_games_is_active ON games(is_active);
CREATE INDEX IF NOT EXISTS idx_games_score ON games(score);
`;

/**
 * Initializes and returns a DatabaseSync instance
 */
function initDatabase(dbPath = DEFAULT_DB_PATH) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  // Enable WAL mode for high read/write performance
  try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
  } catch (err) {
    // Some in-memory or limited environments may ignore WAL
  }

  db.exec(SCHEMA_SQL);

  return db;
}

module.exports = {
  initDatabase,
  DEFAULT_DB_PATH,
  SCHEMA_SQL,
};
