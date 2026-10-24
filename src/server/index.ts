import { randomBytes } from 'node:crypto'
import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ApiError,
  cancelTicket,
  createBotGame,
  createRoom,
  enqueue,
  joinRoom,
  leaderboard,
  offerDraw,
  openGame,
  playMove,
  profile,
  puzzleAttempt,
  puzzleList,
  puzzleOne,
  resign,
  ticketStatus,
} from './games.ts'
import { db, hashPassword, publicUser, verifyPassword, type UserRow } from './db.ts'

const app = express()
app.use(express.json({ limit: '100kb' }))

const fails = new Map<string, { count: number; reset: number }>()

function cookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie
  if (!raw) return null
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

function setSession(res: Response, token: string) {
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`)
}

function clearSession(res: Response) {
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0')
}

function currentUser(req: Request): UserRow | null {
  const token = cookie(req, 'sid')
  if (!token) return null
  const row = db.prepare(`
    SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ? AND sessions.expires_at > ?
  `).get(token, Date.now()) as UserRow | undefined
  return row ?? null
}

function requireUser(req: Request): UserRow {
  const user = currentUser(req)
  if (!user) throw new ApiError(401, 'Нужно войти')
  return user
}

const namePattern = /^[A-Za-zА-Яа-яЁё0-9_]{3,16}$/

function openSession(res: Response, userId: number) {
  const token = randomBytes(24).toString('hex')
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, Date.now() + 30 * 24 * 60 * 60 * 1000)
  setSession(res, token)
}

function tooMany(ip: string) {
  const now = Date.now()
  const entry = fails.get(ip)
  if (!entry || entry.reset < now) return false
  return entry.count >= 8
}

function markFail(ip: string) {
  const now = Date.now()
  const entry = fails.get(ip)
  if (!entry || entry.reset < now) fails.set(ip, { count: 1, reset: now + 10 * 60 * 1000 })
  else entry.count += 1
}

app.post('/api/auth/register', (req, res) => {
  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')
  if (!namePattern.test(username)) throw new ApiError(400, 'Ник: 3–16 букв, цифр или _')
  if (password.length < 6 || password.length > 72) throw new ApiError(400, 'Пароль: от 6 до 72 символов')
  const exists = db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(username)
  if (exists) throw new ApiError(400, 'Такой ник уже занят')
  const now = Date.now()
  const created = db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)').run(username, hashPassword(password), now)
  const id = Number(created.lastInsertRowid)
  db.prepare('INSERT INTO rating_history (user_id, rating, game_id, created_at) VALUES (?, 1200, NULL, ?)').run(id, now)
  openSession(res, id)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow
  res.json({ user: publicUser(user) })
})

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || 'local'
  if (tooMany(ip)) throw new ApiError(429, 'Слишком много попыток, подождите')
  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')
  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as UserRow | undefined
  if (!user || !verifyPassword(password, user.password_hash)) {
    markFail(ip)
    throw new ApiError(400, 'Неверный ник или пароль')
  }
  openSession(res, user.id)
  res.json({ user: publicUser(user) })
})

app.post('/api/auth/logout', (req, res) => {
  const token = cookie(req, 'sid')
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  clearSession(res)
  res.json({ ok: true })
})

app.get('/api/auth/me', (req, res) => {
  const user = currentUser(req)
  res.json({ user: user ? publicUser(user) : null })
})

app.post('/api/games', (req, res) => {
  const user = requireUser(req)
  const mode = req.body?.mode
  if (mode === 'bot') res.json({ game: createBotGame(user, req.body) })
  else if (mode === 'room') res.json({ game: createRoom(user, req.body) })
  else throw new ApiError(400, 'Непонятный режим')
})

app.post('/api/games/:id/join', (req, res) => {
  res.json({ game: joinRoom(requireUser(req), req.params.id) })
})

app.get('/api/games/:id', (req, res) => {
  const user = currentUser(req)
  res.json({ game: openGame(req.params.id, user?.id ?? null) })
})

app.post('/api/games/:id/move', (req, res) => {
  res.json({ game: playMove(requireUser(req), req.params.id, req.body) })
})

app.post('/api/games/:id/resign', (req, res) => {
  res.json({ game: resign(requireUser(req), req.params.id) })
})

app.post('/api/games/:id/draw', (req, res) => {
  res.json({ game: offerDraw(requireUser(req), req.params.id, String(req.body?.action ?? '')) })
})

app.post('/api/matchmaking', (req, res) => {
  res.json(enqueue(requireUser(req), req.body))
})

app.get('/api/matchmaking/:ticketId', (req, res) => {
  res.json(ticketStatus(requireUser(req).id, req.params.ticketId))
})

app.delete('/api/matchmaking/:ticketId', (req, res) => {
  cancelTicket(requireUser(req).id, req.params.ticketId)
  res.json({ ok: true })
})

app.get('/api/leaderboard', (req, res) => {
  const user = currentUser(req)
  res.json(leaderboard(user?.id ?? null))
})

app.get('/api/users/:username', (req, res) => {
  res.json({ profile: profile(req.params.username) })
})

app.get('/api/puzzles', (req, res) => {
  const user = currentUser(req)
  res.json(puzzleList(user?.id ?? null))
})

app.get('/api/puzzles/:id', (req, res) => {
  const user = currentUser(req)
  res.json(puzzleOne(user?.id ?? null, req.params.id))
})

app.post('/api/puzzles/:id/attempt', (req, res) => {
  res.json(puzzleAttempt(requireUser(req), req.params.id, req.body?.moves ?? []))
})

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dist = path.join(root, 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message })
    return
  }
  console.error(error)
  res.status(500).json({ error: 'Что-то сломалось на сервере' })
})

const port = Number(process.env.PORT || 3001)
app.listen(port, '0.0.0.0', () => {
  console.log(`Квартет слушает ${port}`)
})
