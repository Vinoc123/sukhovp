import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { START_PUZZLE_RATING, START_RATING } from '../engine/elo.ts'

const dir = path.join(process.cwd(), 'data')
mkdirSync(dir, { recursive: true })

export const db = new DatabaseSync(path.join(dir, 'kvartet.sqlite'))
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT ${START_RATING},
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    puzzle_solved INTEGER NOT NULL DEFAULT 0,
    puzzle_rating INTEGER NOT NULL DEFAULT ${START_PUZZLE_RATING},
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    preset_id TEXT NOT NULL,
    modifier TEXT NOT NULL,
    rows INTEGER NOT NULL,
    cols INTEGER NOT NULL,
    connect INTEGER NOT NULL,
    time_id TEXT NOT NULL,
    time_initial_ms INTEGER NOT NULL,
    time_increment_ms INTEGER NOT NULL,
    per_move INTEGER NOT NULL,
    rated INTEGER NOT NULL,
    player1_id INTEGER NOT NULL REFERENCES users(id),
    player2_id INTEGER REFERENCES users(id),
    bot_level TEXT,
    moves TEXT NOT NULL,
    clock1_ms INTEGER NOT NULL,
    clock2_ms INTEGER NOT NULL,
    last_tick_at INTEGER NOT NULL,
    winner INTEGER NOT NULL DEFAULT 0,
    win_reason TEXT,
    rating_delta1 INTEGER,
    rating_delta2 INTEGER,
    draw_offer INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    finished_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS rating_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL,
    game_id TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS puzzle_progress (
    user_id INTEGER NOT NULL REFERENCES users(id),
    puzzle_id TEXT NOT NULL,
    solved INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, puzzle_id)
  );

  CREATE INDEX IF NOT EXISTS users_rating ON users(rating DESC);
  CREATE INDEX IF NOT EXISTS games_players ON games(player1_id, player2_id, finished_at);
`)

export interface UserRow {
  id: number
  username: string
  password_hash: string
  rating: number
  games_played: number
  wins: number
  losses: number
  draws: number
  puzzle_solved: number
  puzzle_rating: number
  created_at: number
}

export interface GameRow {
  id: string
  status: 'waiting' | 'active' | 'finished'
  preset_id: string
  modifier: string
  rows: number
  cols: number
  connect: number
  time_id: string
  time_initial_ms: number
  time_increment_ms: number
  per_move: number
  rated: number
  player1_id: number
  player2_id: number | null
  bot_level: string | null
  moves: string
  clock1_ms: number
  clock2_ms: number
  last_tick_at: number
  winner: number
  win_reason: string | null
  rating_delta1: number | null
  rating_delta2: number | null
  draw_offer: number
  created_at: number
  finished_at: number | null
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const actual = scryptSync(password, salt, 32)
  const expected = Buffer.from(hash, 'hex')
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    rating: user.rating,
    puzzleRating: user.puzzle_rating,
    gamesPlayed: user.games_played,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
  }
}
