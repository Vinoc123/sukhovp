import { applyMove, cellsFromRows } from './board.ts'
import type { Action, Cell, GameState, Modifier, Player } from './types.ts'

export interface PuzzleStep {
  by: 'you' | 'opp'
  action: Action
}

export interface Puzzle {
  id: string
  title: string
  difficulty: 1 | 2 | 3
  modifier: Modifier
  rows: number
  cols: number
  connect: number
  cells: Cell[]
  gravity: 1 | -1
  plies: number
  you: Player
  script: PuzzleStep[]
}

export interface PublicPuzzle {
  id: string
  title: string
  difficulty: 1 | 2 | 3
  modifier: Modifier
  rows: number
  cols: number
  connect: number
  cells: Cell[]
  gravity: 1 | -1
  plies: number
  you: Player
  steps: number
}

export interface AttemptResult {
  status: 'wrong' | 'continue' | 'solved'
  state: GameState
}

function puzzle(partial: {
  id: string
  title: string
  difficulty: 1 | 2 | 3
  rows: string[]
  modifier?: Modifier
  connect?: number
  gravity?: 1 | -1
  plies?: number
  script: PuzzleStep[]
}): Puzzle {
  const parsed = cellsFromRows(partial.rows)
  return {
    id: partial.id,
    title: partial.title,
    difficulty: partial.difficulty,
    modifier: partial.modifier ?? 'classic',
    rows: parsed.rows,
    cols: parsed.cols,
    connect: partial.connect ?? 4,
    cells: parsed.cells,
    gravity: partial.gravity ?? 1,
    plies: partial.plies ?? 0,
    you: 1,
    script: partial.script,
  }
}

const drop = (col: number): Action => ({ type: 'drop', col })
const pop = (col: number): Action => ({ type: 'pop', col })
const you = (action: Action): PuzzleStep => ({ by: 'you', action })
const opp = (action: Action): PuzzleStep => ({ by: 'opp', action })

export const PUZZLES: Puzzle[] = [
  puzzle({
    id: 'line-bottom',
    title: 'Прямая снизу',
    difficulty: 1,
    rows: ['.......', '.......', '.......', '.......', '.......', 'XXX.OO.'],
    script: [you(drop(3))],
  }),
  puzzle({
    id: 'column',
    title: 'Столбик',
    difficulty: 1,
    rows: ['.......', '.......', '.......', '..X....', '..XO...', '..XOO..'],
    script: [you(drop(2))],
  }),
  puzzle({
    id: 'diagonal',
    title: 'Диагональ',
    difficulty: 1,
    rows: ['.......', '.......', '.......', '..XO...', '.XOO...', 'XOOO...'],
    script: [you(drop(3))],
  }),
  puzzle({
    id: 'diagonal-back',
    title: 'Обратная диагональ',
    difficulty: 1,
    rows: ['.......', '.......', '.......', '...OX..', '...OOX.', '...OOOX'],
    script: [you(drop(3))],
  }),
  puzzle({
    id: 'second-row',
    title: 'Второй ряд',
    difficulty: 1,
    rows: ['.......', '.......', '.......', '.......', 'XXX....', 'OOOO...'],
    script: [you(drop(3))],
  }),
  puzzle({
    id: 'right-edge',
    title: 'У правого края',
    difficulty: 1,
    rows: ['.......', '.......', '.......', '.......', '.......', '.OO.XXX'],
    script: [you(drop(3))],
  }),
  puzzle({
    id: 'high-column',
    title: 'Высокий столбик',
    difficulty: 1,
    rows: ['.......', '...X...', '...X...', '...X...', '...O...', '...O...'],
    script: [you(drop(3))],
  }),
  puzzle({
    id: 'left-column',
    title: 'Левый край',
    difficulty: 1,
    rows: ['.......', '.......', '.......', 'X.O....', 'X.O....', 'X.OO...'],
    script: [you(drop(0))],
  }),
  puzzle({
    id: 'fork-bottom',
    title: 'Вилка снизу',
    difficulty: 2,
    rows: ['.......', '.......', '.......', '.......', '.......', '.X.X...'],
    script: [you(drop(2)), opp(drop(0)), you(drop(4))],
  }),
  puzzle({
    id: 'fork-right',
    title: 'Вилка справа',
    difficulty: 2,
    rows: ['.......', '.......', '.......', '.......', '.......', '...X.X.'],
    script: [you(drop(4)), opp(drop(2)), you(drop(6))],
  }),
  puzzle({
    id: 'fork-high',
    title: 'Вилка на втором ряду',
    difficulty: 2,
    rows: ['.......', '.......', '.......', '.......', '.X.X...', 'OXOXO..'],
    script: [you(drop(2)), opp(drop(0)), you(drop(4))],
  }),
  puzzle({
    id: 'fork-shift',
    title: 'Сдвинутая вилка',
    difficulty: 2,
    rows: ['.......', '.......', '.......', '.......', '..X.X..', '.OXOXO.'],
    script: [you(drop(3)), opp(drop(1)), you(drop(5))],
  }),
  puzzle({
    id: 'three-left',
    title: 'Три хода слева',
    difficulty: 3,
    rows: ['.......', '.......', '.......', 'X.O....', 'XXX....', 'OOO....'],
    script: [you(drop(3)), opp(drop(3)), you(drop(0)), opp(drop(0)), you(drop(1))],
  }),
  puzzle({
    id: 'three-right',
    title: 'Три хода справа',
    difficulty: 3,
    rows: ['.......', '.......', '.......', '....O.X', '....XXX', '....OOO'],
    script: [you(drop(3)), opp(drop(3)), you(drop(6)), opp(drop(6)), you(drop(5))],
  }),
  puzzle({
    id: 'flip-line',
    title: 'Линия на потолке',
    difficulty: 1,
    modifier: 'flip',
    gravity: -1,
    rows: ['XXX....', '.......', '.......', '.......', '.......', '.......'],
    script: [you(drop(3))],
  }),
  puzzle({
    id: 'flip-column',
    title: 'Столбик вверх',
    difficulty: 1,
    modifier: 'flip',
    gravity: -1,
    rows: ['..X....', '..X....', '..X....', '.......', '.......', '.......'],
    script: [you(drop(2))],
  }),
  puzzle({
    id: 'pop-center',
    title: 'Вынуть среднюю',
    difficulty: 1,
    modifier: 'pop',
    rows: ['.......', '.......', '.......', '...X...', 'XXXO...', 'OOOX...'],
    script: [you(pop(3))],
  }),
  puzzle({
    id: 'pop-left',
    title: 'Вынуть край',
    difficulty: 1,
    modifier: 'pop',
    rows: ['.......', '.......', '.......', 'X......', 'OXXX...', 'XOOO...'],
    script: [you(pop(0))],
  }),
]

