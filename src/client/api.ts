import type { Action, Modifier } from '../engine/types.ts'

export interface User {
  id: number
  username: string
  rating: number
  puzzleRating: number
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
}

export interface GamePlayer {
  seat: 1 | 2
  username: string
  rating: number | null
  clockMs: number
  delta: number | null
}

export interface Game {
  id: string
  status: 'waiting' | 'active' | 'finished'
  presetId: string
  modifier: Modifier
  timeId: string
  rated: boolean
  botLevel: string | null
  you: 1 | 2 | null
  winner: number
  winReason: string | null
  winLine: number[] | null
  rows: number
  cols: number
  connect: number
  initialRows: number
  initialCols: number
  cells: number[]
  turn: 1 | 2
  gravity: 1 | -1
  rushLeft: number
  plies: number
  moves: Action[]
  drawOffer: number
  clockRunning: boolean
  unlimited: boolean
  players: GamePlayer[]
}

export interface PuzzleCard {
  id: string
  title: string
  difficulty: 1 | 2 | 3
  modifier: Modifier
  rows: number
  cols: number
  connect: number
  cells: number[]
  gravity: 1 | -1
  plies: number
  you: 1 | 2
  steps: number
  solved: boolean
}

export interface PuzzleState {
  rows: number
  cols: number
  connect: number
  modifier: Modifier
  cells: number[]
  gravity: 1 | -1
  turn: 1 | 2
  winner: number
  winLine: number[] | null
  rushLeft: number
  plies: number
}

async function request<T>(path: string, body?: unknown, method = body ? 'POST' : 'GET'): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Ошибка запроса')
  return data as T
}

export const api = {
  me: () => request<{ user: User | null }>('/api/auth/me').then((data) => data.user),
  register: (username: string, password: string) =>
    request<{ user: User }>('/api/auth/register', { username, password }).then((data) => data.user),
  login: (username: string, password: string) =>
    request<{ user: User }>('/api/auth/login', { username, password }).then((data) => data.user),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', {}),
  createGame: (body: Record<string, unknown>) => request<{ game: Game }>('/api/games', body).then((data) => data.game),
  game: (id: string) => request<{ game: Game }>(`/api/games/${id}`).then((data) => data.game),
  join: (id: string) => request<{ game: Game }>(`/api/games/${id}/join`, {}).then((data) => data.game),
  move: (id: string, action: Action) => request<{ game: Game }>(`/api/games/${id}/move`, action).then((data) => data.game),
  resign: (id: string) => request<{ game: Game }>(`/api/games/${id}/resign`, {}).then((data) => data.game),
  draw: (id: string, action: 'offer' | 'accept' | 'decline') =>
    request<{ game: Game }>(`/api/games/${id}/draw`, { action }).then((data) => data.game),
  queue: (body: Record<string, unknown>) => request<{ ticketId: string; gameId: string | null }>('/api/matchmaking', body),
  ticket: (id: string) => request<{ ticketId: string; gameId: string | null }>(`/api/matchmaking/${id}`),
  cancelTicket: (id: string) => request<{ ok: boolean }>(`/api/matchmaking/${id}`, undefined, 'DELETE'),
  leaderboard: () =>
    request<{
      players: Array<{
        place: number
        username: string
        rating: number
        wins: number
        losses: number
        draws: number
        games: number
        you: boolean
      }>
    }>('/api/leaderboard'),
  profile: (username: string) =>
    request<{
      profile: {
        username: string
        rating: number
        puzzleRating: number
        rank: string
        place: number
        wins: number
        losses: number
        draws: number
        gamesPlayed: number
        puzzleSolved: number
        createdAt: number
        history: Array<{ rating: number; at: number }>
        recent: Array<{
          id: string
          opponent: string
          result: 'win' | 'loss' | 'draw'
          delta: number | null
          modifier: string
          presetId: string
          finishedAt: number | null
        }>
        puzzles: Array<{ id: string; title: string; difficulty: number; solved: boolean }>
      }
    }>(`/api/users/${encodeURIComponent(username)}`).then((data) => data.profile),
  puzzles: () => request<{ puzzles: PuzzleCard[] }>('/api/puzzles').then((data) => data.puzzles),
  puzzle: (id: string) => request<{ puzzle: PuzzleCard }>(`/api/puzzles/${id}`).then((data) => data.puzzle),
  attempt: (id: string, moves: Action[]) =>
    request<{ status: 'wrong' | 'continue' | 'solved'; message: string | null; puzzleRating: number; state: PuzzleState }>(
      `/api/puzzles/${id}/attempt`,
      { moves },
    ),
}
