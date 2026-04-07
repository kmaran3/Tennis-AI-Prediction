import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()

  const links = [
    { to: '/',           label: 'Home' },
    { to: '/today',      label: 'Match Center' },
    { to: '/h2h',        label: 'Head-to-Head' },
    { to: '/tournament', label: 'Tournament' },
  ]

  const linkClass = (to) =>
    `text-sm transition-colors hover:text-green-400 ${
      pathname === to ? 'text-green-400 font-semibold' : 'text-gray-300'
    }`

  return (
    <nav className="bg-gray-900 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="font-bold text-lg text-green-400 tracking-tight flex-shrink-0">
          🎾 ATP Predictor
        </Link>

        {/* Desktop links + auth */}
        <div className="hidden md:flex items-center gap-6">
          {links.map(({ to, label }) => (
            <Link key={to} to={to} className={linkClass(to)}>{label}</Link>
          ))}

          {/* Auth section */}
          {user ? (
            <div className="flex items-center gap-3 border-l border-gray-700 pl-5">
              <span className="text-sm text-gray-300">Hi, <span className="text-white font-semibold">{user.username}</span></span>
              <button
                onClick={logout}
                className="text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400
                           px-3 py-1.5 rounded-lg transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="border-l border-gray-700 pl-5">
              <Link
                to="/login"
                className="text-sm text-gray-300 hover:text-green-400 transition-colors"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-gray-300 hover:text-white p-1"
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {open ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-gray-800 px-4 py-3 flex flex-col gap-4">
          {links.map(({ to, label }) => (
            <Link key={to} to={to} onClick={() => setOpen(false)} className={linkClass(to)}>
              {label}
            </Link>
          ))}

          {/* Mobile auth */}
          {user ? (
            <>
              <span className="text-sm text-gray-300">Hi, <span className="text-white font-semibold">{user.username}</span></span>
              <button
                onClick={() => { logout(); setOpen(false) }}
                className="text-sm text-gray-400 hover:text-white text-left transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" onClick={() => setOpen(false)} className="text-sm text-gray-300 hover:text-green-400 transition-colors">
              Sign In
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
