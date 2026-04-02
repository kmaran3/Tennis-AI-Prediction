// React Router gives us navigation between pages without full page reloads.
// BrowserRouter: enables URL-based routing
// Routes + Route: maps URL paths to page components
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import HeadToHead from './pages/HeadToHead'
import Tournament from './pages/Tournament'

export default function App() {
  return (
    <BrowserRouter>
      {/* Navbar is outside Routes so it appears on every page */}
      <Navbar />

      {/* The content area — only the matching route renders here */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/"           element={<Home />} />
          <Route path="/h2h"        element={<HeadToHead />} />
          <Route path="/tournament" element={<Tournament />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
