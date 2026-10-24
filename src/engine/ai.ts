import { applyMove, legalMoves, opponent } from './board.ts'
import type { Action, BotLevel, GameState, Player } from './types.ts'

function orderedMoves(state: GameState): Action[] {
  const center = (state.rules.cols - 1) / 2
  return legalMoves(state).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'drop' ? -1 : 1
    return Math.abs(a.col - center) - Math.abs(b.col - center)
  })
}

function evaluate(state: GameState, player: Player): number {
  if (state.winner === player) return 100_000
  if (state.winner === 3) return 0
  if (state.winner) return -100_000

  const opp = opponent(player)
  const { rows, cols, connect } = state.rules
  let score = 0
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      for (const [dr, dc] of dirs) {
        const endRow = row + dr * (connect - 1)
        const endCol = col + dc * (connect - 1)
        if (endRow < 0 || endCol < 0 || endRow >= rows || endCol >= cols) continue
        let mine = 0
        let theirs = 0
        for (let step = 0; step < connect; step++) {
          const value = state.cells[(row + dr * step) * cols + (col + dc * step)]
          if (value === player) mine++
          else if (value === opp) theirs++
        }
        if (mine && theirs) continue
        if (mine === connect - 1) score += 90
        else if (mine === connect - 2 && connect > 2) score += 12
        else if (mine) score += mine
        if (theirs === connect - 1) score -= 110
        else if (theirs === connect - 2 && connect > 2) score -= 14
      }
    }
  }
  const center = (cols - 1) / 2
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (state.cells[row * cols + col] === player) score += Math.max(0, 3 - Math.abs(col - center))
    }
  }
  return score
}

function search(state: GameState, depth: number, alpha: number, beta: number, root: Player, deadline: number): number {
  if (Date.now() > deadline) return evaluate(state, root)
  if (state.winner === root) return 100_000 + depth
  if (state.winner === 3) return 0
  if (state.winner) return -100_000 - depth
  if (depth === 0) return evaluate(state, root)

  const moves = orderedMoves(state)
  if (moves.length === 0) return 0
  const maximize = state.turn === root
  let value = maximize ? -Infinity : Infinity
  for (const move of moves) {
    const next = applyMove(state, move)
    const score = search(next, depth - 1, alpha, beta, root, deadline)
    if (maximize) {
      value = Math.max(value, score)
      alpha = Math.max(alpha, value)
    } else {
      value = Math.min(value, score)
      beta = Math.min(beta, value)
    }
    if (alpha >= beta) break
  }
  return value
}

function depthCap(state: GameState): number {
  let cap = state.rules.cols >= 8 ? 4 : 6
  if (state.rules.modifier === 'pop' || state.rules.modifier === 'rotate') cap = Math.min(cap, 3)
  if (state.rules.modifier === 'rush') cap = Math.min(cap, 4)
  return cap
}

function mediumDepth(state: GameState): number {
  if (state.rules.modifier === 'pop' || state.rules.modifier === 'rotate' || state.rules.cols >= 8) return 2
  return 3
}

function bestMove(state: GameState, depth: number, deadline: number): Action {
  const moves = orderedMoves(state)
  let best = moves[0]
  let bestScore = -Infinity
  for (const move of moves) {
    const next = applyMove(state, move)
    const score = search(next, depth - 1, -Infinity, Infinity, state.turn, deadline)
    if (score > bestScore) {
      bestScore = score
      best = move
    }
  }
  return best
}

function easyPick(state: GameState, moves: Action[], rng: () => number): Action {
  if (!(state.rules.modifier === 'rush' && state.rushLeft < 2)) {
    const opp = opponent(state.turn)
    const flipped: GameState = {
      ...state,
      turn: opp,
      rushLeft: state.rules.modifier === 'rush' ? 2 : 1,
      cells: state.cells.slice(),
      rules: { ...state.rules },
      winLine: null,
      winner: 0,
    }
    const threats = legalMoves(flipped).filter((move) => applyMove(flipped, move).winner === opp)
    for (const threat of threats) {
      const block = moves.find((move) => move.type === 'drop' && move.col === threat.col && threat.type === 'drop')
      if (block) return block
    }
  }
  const center = (state.rules.cols - 1) / 2
  const ranked = [...moves].sort((a, b) => Math.abs(a.col - center) - Math.abs(b.col - center))
  const nearest = Math.abs(ranked[0].col - center)
  const pool = ranked.filter((move) => Math.abs(move.col - center) <= nearest + 1 && move.type === 'drop')
  const choice = pool.length ? pool : ranked
  return choice[Math.floor(rng() * choice.length) % choice.length]
}

export function chooseMove(state: GameState, level: BotLevel, rng: () => number = Math.random): Action {
  const moves = orderedMoves(state)
  if (moves.length === 0) throw new Error('Нет ходов')
  for (const move of moves) {
    if (applyMove(state, move).winner === state.turn) return move
  }
  if (level === 'easy') return easyPick(state, moves, rng)
  if (level === 'medium') return bestMove(state, mediumDepth(state), Date.now() + 1500)
  const deadline = Date.now() + 900
  let best = moves[0]
  const cap = depthCap(state)
  for (let depth = 1; depth <= cap; depth++) {
    if (Date.now() > deadline) break
    best = bestMove(state, depth, deadline)
  }
  return best
}
