import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyMove, cellsFromRows, createGame, findLine, isPacked, pieceCount } from './board.ts'
import { chooseMove } from './ai.ts'

describe('линии', () => {
  it('четыре по горизонтали заканчивают партию', () => {
    let state = createGame({ rows: 6, cols: 7, connect: 4, modifier: 'classic' })
    const moves = [0, 0, 1, 1, 2, 2, 3]
    for (const col of moves) state = applyMove(state, { type: 'drop', col })
    assert.equal(state.winner, 1)
    assert.ok(state.winLine?.length === 4)
  })

  it('четыре по вертикали заканчивают партию', () => {
    let state = createGame({ rows: 6, cols: 7, connect: 4, modifier: 'classic' })
    const moves = [3, 0, 3, 0, 3, 0, 3]
    for (const col of moves) state = applyMove(state, { type: 'drop', col })
    assert.equal(state.winner, 1)
  })

  it('четыре подряд на большой доске ещё не победа', () => {
    let state = createGame({ rows: 7, cols: 9, connect: 5, modifier: 'classic' })
    const moves = [0, 8, 1, 8, 2, 8, 3, 8]
    for (const col of moves) state = applyMove(state, { type: 'drop', col })
    assert.equal(state.winner, 0)
    state = applyMove(state, { type: 'drop', col: 4 })
    assert.equal(state.winner, 1)
  })

  it('полная доска без линии — ничья', () => {
    let state = createGame({ rows: 1, cols: 2, connect: 3, modifier: 'classic' })
    state = applyMove(state, { type: 'drop', col: 0 })
    state = applyMove(state, { type: 'drop', col: 1 })
    assert.equal(state.winner, 3)
    assert.equal(findLine(state, 1), null)
  })
})

describe('модификаторы', () => {
  it('переворот меняет гравитацию каждые четыре полухода и сохраняет фишки', () => {
    let state = createGame({ rows: 6, cols: 7, connect: 4, modifier: 'flip' })
    for (const col of [0, 0, 0, 0]) {
      state = applyMove(state, { type: 'drop', col })
    }
    assert.equal(state.gravity, -1)
    assert.equal(pieceCount(state), 4)
    assert.equal(isPacked(state), true)
    assert.equal(state.cells[0], 2)
    assert.equal(state.cells[3 * 7], 1)
  })

  it('выталкивание снимает свою нижнюю фишку', () => {
    let state = createGame({ rows: 4, cols: 4, connect: 4, modifier: 'pop' })
    state = applyMove(state, { type: 'drop', col: 0 })
    state = applyMove(state, { type: 'drop', col: 1 })
    const before = pieceCount(state)
    state = applyMove(state, { type: 'pop', col: 0 })
    assert.equal(pieceCount(state), before - 1)
    assert.equal(state.turn, 2)
    assert.throws(() => applyMove(state, { type: 'pop', col: 0 }))
  })

  it('поворот меняет 7×6 на 6×7 и роняет фишки вниз', () => {
    let state = createGame({ rows: 6, cols: 7, connect: 4, modifier: 'rotate' })
    for (const col of [0, 1, 0, 1]) state = applyMove(state, { type: 'drop', col })
    assert.equal(state.rules.rows, 7)
    assert.equal(state.rules.cols, 6)
    assert.equal(state.gravity, 1)
    assert.equal(pieceCount(state), 4)
    assert.equal(isPacked(state), true)
  })

  it('двойной ход оставляет второго игрока ждать до второй фишки', () => {
    let state = createGame({ rows: 6, cols: 7, connect: 4, modifier: 'rush' })
    state = applyMove(state, { type: 'drop', col: 0 })
    assert.equal(state.turn, 1)
    assert.equal(state.rushLeft, 1)
    state = applyMove(state, { type: 'drop', col: 1 })
    assert.equal(state.turn, 2)
    assert.equal(state.rushLeft, 2)
  })

  it('победа первой фишкой двойного хода заканчивает партию сразу', () => {
    const parsed = cellsFromRows(['.......', '.......', '.......', '.......', '.......', 'XXX....'])
    let state = createGame({ rows: 6, cols: 7, connect: 4, modifier: 'rush' })
    state.cells = parsed.cells
    state = applyMove(state, { type: 'drop', col: 3 })
    assert.equal(state.winner, 1)
    assert.equal(state.rushLeft, 0)
  })
})

describe('робот', () => {
  it('средний уровень забирает готовую победу', () => {
    const parsed = cellsFromRows(['.......', '.......', '.......', '.......', '.......', 'XXX....'])
    const state = createGame({ rows: 6, cols: 7, connect: 4, modifier: 'classic' })
    state.cells = parsed.cells
    const move = chooseMove(state, 'medium', () => 0)
    assert.deepEqual(move, { type: 'drop', col: 3 })
  })
})
