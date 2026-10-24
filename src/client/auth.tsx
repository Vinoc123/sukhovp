import { createContext, useContext, useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { api, type User } from './api.ts'
import { Avatar } from './components/Avatar.tsx'

const AuthContext = createContext<{
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  refresh: () => Promise<void>
} | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('Нет контекста входа')
  return value
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  async function refresh() {
    setUser(await api.me())
  }
  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [])
  return <AuthContext.Provider value={{ user, loading, setUser, refresh }}>{children}</AuthContext.Provider>
}

export function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="center">Открываем зал…</p>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return children
}

export function Layout() {
  const { user, loading, setUser } = useAuth()
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" to="/">Квартет</Link>
        <nav className="nav">
          <NavLink to="/play">Играть</NavLink>
          <NavLink to="/leaderboard">Рейтинг</NavLink>
        </nav>
        {loading ? null : user ? (
          <Link className="userchip" to={`/u/${encodeURIComponent(user.username)}`}>
            <Avatar name={user.username} size={36} />
            <span>
              <strong>{user.username}</strong>
              <span>{user.rating}</span>
            </span>
          </Link>
        ) : (
          <Link className="btn ghost" to="/login">Войти</Link>
        )}
        {user && (
          <button
            className="chip"
            type="button"
            onClick={() => api.logout().then(() => setUser(null))}
          >
            Выйти
          </button>
        )}
      </header>
      <Outlet />
      <footer className="site-note">Это не коммерческий проект, а школьная работа. Сайт не предназначен для продажи товаров или оказания услуг.</footer>
    </div>
  )
}
