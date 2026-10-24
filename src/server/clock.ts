export interface Clock {
  clock1: number
  clock2: number
  lastTick: number
  initialMs: number
  incrementMs: number
  perMove: boolean
  running: boolean
  turn: 1 | 2
}

export function unlimitedClock(clock: Pick<Clock, 'perMove' | 'initialMs'>): boolean {
  return !clock.perMove && clock.initialMs === 0
}

export function remaining(clock: Clock, now: number, side: 1 | 2): number {
  const base = side === 1 ? clock.clock1 : clock.clock2
  if (!clock.running || unlimitedClock(clock) || side !== clock.turn) return base
  return base - (now - clock.lastTick)
}

export function charge(clock: Clock, now: number, mover: 1 | 2): { clock: Clock; flagged: boolean } {
  if (!clock.running || unlimitedClock(clock)) return { clock: { ...clock, lastTick: now }, flagged: false }
  const left = remaining(clock, now, mover)
  if (left <= 0) return { clock, flagged: true }
  const next = { ...clock, lastTick: now, clock1: clock.clock1, clock2: clock.clock2 }
  if (mover === 1) next.clock1 = left
  else next.clock2 = left
  return { clock: next, flagged: false }
}

export function afterTurn(
  clock: Clock,
  mover: 1 | 2,
  nextTurn: 1 | 2,
  turnChanged: boolean,
  gameOver: boolean,
): Clock {
  const next = { ...clock }
  if (gameOver) {
    next.running = false
    return next
  }
  if (!turnChanged) return next
  next.turn = nextTurn
  if (unlimitedClock(next)) return next
  if (next.perMove) {
    if (nextTurn === 1) next.clock1 = next.initialMs
    else next.clock2 = next.initialMs
  } else if (mover === 1) next.clock1 += next.incrementMs
  else next.clock2 += next.incrementMs
  return next
}
