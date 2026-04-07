import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getUpcomingMatches } from '../api/client'
import { Skeleton } from '../components/Skeleton'
import { useAuth } from '../context/AuthContext'

const STATUS_ORDER = { notstarted: 0, inprogress: 1, finished: 2 }
const GRAND_SLAMS  = ['australian open', 'french open', 'roland garros', 'wimbledon', 'us open']

function isGrandSlam(tournament) {
  return GRAND_SLAMS.some(gs => (tournament || '').toLowerCase().includes(gs))
}

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

function ScoreDisplay({ match, winner }) {
  if (!match.score) return null
  const liveGame = match.score.match(/\(([^)]+)\)/)
  const setsStr  = match.score.replace(/\s*\([^)]+\)/, '').trim()
  const sets     = setsStr.split(',').map(s => s.trim())
  // Flip set scores to always show from winner's perspective
  const displaySets = winner === 'b'
    ? sets.map(s => { const [h, a] = s.split('-'); return `${a}-${h}` })
    : sets
  return (
    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
      <div className="flex items-center gap-2 text-sm font-mono font-bold text-gray-900">
        {displaySets.map((set, i) => (
          <span key={i}>{set}</span>
        ))}
      </div>
      {liveGame && <span className="text-xs text-green-600 font-mono">{liveGame[1]}</span>}
    </div>
  )
}

