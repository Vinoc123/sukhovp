import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, Guard, Layout } from './auth.tsx'
import { AuthPage } from './pages/Auth.tsx'
import { GamePage } from './pages/Game.tsx'
import { HomePage } from './pages/Home.tsx'
import { PlayPage } from './pages/Play.tsx'
import './styles.css'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/play" element={<Guard><PlayPage /></Guard>} />
            <Route path="/play/:id" element={<GamePage />} />
            <Route path="*" element={<p className="center">Такой страницы нет.</p>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
