export const START_RATING = 1200
export const START_PUZZLE_RATING = 1000

export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400))
}

export function eloDelta(rating: number, opponent: number, score: number, gamesPlayed: number): number {
  const k = gamesPlayed < 20 ? 40 : 24
  return Math.round(k * (score - expectedScore(rating, opponent)))
}

export function rankTitle(rating: number): string {
  if (rating < 1100) return 'Новичок'
  if (rating < 1300) return 'Игрок'
  if (rating < 1500) return 'Знаток'
  if (rating < 1700) return 'Мастер'
  return 'Гроссмейстер'
}