export function yourSteps(puzzle: Puzzle): number {
  return puzzle.script.filter((step) => step.by === 'you').length
}

export function startPuzzle(puzzle: Puzzle): GameState {
  return {
    rules: {
      rows: puzzle.rows,
      cols: puzzle.cols,
      connect: puzzle.connect,
      modifier: puzzle.modifier,
    },
    cells: puzzle.cells.slice(),
    turn: puzzle.you,
    plies: puzzle.plies,
    gravity: puzzle.gravity,
    rushLeft: puzzle.modifier === 'rush' ? 2 : 1,
    winner: 0,
    winLine: null,
  }
}

export function toPublic(puzzle: Puzzle): PublicPuzzle {
  const start = startPuzzle(puzzle)
  return {
    id: puzzle.id,
    title: puzzle.title,
    difficulty: puzzle.difficulty,
    modifier: puzzle.modifier,
    rows: start.rules.rows,
    cols: start.rules.cols,
    connect: start.rules.connect,
    cells: start.cells.slice(),
    gravity: start.gravity,
    plies: start.plies,
    you: puzzle.you,
    steps: yourSteps(puzzle),
  }
}

export function reviewAttempt(puzzle: Puzzle, attempt: Action[]): AttemptResult {
  const start = startPuzzle(puzzle)
  let state = start
  let seen = 0
  const goal = yourSteps(puzzle)
  for (const step of puzzle.script) {
    if (step.by === 'you') {
      if (seen >= attempt.length) return { status: 'continue', state }
      const got = attempt[seen]
      if (!got || got.type !== step.action.type || got.col !== step.action.col) {
        return { status: 'wrong', state: start }
      }
      state = applyMove(state, got)
      seen += 1
    } else {
      state = applyMove(state, step.action)
    }
    if (state.winner) {
      if (state.winner === puzzle.you && seen === goal && seen === attempt.length) {
        return { status: 'solved', state }
      }
      return { status: 'wrong', state: start }
    }
  }
  if (attempt.length !== seen) return { status: 'wrong', state: start }
  if (state.winner === puzzle.you) return { status: 'solved', state }
  return { status: 'continue', state }
}

export function getPuzzle(id: string): Puzzle | undefined {
  return PUZZLES.find((item) => item.id === id)
}
