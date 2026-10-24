import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Action } from '../../engine/types.ts'
import { api, type PuzzleCard, type PuzzleState } from '../api.ts'
import { Board } from '../components/Board.tsx'

export function PuzzlePage() {
  const { id = '' } = useParams()
  const [puzzle, setPuzzle] = useState<PuzzleCard | null>(null)
  const [state, setState] = useState<PuzzleState | null>(null)
  const [moves, setMoves] = useState<Action[]>([])
  const [message, setMessage] = useState('')
  const [shake, setShake] = useState(false)
  const [popMode, setPopMode] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.puzzle(id).then((item) => {
      setPuzzle(item)
      setState({
        rows: item.rows,
        cols: item.cols,
        connect: item.connect,
        modifier: item.modifier,
        cells: item.cells,
        gravity: item.gravity,
        turn: item.you,
        winner: 0,
        winLine: null,
        rushLeft: 1,
        plies: item.plies,
      })
      setMoves([])
      setMessage(item.solved ? 'Вы уже решали эту задачу. Можно пройти ещё раз.' : '')
    }).catch((reason: Error) => setError(reason.message))
  }, [id])

  async function play(col: number) {
    if (!puzzle || !state || state.winner) return
    const nextMoves = [...moves, { type: popMode ? 'pop' as const : 'drop' as const, col }]
    try {
      const result = await api.attempt(id, nextMoves)
      if (result.status === 'wrong') {
        setMoves([])
        setMessage(result.message || 'Это не лучший ход')
        setShake(true)
        setTimeout(() => setShake(false), 450)
        setState((current) => current && { ...current, ...result.state })
        return
      }
      setMoves(nextMoves)
      setState(result.state)
      setMessage(result.message || '')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вышло')
    }
  }

  if (error) return <p className="center error">{error}</p>
  if (!puzzle || !state) return <p className="center">Открываем задачу…</p>
  const step = Math.min(moves.length + 1, puzzle.steps)
  return (
    <section className="page">
      <p className="eyebrow">Задача</p>
      <h1>{puzzle.title}</h1>
      <p className="lede">{state.winner ? 'Линия собрана.' : `Ход ${step} из ${puzzle.steps}`}</p>
      <div className={shake ? 'shake' : ''}>
        <Board
          rows={state.rows}
          cols={state.cols}
          cells={state.cells}
          gravity={state.gravity}
          winLine={state.winLine}
          interactive={!state.winner}
          popMode={popMode && puzzle.modifier === 'pop'}
          you={puzzle.you}
          onColumn={play}
        />
      </div>
      {puzzle.modifier === 'pop' && !state.winner && (
        <div className="row-actions">
          <button className={`btn ${popMode ? 'ghost' : 'gold'}`} type="button" onClick={() => setPopMode(false)}>Сбросить</button>
          <button className={`btn ${popMode ? 'gold' : 'ghost'}`} type="button" onClick={() => setPopMode(true)}>Вынуть</button>
        </div>
      )}
      {message && <p className={state.winner ? 'banner' : 'error'}>{message}</p>}
      <div className="row-actions">
        <Link className="btn ghost" to="/puzzles">К списку</Link>
      </div>
    </section>
  )
}
