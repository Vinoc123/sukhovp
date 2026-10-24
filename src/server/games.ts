import { randomBytes } from 'node:crypto'
import { chooseMove } from '../engine/ai.ts'
import { applyMove, createGame } from '../engine/board.ts'
import type { GameState } from '../engine/types.ts'
import { eloDelta, rankTitle } from '../engine/elo.ts'
import { matchSettings } from '../engine/presets.ts'
import { getPuzzle, PUZZLES, reviewAttempt, toPublic, type Puzzle } from '../engine/puzzles.ts'
import type { Action, BotLevel, Modifier } from '../engine/types.ts'
import { afterTurn, charge, remaining, unlimitedClock, type Clock } from './clock.ts'
import { db, type GameRow, type UserRow } from './db.ts'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface Settings {
  presetId: string
  modifier: Modifier
  timeId: string
  rated: boolean
}

interface Ticket {
  id: string
  userId: number
  key: string
  settings: Settings
  gameId: string | null
}

const tickets = new Map<string, Ticket>()

function code(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(length)
  let value = ''
  for (let i = 0; i < length; i++) value += alphabet[bytes[i] % alphabet.length]
  return value
}

function freshId(): string {
  for (let i = 0; i < 8; i++) {
    const id = code()
    if (!db.prepare('SELECT 1 FROM games WHERE id = ?').get(id)) return id
  }
  throw new ApiError(500, 'Не удалось создать партию')
}

function parseSettings(input: { presetId?: string; modifier?: string; timeId?: string; rated?: boolean }): Settings {
  const matched = matchSettings(input)
  if (!matched) throw new ApiError(400, 'Таких правил нет')
  return {
    presetId: input.presetId!,
    modifier: matched.rules.modifier,
    timeId: matched.time.id,
    rated: Boolean(input.rated),
  }
}

function settingsKey(settings: Settings): string {
  return `${settings.presetId}|${settings.modifier}|${settings.timeId}|${settings.rated ? 1 : 0}`
}

export function getGame(id: string): GameRow | undefined {
  return db.prepare('SELECT * FROM games WHERE id = ?').get(id) as GameRow | undefined
}

function mustGame(id: string): GameRow {
  const game = getGame(id)
  if (!game) throw new ApiError(404, 'Партия не найдена')
  return game
}

function userById(id: number): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
}

function replay(game: GameRow): GameState {
  let state = createGame({
    rows: game.rows,
    cols: game.cols,
    connect: game.connect,
    modifier: game.modifier as Modifier,
  })
  const moves = JSON.parse(game.moves) as Action[]
  for (const move of moves) state = applyMove(state, move)
  return state
}

function readClock(game: GameRow, state: GameState): Clock {
  return {
    clock1: game.clock1_ms,
    clock2: game.clock2_ms,
    lastTick: game.last_tick_at,
    initialMs: game.time_initial_ms,
    incrementMs: game.time_increment_ms,
    perMove: Boolean(game.per_move),
    running: game.status === 'active',
    turn: state.turn,
  }
}

function writeClock(game: GameRow, clock: Clock) {
  game.clock1_ms = clock.clock1
  game.clock2_ms = clock.clock2
  game.last_tick_at = clock.lastTick
}

function saveGame(game: GameRow) {
  db.prepare(`
    UPDATE games SET
      status = ?, player2_id = ?, moves = ?, clock1_ms = ?, clock2_ms = ?, last_tick_at = ?,
      winner = ?, win_reason = ?, rating_delta1 = ?, rating_delta2 = ?, draw_offer = ?, finished_at = ?
    WHERE id = ?
  `).run(
    game.status,
    game.player2_id,
    game.moves,
    game.clock1_ms,
    game.clock2_ms,
    game.last_tick_at,
    game.winner,
    game.win_reason,
    game.rating_delta1,
    game.rating_delta2,
    game.draw_offer,
    game.finished_at,
    game.id,
  )
}

function bumpStats(user: UserRow, result: 'win' | 'loss' | 'draw', nextRating: number | null, gameId: string, now: number) {
  const wins = user.wins + (result === 'win' ? 1 : 0)
  const losses = user.losses + (result === 'loss' ? 1 : 0)
  const draws = user.draws + (result === 'draw' ? 1 : 0)
  const rating = nextRating ?? user.rating
  db.prepare(`
    UPDATE users SET wins = ?, losses = ?, draws = ?, games_played = games_played + 1, rating = ? WHERE id = ?
  `).run(wins, losses, draws, rating, user.id)
  if (nextRating !== null) {
    db.prepare('INSERT INTO rating_history (user_id, rating, game_id, created_at) VALUES (?, ?, ?, ?)').run(
      user.id,
      nextRating,
      gameId,
      now,
    )
  }
}

