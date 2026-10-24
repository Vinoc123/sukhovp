import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { afterTurn, charge, remaining, type Clock } from './clock.ts'

function clock(partial: Partial<Clock> = {}): Clock {
  return {
    clock1: 60_000,
    clock2: 60_000,
    lastTick: 1_000,
    initialMs: 60_000,
    incrementMs: 2_000,
    perMove: false,
    running: true,
    turn: 1,
    ...partial,
  }
}

describe('часы', () => {
  it('снимают время только с того, кто ходит', () => {
    const next = remaining(clock(), 4_000, 1)
    assert.equal(next, 57_000)
    assert.equal(remaining(clock(), 4_000, 2), 60_000)
  })

  it('флаг, если время вышло', () => {
    const result = charge(clock(), 70_000, 1)
    assert.equal(result.flagged, true)
  })

  it('Фишер добавляет прирост после смены хода', () => {
    const charged = charge(clock(), 6_000, 1)
    const done = afterTurn(charged.clock, 1, 2, true, false)
    assert.equal(done.clock1, 55_000 + 2_000)
    assert.equal(done.turn, 2)
  })

  it('контроль на ход обновляет часы соперника', () => {
    const base = clock({ perMove: true, incrementMs: 0, initialMs: 30_000, clock1: 30_000, clock2: 30_000 })
    const charged = charge(base, 11_000, 1)
    const done = afterTurn(charged.clock, 1, 2, true, false)
    assert.equal(done.clock2, 30_000)
    assert.equal(done.clock1, 20_000)
  })

  it('без лимита время не кончается', () => {
    const base = clock({ initialMs: 0, incrementMs: 0, clock1: 0, clock2: 0 })
    const result = charge(base, 999_999, 1)
    assert.equal(result.flagged, false)
  })
})
