// Link is like <a> but uses client-side navigation (no page reload)
// useLocation gives us the current URL path so we can highlight the active link
import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()

  const links = [
    { to: '/',           label: 'Home' },
    { to: '/h2h',        label: 'Head-to-Head' },
    { to: '/tournament', label: 'Tournament' },
  ]

  return (
    <nav className="bg-gray-900 text-white px-6 py-4 flex items-center gap-8 shadow-lg">
      <span className="font-bold text-lg text-green-400 tracking-tight">
        🎾 ATP Predictor
      </span>

      <div className="flex gap-6">
        {links.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            // Add green color + bold when this link matches the current URL
            className={`text-sm transition-colors hover:text-green-400 ${
              pathname === to
                ? 'text-green-400 font-semibold'
                : 'text-gray-300'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
