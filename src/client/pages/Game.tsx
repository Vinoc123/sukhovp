import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { applyMove, createGame } from '../../engine/board.ts'
import { MODIFIERS, TIME_CONTROLS } from '../../engine/presets.ts'
import type { GameState } from '../../engine/types.ts'
import { api, type Game } from '../api.ts'
import { useAuth } from '../auth.tsx'
import { Avatar } from '../components/Avatar.tsx'
import { Board } from '../components/Board.tsx'

function formatClock(ms: number, unlimited: boolean) {
  if (unlimited) return '∞'
  const left = Math.max(0, ms)
  if (left < 10_000) return (left / 1000).toFixed(1)
  const total = Math.ceil(left / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function resultCopy(game: Game) {
  if (!game.winner) return null
  if (game.winner === 3 || game.winReason === 'agreement') return 'Ничья'
  if (!game.you) return game.winner === 1 ? 'Победили красные' : 'Победили светлые'
  const won = game.winner === game.you
  if (game.winReason === 'timeout') return won ? 'Соперник просрочил время' : 'Время вышло'
  if (game.winReason === 'resign') return won ? 'Соперник сдался' : 'Вы сдались'
  return won ? 'Победа' : 'Поражение'
}

export function GamePage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [snap, setSnap] = useState<{ game: Game; at: number } | null>(null)
  const [error, setError] = useState('')
  const [popMode, setPopMode] = useState(false)
  const [confirmResign, setConfirmResign] = useState(false)
  const [scrub, setScrub] = useState<number | null>(null)
  const [fallIndex, setFallIndex] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const ticket = useRef(0)
  const previous = useRef<number[] | null>(null)

  useEffect(() => {
    const mark = ++ticket.current
    api.game(id).then((game) => {
      if (mark === ticket.current) setSnap({ game, at: Date.now() })
    }).catch((reason: Error) => setError(reason.message))
    const timer = setInterval(() => {
      const seen = ticket.current
      api.game(id).then((game) => {
        if (seen !== ticket.current) return
        setSnap((current) => {
          if (current && game.plies < current.game.plies) return current
          if (current && current.game.status === 'finished' && game.status !== 'finished') return current
          return { game, at: Date.now() }
        })
      }).catch(() => undefined)
    }, 700)
    return () => clearInterval(timer)
  }, [id])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(timer)
  }, [])

  const game = snap?.game
  const frames = useMemo(() => {
    if (!game) return []
    let state = createGame({
      rows: game.initialRows,
      cols: game.initialCols,
      connect: game.connect,
      modifier: game.modifier,
    })
    const list: GameState[] = [state]
    for (const move of game.moves) {
      state = applyMove(state, move)
      list.push(state)
    }
    return list
  }, [game])

  const viewIndex = game?.status === 'finished' ? (scrub ?? frames.length - 1) : frames.length - 1
  const view = frames[viewIndex]

  useEffect(() => {
    if (!view) return
    const before = previous.current
    previous.current = view.cells
    if (!before || before.length !== view.cells.length) {
      setFallIndex(null)
      return
    }
    let added: number | null = null
    for (let index = 0; index < view.cells.length; index++) {
      if (before[index] === 0 && view.cells[index] !== 0) {
        if (added !== null) {
          setFallIndex(null)
          return
        }
        added = index
      } else if (before[index] !== view.cells[index]) {
        setFallIndex(null)
        return
      }
    }
    setFallIndex(added)
  }, [view])

  if (error) return <p className="center error">{error}</p>
  if (!game || !view) return <p className="center">Собираем доску…</p>

  const mine = game.you ? game.players.find((player) => player.seat === game.you) : undefined
  const yourTurn = game.status === 'active' && game.you === view.turn && viewIndex === frames.length - 1 && !view.winner
  const elapsed = snap ? now - snap.at : 0
  const modifier = MODIFIERS.find((item) => item.id === game.modifier)
  const time = TIME_CONTROLS.find((item) => item.id === game.timeId)
  const motion: 'flip' | 'rotate' | null =
    game.plies > 0 && game.plies % 4 === 0 ? (game.modifier === 'flip' ? 'flip' : game.modifier === 'rotate' ? 'rotate' : null) : null

  async function play(col: number) {
    if (!yourTurn) return
    const mark = ++ticket.current
    try {
      const next = await api.move(id, { type: popMode ? 'pop' : 'drop', col })
      if (mark === ticket.current) setSnap({ game: next, at: Date.now() })
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ход не принят')
    }
  }

  async function act(kind: 'resign' | 'offer' | 'accept' | 'decline') {
    const mark = ++ticket.current
    const next = kind === 'resign' ? await api.resign(id) : await api.draw(id, kind)
    if (mark === ticket.current) setSnap({ game: next, at: Date.now() })
    setConfirmResign(false)
  }

  const headline = resultCopy(game)
  const delta = mine?.delta

  return (
    <section className="page">
      {game.status === 'waiting' && (
        <div className="lobby">
          <p className="eyebrow">Комната</p>
          <code>{game.id}</code>
          <p className="lede">Пришлите сопернику ссылку. Красные ходят первыми.</p>
          <div className="row-actions" style={{ justifyContent: 'center' }}>
            <button className="btn gold" type="button" onClick={() => navigator.clipboard.writeText(window.location.href)}>Скопировать ссылку</button>
            {user && game.you === null && <button className="btn ghost" type="button" onClick={() => api.join(id).then((next) => setSnap({ game: next, at: Date.now() }))}>Сесть за стол</button>}
            {!user && <Link className="btn ghost" to={`/login?next=${encodeURIComponent(`/play/${game.id}`)}`}>Войти, чтобы сесть</Link>}
          </div>
        </div>
      )}
      <div className="stage">
        <div>
          {game.players.map((player) => {
            const clock = player.clockMs - (game.clockRunning && game.turn === player.seat ? elapsed : 0)
            return (
              <article key={player.seat} className={`sidecard ${game.turn === player.seat && game.status === 'active' ? 'turn' : ''}`}>
                <div className="who">
                  <Avatar name={player.username} size={48} />
                  <div>
                    <strong>{player.username}</strong>
                    <div className="muted">{player.seat === 1 ? 'Красные' : 'Светлые'}{player.rating ? ` · ${player.rating}` : ''}</div>
                  </div>
                </div>
                <div className="clock">{formatClock(clock, game.unlimited)}</div>
              </article>
            )
          })}
          <article className="sidecard">
            <div className="muted">{modifier?.label} · {time?.label}{game.rated ? ' · рейтинг' : ''}</div>
            {game.gravity === -1 && <p>Фишки падают вверх.</p>}
            {game.modifier === 'rush' && yourTurn && <p>{view.rushLeft === 1 ? 'Осталась вторая фишка.' : 'Две фишки за этот ход.'}</p>}
            <ol className="moves">
              {game.moves.map((move, index) => (
                <li key={index}><span>{index + 1}</span><span>{move.type === 'pop' ? `вынуть ${move.col + 1}` : move.col + 1}</span></li>
              ))}
            </ol>
          </article>
        </div>
        <div>
          <div className={fallIndex === null && motion ? '' : ''}>
            <Board
              rows={view.rules.rows}
              cols={view.rules.cols}
              cells={view.cells}
              gravity={view.gravity}
              winLine={view.winLine}
              interactive={yourTurn}
              popMode={popMode && game.modifier === 'pop'}
              you={game.you}
              fallIndex={viewIndex === frames.length - 1 ? fallIndex : null}
              motion={viewIndex === frames.length - 1 ? motion : null}
              onColumn={play}
            />
          </div>
          {game.modifier === 'pop' && yourTurn && (
            <div className="row-actions">
              <button className={`btn ${popMode ? 'ghost' : 'gold'}`} type="button" onClick={() => setPopMode(false)}>Сбросить</button>
              <button className={`btn ${popMode ? 'gold' : 'ghost'}`} type="button" onClick={() => setPopMode(true)}>Вынуть</button>
            </div>
          )}
          {headline && viewIndex === frames.length - 1 && (
            <div className="banner">
              <h2>{headline}</h2>
              {delta !== null && delta !== undefined && <p>{delta > 0 ? `+${delta}` : delta} к рейтингу</p>}
              <Link className="btn gold" to="/play">Ещё партия</Link>
            </div>
          )}
          {game.status === 'finished' && frames.length > 1 && (
            <input className="slider" type="range" min={0} max={frames.length - 1} value={viewIndex} onChange={(event) => setScrub(Number(event.target.value))} />
          )}
          {error && <p className="error">{error}</p>}
          {game.status === 'active' && game.you && (
            <div className="row-actions">
              {confirmResign ? (
                <>
                  <button className="btn danger" type="button" onClick={() => act('resign')}>Да, сдать</button>
                  <button className="btn ghost" type="button" onClick={() => setConfirmResign(false)}>Остаться</button>
                </>
              ) : (
                <button className="btn danger" type="button" onClick={() => setConfirmResign(true)}>Сдаться</button>
              )}
              {!game.botLevel && game.drawOffer === 0 && <button className="btn ghost" type="button" onClick={() => act('offer')}>Предложить ничью</button>}
              {!game.botLevel && game.drawOffer === game.you && <span className="muted">Ждём ответ на ничью</span>}
              {!game.botLevel && game.drawOffer !== 0 && game.drawOffer !== game.you && (
                <>
                  <button className="btn gold" type="button" onClick={() => act('accept')}>Принять ничью</button>
                  <button className="btn ghost" type="button" onClick={() => act('decline')}>Отклонить</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
