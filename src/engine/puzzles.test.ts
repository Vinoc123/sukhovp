import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyMove, isPacked, legalMoves } from './board.ts'
import { PUZZLES, reviewAttempt, startPuzzle, yourSteps } from './puzzles.ts'

function forced(state: ReturnType<typeof startPuzzle>, plies: number, you: 1 | 2): boolean {
  if (state.winner === you) return true
  if (state.winner) return false
  if (plies <= 0) return false
  const moves = legalMoves(state)
  if (moves.length === 0) return false
  if (state.turn === you) return moves.some((move) => forced(applyMove(state, move), plies - 1, you))
  return moves.every((move) => forced(applyMove(state, move), plies - 1, you))
}

describe('задачи', () => {
  it('их достаточно и решения доходят до победы', () => {
    assert.ok(PUZZLES.length >= 18)
    for (const puzzle of PUZZLES) {
      const start = startPuzzle(puzzle)
      assert.equal(isPacked(start), true, puzzle.id)
      assert.equal(start.winner, 0, puzzle.id)
      const attempt = puzzle.script.filter((step) => step.by === 'you').map((step) => step.action)
      const result = reviewAttempt(puzzle, attempt)
      assert.equal(result.status, 'solved', puzzle.id)
      assert.equal(result.state.winner, puzzle.you, puzzle.id)
      const budget = yourSteps(puzzle) * 2 - 1
      assert.equal(forced(start, budget, puzzle.you), true, puzzle.id)
      const winning = legalMoves(start).filter((move) => forced(applyMove(start, move), budget - 1, puzzle.you))
      assert.equal(winning.length, 1, puzzle.id)
      assert.equal(winning[0].type, attempt[0].type, puzzle.id)
      assert.equal(winning[0].col, attempt[0].col, puzzle.id)
    }
  })

  it('в задачах на один ход лишний ход не принимается', () => {
    for (const puzzle of PUZZLES.filter((item) => yourSteps(item) === 1)) {
      const start = startPuzzle(puzzle)
      const answer = puzzle.script[0].action
      for (const move of legalMoves(start)) {
        if (move.type === answer.type && move.col === answer.col) continue
        const reviewed = reviewAttempt(puzzle, [move])
        assert.equal(reviewed.status, 'wrong', puzzle.id)
        const next = applyMove(start, move)
        assert.notEqual(next.winner, puzzle.you, `${puzzle.id} ${move.type} ${move.col}`)
      }
    }
  })
})
