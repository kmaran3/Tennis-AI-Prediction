import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTodaysMatches } from '../api/client'
import { Skeleton } from '../components/Skeleton'

const surfaceColor = {
  Hard:  'bg-blue-100 text-blue-700',
  Clay:  'bg-orange-100 text-orange-700',
  Grass: 'bg-green-100 text-green-700',
}

export default function Today() {
  const [matches,  setMatches]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [surface,  setSurface]  = useState('Hard')
  const navigate = useNavigate()

  useEffect(() => {
    getTodaysMatches()
      .then(res => {
        setMatches(res.data.matches || [])
        if (res.data.error) setError('Live schedule unavailable — showing cached data.')
      })
      .catch(() => setError('Could not reach backend.'))
      .finally(() => setLoading(false))
  }, [])

  const handlePredict = (match) => {
    // Navigate to H2H with pre-populated player names and surface
    const params = new URLSearchParams({
      a: match.player_a,
      b: match.player_b,
      surface,
    })
    navigate(`/h2h?${params}`)
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Today's Matches</h1>
          <p className="text-sm text-gray-400 mt-1">{today} · ATP Tour</p>
        </div>

        {/* Surface picker — applied to predictions from this page */}
        <div className="flex gap-2 flex-wrap">
          {['Hard', 'Clay', 'Grass'].map(s => (
            <button
              key={s}
              onClick={() => setSurface(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                surface === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-300 text-gray-500 hover:border-gray-500'
              }`}
            >
              {s}
            </button>
          ))}
          <span className="text-xs text-gray-400 self-center ml-1">prediction surface</span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-2">{error}</p>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {/* No matches */}
      {!loading && matches.length === 0 && !error && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎾</p>
          <p className="font-medium">No ATP matches found for today.</p>
          <p className="text-sm mt-1">Check back during tournament weeks.</p>
        </div>
      )}

      {/* Match cards */}
      {!loading && matches.length > 0 && (
        <div className="space-y-3">
          {matches.map(match => (
            <div
              key={match.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4
                         flex flex-col sm:flex-row sm:items-center gap-4"
            >
              {/* Players */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">
                  {match.player_a}
                  <span className="text-gray-400 font-normal mx-2">vs</span>
                  {match.player_b}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{match.tournament}</p>
              </div>

              {/* Status badge */}
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                match.completed
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-green-100 text-green-700'
              }`}>
                {match.status}
              </span>

              {/* Predict button */}
              <button
                onClick={() => handlePredict(match)}
                className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold
                           px-4 py-2 rounded-xl transition-all flex-shrink-0"
              >
                Predict →
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Match schedule from ESPN · Click Predict to run AI prediction for any match
      </p>
    </div>
  )
}
