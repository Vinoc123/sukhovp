import type { Action, Cell, GameState, Player, Rules } from './types.ts'

export function createGame(rules: Rules): GameState {
  return {
    rules: { ...rules },
    cells: Array(rules.rows * rules.cols).fill(0) as Cell[],
    turn: 1,
    plies: 0,
    gravity: 1,
    rushLeft: rules.modifier === 'rush' ? 2 : 1,
    winner: 0,
    winLine: null,
  }
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    rules: { ...state.rules },
    cells: state.cells.slice(),
    winLine: state.winLine ? state.winLine.slice() : null,
  }
}

export function opponent(player: Player): Player {
  return player === 1 ? 2 : 1
}

export function landingRow(state: GameState, col: number): number | null {
  const { rows, cols } = state.rules
  if (col < 0 || col >= cols) return null
  if (state.gravity === 1) {
    for (let row = rows - 1; row >= 0; row--) {
      if (state.cells[row * cols + col] === 0) return row
    }
  } else {
    for (let row = 0; row < rows; row++) {
      if (state.cells[row * cols + col] === 0) return row
    }
  }
  return null
}

export function supportIndex(state: GameState, col: number): number | null {
  const { rows, cols } = state.rules
  if (col < 0 || col >= cols) return null
  const index = state.gravity === 1 ? (rows - 1) * cols + col : col
  return state.cells[index] === 0 ? null : index
}

export function legalMoves(state: GameState): Action[] {
  if (state.winner) return []
  const actions: Action[] = []
  for (let col = 0; col < state.rules.cols; col++) {
    if (landingRow(state, col) !== null) actions.push({ type: 'drop', col })
    if (state.rules.modifier === 'pop') {
      const index = supportIndex(state, col)
      if (index !== null && state.cells[index] === state.turn) actions.push({ type: 'pop', col })
    }
  }
  return actions
}

export function sameAction(a: Action, b: Action): boolean {
  return a.type === b.type && a.col === b.col
}

export function isLegal(state: GameState, action: Action): boolean {
  return legalMoves(state).some((move) => sameAction(move, action))
}

export function compact(cells: Cell[], rows: number, cols: number, gravity: 1 | -1): Cell[] {
  const next = Array(rows * cols).fill(0) as Cell[]
  for (let col = 0; col < cols; col++) {
    const stack: Cell[] = []
    for (let row = 0; row < rows; row++) {
      const value = cells[row * cols + col]
      if (value) stack.push(value)
    }
    if (gravity === 1) {
      const start = rows - stack.length
      for (let i = 0; i < stack.length; i++) next[(start + i) * cols + col] = stack[i]
    } else {
      for (let i = 0; i < stack.length; i++) next[i * cols + col] = stack[i]
    }
  }
  return next
}

export function findLine(state: GameState, player: Player): number[] | null {
  const { rows, cols, connect } = state.rules
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (state.cells[row * cols + col] !== player) continue
      for (const [dr, dc] of dirs) {
        const endRow = row + dr * (connect - 1)
        const endCol = col + dc * (connect - 1)
        if (endRow < 0 || endCol < 0 || endRow >= rows || endCol >= cols) continue
        const line: number[] = []
        let ok = true
        for (let step = 0; step < connect; step++) {
          const index = (row + dr * step) * cols + (col + dc * step)
          if (state.cells[index] !== player) {
            ok = false
            break
          }
          line.push(index)
        }
        if (ok) return line
      }
    }
  }
  return null
}

function resolve(state: GameState, mover: Player): void {
  const own = findLine(state, mover)
  if (own) {
    state.winner = mover
    state.winLine = own
    return
  }
  const other = findLine(state, opponent(mover))
  if (other) {
    state.winner = opponent(mover)
    state.winLine = other
    return
  }
  if (legalMoves(state).length === 0) {
    state.winner = 3
    state.winLine = null
  }
}

function rotateClockwise(state: GameState): void {
  const { rows, cols } = state.rules
  const nextRows = cols
  const nextCols = rows
  const next = Array(nextRows * nextCols).fill(0) as Cell[]
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const value = state.cells[row * cols + col]
      const newRow = col
      const newCol = rows - 1 - row
      next[newRow * nextCols + newCol] = value
    }
  }
  state.rules.rows = nextRows
  state.rules.cols = nextCols
  state.cells = next
  state.gravity = 1
  state.cells = compact(state.cells, state.rules.rows, state.rules.cols, 1)
}

export function applyMove(state: GameState, action: Action): GameState {
  if (state.winner) throw new Error('Игра уже закончена')
  if (!isLegal(state, action)) throw new Error('Недопустимый ход')
  const next = cloneState(state)
  const mover = next.turn
  const { rows, cols } = next.rules

  if (action.type === 'drop') {
    const row = landingRow(next, action.col)
    if (row === null) throw new Error('Столбец заполнен')
    next.cells[row * cols + action.col] = mover
  } else {
    const index = supportIndex(next, action.col)
    if (index === null || next.cells[index] !== mover) throw new Error('Эту фишку нельзя вынуть')
    next.cells[index] = 0
    next.cells = compact(next.cells, rows, cols, next.gravity)
  }

  next.plies += 1
  next.rushLeft -= 1
  resolve(next, mover)

  if (!next.winner && next.rules.modifier === 'flip' && next.plies % 4 === 0) {
    next.gravity = next.gravity === 1 ? -1 : 1
    next.cells = compact(next.cells, next.rules.rows, next.rules.cols, next.gravity)
    resolve(next, mover)
  }

  if (!next.winner && next.rules.modifier === 'rotate' && next.plies % 4 === 0) {
    rotateClockwise(next)
    resolve(next, mover)
  }

  if (next.winner) {
    next.rushLeft = 0
    return next
  }

  if (next.rules.modifier === 'rush' && next.rushLeft > 0) return next

  next.turn = opponent(mover)
  next.rushLeft = next.rules.modifier === 'rush' ? 2 : 1
  return next
}

export function pieceCount(state: GameState): number {
  return state.cells.reduce((sum, cell) => sum + (cell ? 1 : 0), 0)
}

export function cellsFromRows(rows: string[]): { cells: Cell[]; cols: number; rows: number } {
  const width = rows[0]?.length ?? 0
  if (!rows.every((row) => row.length === width)) throw new Error('Строки разной длины')
  const cells: Cell[] = []
  for (const row of rows) {
    for (const char of row) {
      if (char === 'X') cells.push(1)
      else if (char === 'O') cells.push(2)
      else if (char === '.') cells.push(0)
      else throw new Error(`Неизвестный символ ${char}`)
    }
  }
  return { cells, cols: width, rows: rows.length }
}

export function isPacked(state: GameState): boolean {
  const packed = compact(state.cells, state.rules.rows, state.rules.cols, state.gravity)
  return packed.every((cell, index) => cell === state.cells[index])
}
