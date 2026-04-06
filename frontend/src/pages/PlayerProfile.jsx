import { useState, useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { getPlayerStats, getRecentForm } from '../api/client'
import RecentForm from '../components/RecentForm'
import SurfaceRadar from '../components/SurfaceRadar'
import { CardSkeleton } from '../components/Skeleton'

function StatBox({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center">
      <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  )
}

export default function PlayerProfile() {
  const [searchParams] = useSearchParams()
  const decoded = searchParams.get('name') || ''
  const navigate = useNavigate()

  const [stats,      setStats]      = useState(null)
  const [form,       setForm]       = useState([])
  const [surface,    setSurface]    = useState(null)  // null = all surfaces
  const [loadStats,  setLoadStats]  = useState(true)
  const [loadForm,   setLoadForm]   = useState(true)

  useEffect(() => {
    setLoadStats(true)
    setLoadForm(true)
    Promise.all([
      getPlayerStats(decoded, surface),
      getRecentForm(decoded, 10),
    ]).then(([sRes, fRes]) => {
      setStats(sRes.data)
      setForm(fRes.data.form || [])
    }).finally(() => {
      setLoadStats(false)
      setLoadForm(false)
    })
  }, [decoded, surface])

  const pct = v => v != null ? `${(v * 100).toFixed(1)}%` : '—'

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button onClick={() => navigate(-1)} className="text-xs text-blue-500 hover:underline">← Back</button>
          <h1 className="text-3xl font-bold text-gray-900 mt-1">{decoded}</h1>
        </div>

        {/* Surface filter */}
        <div className="flex gap-2 flex-wrap">
          {[null, 'Hard', 'Clay', 'Grass'].map(s => (
            <button
              key={s ?? 'all'}
              onClick={() => setSurface(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                surface === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-300 text-gray-500 hover:border-gray-500'
              }`}
            >
              {s ?? 'All Surfaces'}
            </button>
          ))}
        </div>
      </div>

      {loadStats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
        </div>
      ) : stats?.error ? (
        <p className="text-red-500 bg-red-50 rounded-lg px-4 py-3 text-sm">{stats.error}</p>
      ) : stats && (
        <>
          {/* Key stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Matches" value={stats.matches_played} />
            <StatBox label="Win Rate" value={pct(stats.win_rate)} />
            <StatBox label="Avg Ranking" value={stats.avg_rank != null ? `#${Math.round(stats.avg_rank)}` : '—'} />
            <StatBox label="Upset Wins" value={stats.upset_wins} />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Surface breakdown table */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-800 mb-4">By Surface</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 text-left border-b">
                    <th className="pb-2">Surface</th>
                    <th className="pb-2 text-right">Matches</th>
                    <th className="pb-2 text-right">Wins</th>
                    <th className="pb-2 text-right">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {['Hard', 'Clay', 'Grass'].map(s => {
                    const d = stats.surface_win_rates?.[s]
                    return (
                      <tr key={s} className="border-b last:border-0">
                        <td className="py-2 font-medium text-gray-700">{s}</td>
                        <td className="py-2 text-right text-gray-500">{d?.matches ?? '—'}</td>
                        <td className="py-2 text-right text-gray-500">{d?.wins ?? '—'}</td>
                        <td className="py-2 text-right font-semibold text-gray-900">
                          {d ? pct(d.win_rate) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Surface radar */}
            <SurfaceRadar playerA={decoded} statsA={stats} />
          </div>

          {/* Tournament tiers */}
          {stats.tier_win_rates && Object.keys(stats.tier_win_rates).length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-800 mb-4">By Tournament Tier</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(stats.tier_win_rates)
                  .sort(([, a], [, b]) => b.matches - a.matches)
                  .slice(0, 8)
                  .map(([tier, d]) => (
                    <div key={tier} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 truncate">{tier}</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">{pct(d.win_rate)}</p>
                      <p className="text-xs text-gray-400">{d.matches} matches</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Recent form */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3">Recent Matches</h2>
        <RecentForm player={decoded} form={form} isLoading={loadForm} showProfileLink={false} />
      </div>

      {/* Link to H2H */}
      <div className="text-center">
        <Link
          to={`/h2h?a=${encodeURIComponent(decoded)}&surface=${surface || 'Hard'}`}
          className="inline-block bg-green-500 hover:bg-green-600 text-white
                     font-semibold px-6 py-3 rounded-xl transition-all shadow-sm text-sm"
        >
          Predict a match with {decoded} →
        </Link>
      </div>
    </div>
  )
}
