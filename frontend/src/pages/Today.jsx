import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTodaysMatches } from '../api/client'
import { Skeleton } from '../components/Skeleton'

// Sort order: not started first, then live, then finished
const STATUS_ORDER = { notstarted: 0, inprogress: 1, finished: 2 }

function sortMatches(matches) {
  return [...matches].sort(
    (a, b) => (STATUS_ORDER[a.status_type] ?? 1) - (STATUS_ORDER[b.status_type] ?? 1)
  )
}

function StatusBadge({ status_type, status }) {
  if (status_type === 'inprogress') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Live
      </span>
    )
  }
  if (status_type === 'finished') {
    return (
      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full flex-shrink-0">
        Final
      </span>
    )
  }
  return (
    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full flex-shrink-0">
      {status}
    </span>
  )
}

function ScoreDisplay({ match }) {
  if (!match.score) return null

  // Split "6-4, 3-1 (30-15)" into sets and live game
  const liveGame = match.score.match(/\(([^)]+)\)/)
  const setsStr  = match.score.replace(/\s*\([^)]+\)/, '').trim()
  const sets     = setsStr.split(',').map(s => s.trim())

  const [aWins, bWins] = sets.reduce(
    ([a, b], set) => {
      const [h, aw] = set.split('-').map(Number)
      return [a + (h > aw ? 1 : 0), b + (aw > h ? 1 : 0)]
    },
    [0, 0]
  )

  return (
    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
      {/* Set scores */}
      <div className="flex items-center gap-2 text-sm font-mono">
        {sets.map((set, i) => {
          const [h, a] = set.split('-').map(Number)
          return (
            <span key={i} className={h > a ? 'font-bold text-gray-900' : 'text-gray-400'}>
              {set}
            </span>
          )
        })}
      </div>
      {/* Live game score */}
      {liveGame && (
        <span className="text-xs text-green-600 font-mono">{liveGame[1]}</span>
      )}
    </div>
  )
}

export default function Today() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    getTodaysMatches()
      .then(res => {
        const raw = res.data.matches || []
        setMatches(sortMatches(raw))
        if (res.data.error) setError('Could not reach live schedule.')
      })
      .catch(() => setError('Could not reach backend.'))
      .finally(() => setLoading(false))
  }, [])

  const handlePredict = (match) => {
    navigate(`/h2h?a=${encodeURIComponent(match.player_a)}&b=${encodeURIComponent(match.player_b)}&surface=${match.surface || 'Hard'}`)
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  // Group for section headers
  const notStarted = matches.filter(m => m.status_type === 'notstarted')
  const inProgress = matches.filter(m => m.status_type === 'inprogress')
  const finished   = matches.filter(m => m.status_type === 'finished')

  const MatchCard = ({ match }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4
                    flex flex-col sm:flex-row sm:items-center gap-4">
      {/* Players + tournament */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 text-sm">
            {match.player_a}
          </p>
          <span className="text-gray-400 text-xs">vs</span>
          <p className="font-semibold text-gray-900 text-sm">
            {match.player_b}
          </p>
        </div>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {match.tournament}
          {match.surface && (
            <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
              match.surface === 'Clay'  ? 'bg-orange-100 text-orange-700' :
              match.surface === 'Grass' ? 'bg-green-100 text-green-700'  :
                                          'bg-blue-100 text-blue-700'
            }`}>{match.surface}</span>
          )}
        </p>
      </div>

      {/* Score (live or final) */}
      {match.score && <ScoreDisplay match={match} />}

      {/* Status badge */}
      <StatusBadge status_type={match.status_type} status={match.status} />

      {/* Predict button */}
      <button
        onClick={() => handlePredict(match)}
        className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold
                   px-4 py-2 rounded-xl transition-all flex-shrink-0"
      >
        Predict →
      </button>
    </div>
  )

  const Section = ({ title, items }) => {
    if (items.length === 0) return null
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
          {title} ({items.length})
        </p>
        {items.map(m => <MatchCard key={m.id} match={m} />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Today's Matches</h1>
        <p className="text-sm text-gray-400 mt-1">{today} · ATP Tour</p>
      </div>

      {error && <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-2">{error}</p>}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && matches.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎾</p>
          <p className="font-medium">No ATP matches found for today.</p>
          <p className="text-sm mt-1">Check back during tournament weeks.</p>
        </div>
      )}

      {/* Grouped match sections */}
      {!loading && matches.length > 0 && (
        <div className="space-y-6">
          <Section title="In Progress" items={inProgress} />
          <Section title="Not Started" items={notStarted} />
          <Section title="Completed"   items={finished} />
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Live data from Sofascore · Click Predict → to open AI prediction
      </p>
    </div>
  )
}
