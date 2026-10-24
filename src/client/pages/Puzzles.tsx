import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type PuzzleCard } from '../api.ts'

const NAMES = { 1: 'В один ход', 2: 'В два хода', 3: 'В три хода' }

export function PuzzlesPage() {
  const [puzzles, setPuzzles] = useState<PuzzleCard[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.puzzles().then(setPuzzles).catch((reason: Error) => setError(reason.message))
  }, [])
  if (error) return <p className="center error">{error}</p>
  if (!puzzles) return <p className="center">Раскладываем задачи…</p>
  return (
    <section className="page">
      <p className="eyebrow">Задачи</p>
      <h1>Лучший ход</h1>
      <p className="lede">Сыграйте отмеченную последовательность. Чужой ответ доска делает сама.</p>
      <div className="puzzle-groups">
        {([1, 2, 3] as const).map((difficulty) => (
          <div key={difficulty}>
            <p className="section-label">{NAMES[difficulty]}</p>
            <div className="cards">
              {puzzles.filter((puzzle) => puzzle.difficulty === difficulty).map((puzzle) => (
                <Link key={puzzle.id} className={`puzzle-card ${puzzle.solved ? 'solved' : ''}`} to={`/puzzles/${puzzle.id}`}>
                  <b>{puzzle.title}</b>
                  <p className="muted">{puzzle.solved ? 'Решена' : puzzle.modifier === 'classic' ? 'Классика' : puzzle.modifier === 'flip' ? 'Переворот' : 'Выталкивание'}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
