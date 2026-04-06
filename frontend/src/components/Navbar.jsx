import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  const links = [
    { to: '/',           label: 'Home' },
    { to: '/today',      label: "Today" },
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

        {/* Desktop links */}
        <div className="hidden md:flex gap-6">
          {links.map(({ to, label }) => (
            <Link key={to} to={to} className={linkClass(to)}>{label}</Link>
          ))}
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
        </div>
      )}
    </nav>
  )
}
