import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MODIFIERS } from '../../engine/presets.ts'
import { api } from '../api.ts'
import { Avatar } from '../components/Avatar.tsx'

type Profile = Awaited<ReturnType<typeof api.profile>>

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return <p className="muted">Сыграйте рейтинговую партию — здесь появится график.</p>
  const min = Math.min(...points) - 10
  const max = Math.max(...points) + 10
  const width = 560
  const height = 150
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width
    const y = height - ((point - min) / (max - min)) * (height - 8) - 4
    return `${x},${y}`
  }).join(' ')
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="График рейтинга">
      <polyline points={coords} />
    </svg>
  )
}

const RESULT = { win: 'Победа', loss: 'Поражение', draw: 'Ничья' }

export function ProfilePage() {
  const { username = '' } = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.profile(username).then(setProfile).catch((reason: Error) => setError(reason.message))
  }, [username])
  if (error) return <p className="center error">{error}</p>
  if (!profile) return <p className="center">Открываем профиль…</p>
  const winRate = profile.gamesPlayed ? Math.round((profile.wins / profile.gamesPlayed) * 100) : 0
  return (
    <section className="page">
      <div className="profile-hero">
        <Avatar name={profile.username} size={120} />
        <div>
          <p className="eyebrow">{profile.rank} · {profile.place} место</p>
          <h1>{profile.username}</h1>
          <p className="rating-big">{profile.rating}<small>Эло</small></p>
          <p className="muted">На сайте с {new Date(profile.createdAt).toLocaleDateString('ru-RU')} · задачи {profile.puzzleRating}</p>
        </div>
      </div>
      <div className="stats">
        <article className="stat"><b>{profile.gamesPlayed}</b><span className="muted">партий</span></article>
        <article className="stat"><b>{profile.wins}</b><span className="muted">побед</span></article>
        <article className="stat"><b>{winRate}%</b><span className="muted">процент побед</span></article>
        <article className="stat"><b>{profile.puzzleSolved}</b><span className="muted">задач</span></article>
      </div>
      <article className="panel">
        <h2>Рейтинг</h2>
        <Spark points={profile.history.map((point) => point.rating)} />
      </article>
      <div className="split">
        <article className="panel recent">
          <h2>Последние партии</h2>
          {profile.recent.length === 0 && <p className="muted">Пока тихо.</p>}
          {profile.recent.map((game) => (
            <Link key={game.id} to={`/play/${game.id}`}>
              <span>
                <b>{RESULT[game.result]}</b> против {game.opponent}
                <div className="muted">{MODIFIERS.find((item) => item.id === game.modifier)?.label}</div>
              </span>
              <b>{game.delta === null || game.delta === undefined ? '' : game.delta > 0 ? `+${game.delta}` : game.delta}</b>
            </Link>
          ))}
        </article>
        <article className="panel">
          <h2>Задачи</h2>
          <div className="dots">
            {profile.puzzles.map((puzzle, index) => (
              <Link key={puzzle.id} className={`dot ${puzzle.solved ? 'on' : ''}`} to={`/puzzles/${puzzle.id}`} title={puzzle.title}>
                {index + 1}
              </Link>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}
