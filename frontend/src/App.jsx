import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar        from './components/Navbar'
import Home          from './pages/Home'
import HeadToHead    from './pages/HeadToHead'
import Tournament    from './pages/Tournament'
import Today         from './pages/Today'
import PlayerProfile from './pages/PlayerProfile'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/"              element={<Home />} />
          <Route path="/today"         element={<Today />} />
          <Route path="/h2h"           element={<HeadToHead />} />
          <Route path="/tournament"    element={<Tournament />} />
          <Route path="/players/:name" element={<PlayerProfile />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
