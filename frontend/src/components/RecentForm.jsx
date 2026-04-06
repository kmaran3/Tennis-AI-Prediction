// Displays a player's last N matches as a compact W/L list.
// Props: player (string), form (array from /api/players/:name/recent-form)
export default function RecentForm({ player, form, isLoading }) {
  const surfaceColor = {
    Hard:  'bg-blue-400',
    Clay:  'bg-orange-400',
    Grass: 'bg-green-500',
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse space-y-2">
        <div className="h-4 bg-gray-200 rounded w-40" />
        {[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-gray-100 rounded" />)}
      </div>
    )
  }

  if (!form || form.length === 0) return null

  // Build compact W/L streak string for header
  const streak = form.slice(0, 5).map(m => m.won ? 'W' : 'L').join('')

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">{player}</p>
        <div className="flex gap-1">
          {streak.split('').map((r, i) => (
            <span
              key={i}
              className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white ${
                r === 'W' ? 'bg-green-500' : 'bg-red-400'
              }`}
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* Match rows */}
      <div className="space-y-1.5">
        {form.map((match, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {/* W/L badge */}
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
              match.won ? 'bg-green-500' : 'bg-red-400'
            }`}>
              {match.won ? 'W' : 'L'}
            </span>

            {/* Surface dot */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${surfaceColor[match.surface] || 'bg-gray-400'}`} />

            {/* Opponent */}
            <span className="text-gray-700 truncate flex-1 min-w-0">{match.opponent}</span>

            {/* Tournament (truncated) */}
            <span className="text-gray-400 hidden sm:block flex-shrink-0 max-w-[100px] truncate">
              {match.tournament}
            </span>

            {/* Month/year */}
            <span className="text-gray-400 flex-shrink-0">{match.date.slice(0, 7)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
