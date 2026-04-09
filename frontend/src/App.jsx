import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider }  from './context/AuthContext'
import ProtectedRoute    from './components/ProtectedRoute'
import Navbar            from './components/Navbar'
import Home              from './pages/Home'
import HeadToHead        from './pages/HeadToHead'
import Tournament        from './pages/Tournament'
import Today             from './pages/Today'
import PlayerProfile     from './pages/PlayerProfile'
import Login             from './pages/Login'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
          <Routes>
            <Route path="/"       element={<Home />} />
            <Route path="/today"  element={<Today />} />
            <Route path="/login"  element={<Login />} />

            <Route path="/h2h" element={
              <ProtectedRoute><HeadToHead /></ProtectedRoute>
            } />
            <Route path="/tournament" element={
              <ProtectedRoute><Tournament /></ProtectedRoute>
            } />
            <Route path="/players" element={
              <ProtectedRoute><PlayerProfile /></ProtectedRoute>
            } />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  )
}