export default function Today() {
  const [days,        setDays]        = useState([])
  const [selectedDay, setSelectedDay] = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    getUpcomingMatches(7)
      .then(res => {
        // Flatten all matches from every backend day
        const all = (res.data.days || []).flatMap(d => d.matches)

        // Re-group by the user's LOCAL date using the Unix start_timestamp
        const byDate = {}
        const now = new Date()
        const todayStr = now.toLocaleDateString('en-CA') // YYYY-MM-DD local

        all.forEach(m => {
          const ts  = m.start_timestamp
          const key = ts
            ? new Date(ts * 1000).toLocaleDateString('en-CA')
            : todayStr  // fallback if no timestamp
          if (!byDate[key]) byDate[key] = []
          byDate[key].push(m)
        })

        // Build sorted day objects with Today/Tomorrow labels
        const sorted = Object.keys(byDate).sort().map(dateStr => {
          const d   = new Date(dateStr + 'T12:00:00') // noon avoids DST edge cases
          const today = new Date(todayStr + 'T12:00:00')
          const diffDays = Math.round((d - today) / 86400000)
          let label
          if (diffDays === 0)      label = 'Today'
          else if (diffDays === 1) label = 'Tomorrow'
          else                     label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

          return { date: dateStr, label, matches: sortMatches(byDate[dateStr]) }
        }).filter(d => d.matches.length > 0)

        setDays(sorted)
        const todayIndex = sorted.findIndex(d => d.label === 'Today')
        if (todayIndex !== -1) setSelectedDay(todayIndex)
      })
      .catch(() => setError('Could not reach backend.'))
      .finally(() => setLoading(false))
  }, [])

  const handlePredict = (match) => {
    const bestOf = isGrandSlam(match.tournament) ? 5 : 3
    navigate(
      `/h2h?a=${encodeURIComponent(match.player_a)}` +
      `&b=${encodeURIComponent(match.player_b)}` +
      `&surface=${match.surface || 'Hard'}` +
      `&best_of=${bestOf}` +
      `&tournament=${encodeURIComponent(match.tournament || '')}` +
      `&round=${encodeURIComponent(match.round || '')}`
    )
  }

  const currentDay = days[selectedDay] || null
  const matches    = currentDay?.matches || []
  const inProgress = matches.filter(m => m.status_type === 'inprogress')
  const notStarted = matches.filter(m => m.status_type === 'notstarted')
  const finished   = matches.filter(m => m.status_type === 'finished')

  // Returns 'a' if player_a won, 'b' if player_b won, null if unknown
  const getWinner = (match) => {
    if (match.status_type !== 'finished' || !match.score) return null
    const setsStr = match.score.replace(/\s*\([^)]+\)/, '').trim()
    const sets = setsStr.split(',').map(s => s.trim())
    let winsA = 0, winsB = 0
    sets.forEach(set => {
      const [h, a] = set.split('-').map(Number)
      if (!isNaN(h) && !isNaN(a)) { if (h > a) winsA++; else winsB++ }
    })
    if (winsA === winsB) return null
    return winsA > winsB ? 'a' : 'b'
  }

  const surfaceClass = (surface) =>
    surface === 'Clay'  ? 'bg-orange-100 text-orange-700' :
    surface === 'Grass' ? 'bg-green-100 text-green-700'   :
                          'bg-blue-100 text-blue-700'

  const MatchCard = ({ match, showTournament = false }) => {
    const winner = getWinner(match)
    const aWon = winner === 'a'
    const bWon = winner === 'b'
    return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4
                    flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {(() => {
            const first  = bWon ? match.player_b : match.player_a
            const second = bWon ? match.player_a : match.player_b
            const firstWon  = winner !== null
            const secondWon = false
            return <>
              <p className={`font-semibold text-sm ${firstWon ? 'text-gray-900' : 'text-gray-900'}`}>
                {first}
                {firstWon && <span className="ml-1 text-green-500 text-xs font-bold">✓</span>}
              </p>
              <span className="text-gray-400 text-xs">{winner ? 'def.' : 'vs'}</span>
              <p className={`font-semibold text-sm ${winner ? 'text-gray-400' : 'text-gray-900'}`}>
                {second}
              </p>
            </>
          })()}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {showTournament && match.tournament && (
            <p className="text-xs text-gray-400 truncate">{match.tournament}</p>
          )}
          {match.start_timestamp && match.status_type === 'notstarted' && (
            <span className="text-xs text-gray-400 flex-shrink-0">
              {new Date(match.start_timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {match.round && (
            <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
              {match.round}
            </span>
          )}
          {match.surface && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${surfaceClass(match.surface)}`}>
              {match.surface}
            </span>
          )}
        </div>
      </div>

      {match.score && <ScoreDisplay match={match} winner={winner} />}
      <StatusBadge status_type={match.status_type} status={match.status} />

      {user ? (
        <button
          onClick={() => handlePredict(match)}
          className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold
                     px-4 py-2 rounded-xl transition-all flex-shrink-0"
        >
          Predict →
        </button>
      ) : (
        <Link
          to="/login"
          className="text-xs text-gray-400 border border-gray-200 px-4 py-2 rounded-xl flex-shrink-0 flex items-center gap-1"
        >
          🔒 Predict
        </Link>
      )}
    </div>
  )
  }

  // Group matches by tournament, preserving status sort order within each group
  const groupByTournament = (items) => {
    const groups = {}
    items.forEach(m => {
      const key = m.tournament || 'ATP Tour'
      if (!groups[key]) groups[key] = { surface: m.surface, matches: [] }
      groups[key].matches.push(m)
    })
    return groups
  }

  const Section = ({ title, items }) => {
    if (items.length === 0) return null
    const groups = groupByTournament(items)
    return (
      <div className="space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
          {title} ({items.length})
        </p>
        {Object.entries(groups).map(([tournament, { surface, matches }]) => (
          <div key={tournament} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs font-semibold text-gray-700">{tournament}</span>
              {surface && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${surfaceClass(surface)}`}>
                  {surface}
                </span>
              )}
            </div>
            {matches.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Match Center</h1>
        <p className="text-sm text-gray-400 mt-1">Next 7 days · ATP Tour</p>
      </div>

      {error && <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-2">{error}</p>}

      {loading && (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      )}

      {!loading && days.length > 0 && (
        <>
          {/* Day tabs */}
          <div className="flex gap-2 flex-wrap">
            {days.map((day, i) => (
              <button
                key={day.date}
                onClick={() => setSelectedDay(i)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  selectedDay === i
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {day.label}
                <span className="ml-1.5 text-xs opacity-60">({day.matches.length})</span>
              </button>
            ))}
          </div>

          {/* Tournament summary strip */}
          {(() => {
            const tourns = [...new Map(matches.map(m => [m.tournament, m.surface])).entries()]
            return tourns.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {tourns.map(([t, s]) => (
                  <span key={t} className={`text-xs font-medium px-3 py-1 rounded-full ${surfaceClass(s)}`}>
                    {t}
                  </span>
                ))}
              </div>
            ) : null
          })()}

          {/* Matches for selected day */}
          <div className="space-y-6">
            <Section title="In Progress" items={inProgress} />
            <Section title="Not Started"  items={notStarted} />
            <Section title="Completed"    items={finished} />
          </div>
        </>
      )}

      {!loading && days.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎾</p>
          <p className="font-medium">No ATP matches found for the next 7 days.</p>
          <p className="text-sm mt-1">Check back during tournament weeks.</p>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Live data from Sofascore · Click Predict → to open AI prediction
      </p>
    </div>
  )
}
