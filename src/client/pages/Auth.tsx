import { FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.ts'
import { useAuth } from '../auth.tsx'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const next = params.get('next') || '/'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const user = mode === 'login' ? await api.login(username, password) : await api.register(username, password)
      setUser(user)
      navigate(next.startsWith('/') ? next : '/')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вышло')
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <p className="eyebrow">{mode === 'login' ? 'Вход' : 'Регистрация'}</p>
      <h1>{mode === 'login' ? 'С возвращением' : 'Новый игрок'}</h1>
      <label>
        Ник
        <input type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
      </label>
      <label>
        Пароль
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn gold" type="submit">{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
      <p className="muted">
        {mode === 'login' ? <Link to={`/register?next=${encodeURIComponent(next)}`}>Нет аккаунта</Link> : <Link to={`/login?next=${encodeURIComponent(next)}`}>Уже есть ник</Link>}
      </p>
    </form>
  )
}
