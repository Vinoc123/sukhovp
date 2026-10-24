import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { applyMove, createGame } from '../../engine/board.ts'
import type { GameState } from '../../engine/types.ts'
import { Board } from '../components/Board.tsx'

const SCRIPT = [3, 3, 2, 2, 4, 4, 1]

function useDemo(): GameState {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setStep((value) => value + 1), 700)
    return () => clearInterval(timer)
  }, [])
  const cycle = SCRIPT.length + 3
  const index = step % cycle
  let state = createGame({ rows: 6, cols: 7, connect: 4, modifier: 'classic' })
  for (let i = 0; i < Math.min(index, SCRIPT.length); i++) state = applyMove(state, { type: 'drop', col: SCRIPT[i] })
  return state
}

export function HomePage() {
  const demo = useDemo()
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Онлайн-зал</p>
          <h1>Квартет</h1>
          <p className="lede">
            Четыре в ряд с рейтингом, часами и задачами. Доска может перевернуться, повернуться или отдать вам сразу две фишки.
          </p>
          <div className="cta">
            <Link className="btn gold" to="/play">Играть</Link>
            <Link className="btn ghost" to="/puzzles">Задачи</Link>
            <Link className="btn ghost" to="/leaderboard">Рейтинг</Link>
          </div>
        </div>
        <div className="demo">
          <Board rows={demo.rules.rows} cols={demo.rules.cols} cells={demo.cells} gravity={1} winLine={demo.winLine} />
        </div>
      </section>
      <section className="page">
        <div className="features">
          <article className="feature">
            <h3>Пять правил</h3>
            <p>Классика, переворот гравитации, выталкивание своей фишки, поворот поля и двойной ход.</p>
          </article>
          <article className="feature">
            <h3>Свои часы</h3>
            <p>Без лимита, 10+5, 5+3, 3+2, минута или 30 секунд на ход. Время считает сервер.</p>
          </article>
          <article className="feature">
            <h3>Задачи</h3>
            <p>Иногда хватает одного хода, иногда лучших ходов три. Ошибка возвращает позицию назад.</p>
          </article>
        </div>
      </section>
    </>
  )
}