function finish(game: GameRow, winner: number, reason: string, now: number) {
  if (game.status === 'finished') return game
  game.status = 'finished'
  game.winner = winner
  game.win_reason = reason
  game.finished_at = now
  game.draw_offer = 0
  const first = userById(game.player1_id)
  const second = game.player2_id ? userById(game.player2_id) : undefined
  const rated = Boolean(game.rated) && Boolean(second) && !game.bot_level
  let delta1: number | null = null
  let delta2: number | null = null
  if (rated && first && second) {
    const score1 = winner === 3 ? 0.5 : winner === 1 ? 1 : 0
    delta1 = eloDelta(first.rating, second.rating, score1, first.games_played)
    delta2 = eloDelta(second.rating, first.rating, 1 - score1, second.games_played)
  }
  game.rating_delta1 = delta1
  game.rating_delta2 = delta2
  if (first) {
    const result = winner === 3 ? 'draw' : winner === 1 ? 'win' : 'loss'
    bumpStats(first, result, delta1 === null ? null : first.rating + delta1, game.id, now)
  }
  if (second) {
    const result = winner === 3 ? 'draw' : winner === 2 ? 'win' : 'loss'
    bumpStats(second, result, delta2 === null ? null : second.rating + delta2, game.id, now)
  }
  saveGame(game)
  return game
}

function flagClock(game: GameRow, side: 1 | 2) {
  if (side === 1) game.clock1_ms = 0
  else game.clock2_ms = 0
}

function expireClock(game: GameRow, now: number): GameRow {
  if (game.status !== 'active') return game
  const state = replay(game)
  const clock = readClock(game, state)
  if (!clock.running || unlimitedClock(clock)) return game
  if (remaining(clock, now, state.turn) > 0) return game
  flagClock(game, state.turn)
  return finish(game, state.turn === 1 ? 2 : 1, 'timeout', now)
}

function seatOf(game: GameRow, userId: number | null): 1 | 2 | null {
  if (!userId) return null
  if (game.player1_id === userId) return 1
  if (game.player2_id === userId) return 2
  return null
}

function present(game: GameRow, viewerId: number | null, now = Date.now()) {
  const state = replay(game)
  const clock = readClock(game, state)
  const running = game.status === 'active' && !unlimitedClock(clock)
  const first = userById(game.player1_id)
  const second = game.player2_id ? userById(game.player2_id) : undefined
  const players: Array<{
    seat: 1 | 2
    username: string
    rating: number | null
    clockMs: number
    delta: number | null
  }> = [
    {
      seat: 1,
      username: first?.username ?? 'Игрок',
      rating: first?.rating ?? null,
      clockMs: Math.max(0, remaining(clock, now, 1)),
      delta: game.rating_delta1,
    },
  ]
  if (game.bot_level || second) {
    players.push({
      seat: 2,
      username: game.bot_level ? 'Робот' : (second?.username ?? 'Игрок'),
      rating: game.bot_level ? null : (second?.rating ?? null),
      clockMs: Math.max(0, remaining(clock, now, 2)),
      delta: game.rating_delta2,
    })
  }
  const finished = game.status === 'finished'
  return {
    id: game.id,
    status: game.status,
    presetId: game.preset_id,
    modifier: game.modifier,
    timeId: game.time_id,
    rated: Boolean(game.rated),
    botLevel: game.bot_level,
    you: seatOf(game, viewerId),
    winner: finished ? game.winner : state.winner,
    winReason: game.win_reason,
    winLine: finished && game.win_reason !== 'line' ? null : state.winLine,
    rows: state.rules.rows,
    cols: state.rules.cols,
    connect: state.rules.connect,
    initialRows: game.rows,
    initialCols: game.cols,
    cells: state.cells,
    turn: state.turn,
    gravity: state.gravity,
    rushLeft: state.rushLeft,
    plies: state.plies,
    moves: JSON.parse(game.moves) as Action[],
    drawOffer: game.draw_offer,
    clockRunning: running,
    unlimited: unlimitedClock(clock),
    players,
  }
}

