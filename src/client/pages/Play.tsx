import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BOARD_PRESETS, MODIFIERS, TIME_CONTROLS } from '../../engine/presets.ts'
import type { BotLevel, Modifier } from '../../engine/types.ts'
import { api } from '../api.ts'

export function PlayPage() {
  const navigate = useNavigate()
  const [presetId, setPresetId] = useState('classic')
  const [modifier, setModifier] = useState<Modifier>('classic')
  const [timeId, setTimeId] = useState('5+3')
  const [rated, setRated] = useState(true)
  const [ticket, setTicket] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const settings = { presetId, modifier, timeId, rated }

  useEffect(() => {
    if (!ticket) return
    const timer = setInterval(() => {
      api.ticket(ticket).then((status) => {
        if (status.gameId) navigate(`/play/${status.gameId}`)
      }).catch((reason: Error) => setError(reason.message))
    }, 700)
    return () => clearInterval(timer)
  }, [ticket, navigate])

  async function start(mode: 'room' | 'bot', botLevel?: BotLevel) {
    setError('')
    setPending(true)
    try {
      const game = await api.createGame({ mode, ...settings, rated: mode === 'bot' ? false : rated, botLevel })
      navigate(`/play/${game.id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вышло')
    } finally {
      setPending(false)
    }
  }

  async function queue() {
    setError('')
    setPending(true)
    try {
      const result = await api.queue(settings)
      if (result.gameId) navigate(`/play/${result.gameId}`)
      else setTicket(result.ticketId)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вышло')
    } finally {
      setPending(false)
    }
  }

  if (ticket) {
    return (
      <section className="page lobby">
        <p className="eyebrow">Поиск</p>
        <h1>Ищем соперника</h1>
        <p className="lede">Как только найдётся пара с теми же правилами, партия начнётся сама.</p>
        <button className="btn ghost" type="button" onClick={() => api.cancelTicket(ticket).then(() => setTicket(null))}>Отмена</button>
      </section>
    )
  }

  return (
    <section className="page">
      <p className="eyebrow">Новая партия</p>
      <h1>Собрать стол</h1>
      <p className="section-label">Доска</p>
      <div className="choices">
        {BOARD_PRESETS.map((preset) => (
          <button key={preset.id} className={`choice ${presetId === preset.id ? 'on' : ''}`} type="button" onClick={() => setPresetId(preset.id)}>
            <b>{preset.label}</b>
            <span>{preset.hint}</span>
          </button>
        ))}
      </div>
      <p className="section-label">Правило</p>
      <div className="choices">
        {MODIFIERS.map((item) => (
          <button key={item.id} className={`choice ${modifier === item.id ? 'on' : ''}`} type="button" onClick={() => setModifier(item.id)}>
            <b>{item.label}</b>
            <span>{item.text}</span>
          </button>
        ))}
      </div>
      <p className="section-label">Часы</p>
      <div className="choices">
        {TIME_CONTROLS.map((item) => (
          <button key={item.id} className={`choice ${timeId === item.id ? 'on' : ''}`} type="button" onClick={() => setTimeId(item.id)}>
            <b>{item.label}</b>
          </button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={rated} onChange={(event) => setRated(event.target.checked)} />
        Рейтинговая партия. Робот рейтинг не меняет.
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row-actions">
        <button className="btn gold" type="button" disabled={pending} onClick={queue}>Найти соперника</button>
        <button className="btn ghost" type="button" disabled={pending} onClick={() => start('room')}>Создать комнату</button>
        <button className="btn ghost" type="button" disabled={pending} onClick={() => start('bot', 'easy')}>Робот лёгкий</button>
        <button className="btn ghost" type="button" disabled={pending} onClick={() => start('bot', 'medium')}>Средний</button>
        <button className="btn ghost" type="button" disabled={pending} onClick={() => start('bot', 'hard')}>Сложный</button>
      </div>
    </section>
  )
}
