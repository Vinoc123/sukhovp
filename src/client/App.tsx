import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, Layout } from './auth.tsx'
import { AuthPage } from './pages/Auth.tsx'
import './styles.css'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="*" element={<p className="center">Зал собирается.</p>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