function insertGame(owner: UserRow, settings: Settings, extra: { player2?: number | null; botLevel?: BotLevel | null; status: 'waiting' | 'active' }) {
  const matched = matchSettings(settings)
  if (!matched) throw new ApiError(400, 'Таких правил нет')
  const now = Date.now()
  const id = freshId()
  const rated = extra.botLevel ? 0 : settings.rated ? 1 : 0
  db.prepare(`
    INSERT INTO games (
      id, status, preset_id, modifier, rows, cols, connect, time_id, time_initial_ms, time_increment_ms,
      per_move, rated, player1_id, player2_id, bot_level, moves, clock1_ms, clock2_ms, last_tick_at,
      winner, draw_offer, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, 0, 0, ?)
  `).run(
    id,
    extra.status,
    settings.presetId,
    settings.modifier,
    matched.rules.rows,
    matched.rules.cols,
    matched.rules.connect,
    settings.timeId,
    matched.time.initialMs,
    matched.time.incrementMs,
    matched.time.perMove ? 1 : 0,
    rated,
    owner.id,
    extra.player2 ?? null,
    extra.botLevel ?? null,
    matched.time.initialMs,
    matched.time.initialMs,
    now,
    now,
  )
  return mustGame(id)
}

export function createBotGame(owner: UserRow, input: Settings & { botLevel?: string }) {
  const settings = parseSettings(input)
  const level = input.botLevel
  if (level !== 'easy' && level !== 'medium' && level !== 'hard') throw new ApiError(400, 'Не выбран уровень робота')
  const game = insertGame(owner, { ...settings, rated: false }, { status: 'active', botLevel: level })
  return present(game, owner.id)
}

export function createRoom(owner: UserRow, input: Settings) {
  const settings = parseSettings(input)
  const game = insertGame(owner, settings, { status: 'waiting' })
  return present(game, owner.id)
}

export function joinRoom(user: UserRow, id: string) {
  return transaction(() => {
    const game = mustGame(id)
    if (game.status !== 'waiting' || game.bot_level) throw new ApiError(400, 'В эту комнату уже нельзя войти')
    if (game.player1_id === user.id) throw new ApiError(400, 'Это ваша комната')
    game.player2_id = user.id
    game.status = 'active'
    game.last_tick_at = Date.now()
    saveGame(game)
    return present(game, user.id)
  })
}

export function enqueue(user: UserRow, input: Settings) {
  const settings = parseSettings(input)
  const key = settingsKey(settings)
  for (const [id, ticket] of tickets) {
    if (ticket.userId === user.id && !ticket.gameId) tickets.delete(id)
  }
  const other = [...tickets.values()].find((ticket) => ticket.key === key && !ticket.gameId && ticket.userId !== user.id)
  if (other) {
    const owner = userById(other.userId)
    if (!owner) {
      tickets.delete(other.id)
    } else {
      const game = insertGame(owner, settings, { status: 'active', player2: user.id })
      other.gameId = game.id
      const mine: Ticket = { id: code(8), userId: user.id, key, settings, gameId: game.id }
      tickets.set(mine.id, mine)
      return { ticketId: mine.id, gameId: game.id }
    }
  }
  const ticket: Ticket = { id: code(8), userId: user.id, key, settings, gameId: null }
  tickets.set(ticket.id, ticket)
  return { ticketId: ticket.id, gameId: null }
}

export function ticketStatus(userId: number, ticketId: string) {
  const ticket = tickets.get(ticketId)
  if (!ticket || ticket.userId !== userId) throw new ApiError(404, 'Поиск не найден')
  return { ticketId, gameId: ticket.gameId }
}

export function cancelTicket(userId: number, ticketId: string) {
  const ticket = tickets.get(ticketId)
  if (ticket && ticket.userId === userId && !ticket.gameId) tickets.delete(ticketId)
}

