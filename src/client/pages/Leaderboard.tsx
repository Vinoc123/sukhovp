import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.ts'
import { Avatar } from '../components/Avatar.tsx'
import { ruWord } from '../words.ts'

interface Row {
  place: number
  username: string
  rating: number
  wins: number
  losses: number
  draws: number
  games: number
  you: boolean
}

export function LeaderboardPage() {
  const [players, setPlayers] = useState<Row[] | null>(null)
  useEffect(() => {
    api.leaderboard().then((data) => setPlayers(data.players))
  }, [])
  if (!players) return <p className="center">Считаем рейтинг…</p>
  return (
    <section className="page">
      <p className="eyebrow">Таблица</p>
      <h1>Рейтинг</h1>
      <div className="ladder">
        {players.length === 0 && <p className="muted">Пока никто не зарегистрировался.</p>}
        {players.map((player) => (
          <Link key={player.username} className={player.you ? 'me' : ''} to={`/u/${encodeURIComponent(player.username)}`}>
            <span className="place">{player.place}</span>
            <Avatar name={player.username} size={42} />
            <span>
              <b>{player.username}</b>
              <div className="muted">{player.games} {ruWord(player.games, 'партия', 'партии', 'партий')} · {player.games ? Math.round((player.wins / player.games) * 100) : 0}% побед</div>
            </span>
            <b>{player.rating}</b>
          </Link>
        ))}
      </div>
    </section>
  )
}