function transaction<T>(run: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const value = run()
    db.exec('COMMIT')
    return value
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function playBot(game: GameRow, state: GameState, clock: Clock, moves: Action[]) {
  while (game.bot_level && !state.winner && state.turn === 2) {
    const move = chooseMove(state, game.bot_level as BotLevel)
    const charged = charge(clock, Date.now(), 2)
    if (charged.flagged) {
      flagClock(game, 2)
      finish(game, 1, 'timeout', Date.now())
      return { state, clock, moves, done: true }
    }
    const before = state.turn
    state = applyMove(state, move)
    moves.push(move)
    clock = afterTurn(charged.clock, 2, state.turn, state.turn !== before, Boolean(state.winner))
  }
  return { state, clock, moves, done: false }
}

export function playMove(user: UserRow, id: string, action: Action) {
  if (action?.type !== 'drop' && action?.type !== 'pop') throw new ApiError(400, 'Непонятный ход')
  if (!Number.isInteger(action.col)) throw new ApiError(400, 'Непонятный ход')
  return transaction(() => {
    let game = expireClock(mustGame(id), Date.now())
    if (game.status === 'waiting') throw new ApiError(400, 'Соперник ещё не вошёл')
    if (game.status === 'finished') throw new ApiError(400, 'Партия уже закончена')
    const seat = seatOf(game, user.id)
    let state = replay(game)
    if (seat !== state.turn) throw new ApiError(400, 'Сейчас ход соперника')
    const now = Date.now()
    let clock = readClock(game, state)
    const charged = charge(clock, now, state.turn)
    if (charged.flagged) {
      flagClock(game, state.turn)
      game = finish(game, state.turn === 1 ? 2 : 1, 'timeout', now)
      return present(game, user.id)
    }
    let moves = JSON.parse(game.moves) as Action[]
    const before = state.turn
    try {
      state = applyMove(state, action)
    } catch {
      throw new ApiError(400, 'Такой ход невозможен')
    }
    moves.push(action)
    clock = afterTurn(charged.clock, before, state.turn, state.turn !== before, Boolean(state.winner))
    game.moves = JSON.stringify(moves)
    game.draw_offer = 0
    writeClock(game, clock)
    const bot = playBot(game, state, clock, moves)
    if (bot.done) return present(mustGame(id), user.id)
    state = bot.state
    clock = bot.clock
    moves = bot.moves
    game.moves = JSON.stringify(moves)
    writeClock(game, clock)
    if (state.winner) {
      const reason = state.winner === 3 ? 'draw' : 'line'
      game = finish(game, state.winner, reason, Date.now())
    } else saveGame(game)
    return present(mustGame(id), user.id)
  })
}

export function resign(user: UserRow, id: string) {
  return transaction(() => {
    const game = expireClock(mustGame(id), Date.now())
    if (game.status !== 'active') throw new ApiError(400, 'Эту партию уже не сдать')
    const seat = seatOf(game, user.id)
    if (!seat) throw new ApiError(403, 'Это не ваша партия')
    const finished = finish(game, seat === 1 ? 2 : 1, 'resign', Date.now())
    return present(finished, user.id)
  })
}

export function offerDraw(user: UserRow, id: string, action: string) {
  return transaction(() => {
    const game = expireClock(mustGame(id), Date.now())
    if (game.status !== 'active' || game.bot_level) throw new ApiError(400, 'Ничью здесь предложить нельзя')
    const seat = seatOf(game, user.id)
    if (!seat) throw new ApiError(403, 'Это не ваша партия')
    if (action === 'decline') {
      game.draw_offer = 0
      saveGame(game)
      return present(game, user.id)
    }
    if (action === 'accept' || (action === 'offer' && game.draw_offer && game.draw_offer !== seat)) {
      if (!game.draw_offer || game.draw_offer === seat) throw new ApiError(400, 'Соперник не предлагал ничью')
      const finished = finish(game, 3, 'agreement', Date.now())
      return present(finished, user.id)
    }
    if (action !== 'offer') throw new ApiError(400, 'Непонятное действие')
    game.draw_offer = seat
    saveGame(game)
    return present(game, user.id)
  })
}

export function openGame(id: string, viewerId: number | null) {
  return transaction(() => present(expireClock(mustGame(id), Date.now()), viewerId))
}

export function leaderboard(viewerId: number | null) {
  const rows = db.prepare('SELECT id, username, rating, wins, losses, draws, games_played FROM users ORDER BY rating DESC, username LIMIT 50').all() as Array<{
    id: number
    username: string
    rating: number
    wins: number
    losses: number
    draws: number
    games_played: number
  }>
  return {
    players: rows.map((row, index) => ({
      place: index + 1,
      username: row.username,
      rating: row.rating,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      games: row.games_played,
      you: row.id === viewerId,
    })),
  }
}

export function profile(username: string) {
  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as UserRow | undefined
  if (!user) throw new ApiError(404, 'Игрок не найден')
  const place = (db.prepare('SELECT COUNT(*) + 1 AS place FROM users WHERE rating > ?').get(user.rating) as { place: number }).place
  const history = db.prepare('SELECT rating, created_at FROM rating_history WHERE user_id = ? ORDER BY id').all(user.id) as Array<{
    rating: number
    created_at: number
  }>
  const recent = db.prepare(`
    SELECT * FROM games
    WHERE status = 'finished' AND (player1_id = ? OR player2_id = ?)
    ORDER BY finished_at DESC LIMIT 8
  `).all(user.id, user.id) as unknown as GameRow[]
  const solved = new Set(
    (db.prepare('SELECT puzzle_id FROM puzzle_progress WHERE user_id = ? AND solved = 1').all(user.id) as Array<{ puzzle_id: string }>).map(
      (row) => row.puzzle_id,
    ),
  )
  return {
    username: user.username,
    rating: user.rating,
    puzzleRating: user.puzzle_rating,
    rank: rankTitle(user.rating),
    place,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    gamesPlayed: user.games_played,
    puzzleSolved: user.puzzle_solved,
    createdAt: user.created_at,
    history: history.map((point) => ({ rating: point.rating, at: point.created_at })),
    recent: recent.map((game) => {
      const mine = game.player1_id === user.id ? 1 : 2
      const opponentId = mine === 1 ? game.player2_id : game.player1_id
      const opponent = game.bot_level ? 'Робот' : opponentId ? userById(opponentId)?.username ?? 'Игрок' : 'Игрок'
      const result = game.winner === 3 ? 'draw' : game.winner === mine ? 'win' : 'loss'
      return {
        id: game.id,
        opponent,
        result,
        delta: mine === 1 ? game.rating_delta1 : game.rating_delta2,
        modifier: game.modifier,
        presetId: game.preset_id,
        finishedAt: game.finished_at,
      }
    }),
    puzzles: PUZZLES.map((puzzle) => ({
      id: puzzle.id,
      title: puzzle.title,
      difficulty: puzzle.difficulty,
      solved: solved.has(puzzle.id),
    })),
  }
}

function solvedSet(userId: number) {
  return new Set(
    (db.prepare('SELECT puzzle_id FROM puzzle_progress WHERE user_id = ? AND solved = 1').all(userId) as Array<{ puzzle_id: string }>).map(
      (row) => row.puzzle_id,
    ),
  )
}

export function puzzleList(userId: number | null) {
  const solved = userId ? solvedSet(userId) : new Set<string>()
  return {
    puzzles: PUZZLES.map((puzzle) => ({ ...toPublic(puzzle), solved: solved.has(puzzle.id) })),
  }
}

export function puzzleOne(userId: number | null, id: string) {
  const puzzle = getPuzzle(id)
  if (!puzzle) throw new ApiError(404, 'Задача не найдена')
  const solved = userId ? solvedSet(userId).has(id) : false
  return { puzzle: { ...toPublic(puzzle), solved } }
}

function publicState(puzzle: Puzzle, state: GameState) {
  return {
    rows: state.rules.rows,
    cols: state.rules.cols,
    connect: state.rules.connect,
    modifier: puzzle.modifier,
    cells: state.cells,
    gravity: state.gravity,
    turn: state.turn,
    winner: state.winner,
    winLine: state.winLine,
    rushLeft: state.rushLeft,
    plies: state.plies,
  }
}

export function puzzleAttempt(user: UserRow, id: string, moves: Action[]) {
  const puzzle = getPuzzle(id)
  if (!puzzle) throw new ApiError(404, 'Задача не найдена')
  if (!Array.isArray(moves) || moves.some((move) => (move?.type !== 'drop' && move?.type !== 'pop') || !Number.isInteger(move?.col))) {
    throw new ApiError(400, 'Непонятный ход')
  }
  const result = reviewAttempt(puzzle, moves)
  const existing = db.prepare('SELECT solved, attempts FROM puzzle_progress WHERE user_id = ? AND puzzle_id = ?').get(user.id, id) as
    | { solved: number; attempts: number }
    | undefined
  let puzzleRating = user.puzzle_rating
  let solved = existing?.solved ?? 0
  let attempts = existing?.attempts ?? 0
  if (result.status === 'wrong') {
    attempts += 1
    puzzleRating = Math.max(0, puzzleRating - 5)
  } else if (result.status === 'solved' && !solved) {
    attempts += 1
    solved = 1
    puzzleRating += 15
  }
  if (result.status !== 'continue') {
    db.prepare(`
      INSERT INTO puzzle_progress (user_id, puzzle_id, solved, attempts)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, puzzle_id) DO UPDATE SET solved = excluded.solved, attempts = excluded.attempts
    `).run(user.id, id, solved, attempts)
    const solvedCount = (db.prepare('SELECT COUNT(*) AS count FROM puzzle_progress WHERE user_id = ? AND solved = 1').get(user.id) as { count: number }).count
    db.prepare('UPDATE users SET puzzle_rating = ?, puzzle_solved = ? WHERE id = ?').run(puzzleRating, solvedCount, user.id)
  }
  return {
    status: result.status,
    message: result.status === 'wrong' ? 'Это не лучший ход' : result.status === 'solved' ? 'Задача решена' : null,
    puzzleRating,
    state: publicState(puzzle, result.state),
  }
}
