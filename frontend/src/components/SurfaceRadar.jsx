import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Legend, Tooltip,
} from 'recharts'

// Radar (spider) chart comparing surface win rates for up to two players.
// Props: playerA, playerB (strings), statsA, statsB (stats API responses)
export default function SurfaceRadar({ playerA, playerB, statsA, statsB }) {
  const surfaces = ['Hard', 'Clay', 'Grass']

  const data = surfaces.map(s => ({
    surface: s,
    ...(statsA ? {
      [playerA]: statsA.surface_win_rates?.[s]
        ? Math.round(statsA.surface_win_rates[s].win_rate * 100)
        : 0
    } : {}),
    ...(statsB ? {
      [playerB]: statsB.surface_win_rates?.[s]
        ? Math.round(statsB.surface_win_rates[s].win_rate * 100)
        : 0
    } : {}),
  }))

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="font-semibold text-gray-800 mb-1">Surface Win Rate</h3>
      <p className="text-xs text-gray-400 mb-4">% of matches won on each surface</p>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
          <PolarGrid />
          <PolarAngleAxis dataKey="surface" tick={{ fontSize: 12 }} />
          <Tooltip formatter={v => `${v}%`} />
          {statsA && playerA && (
            <Radar
              name={playerA}
              dataKey={playerA}
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.25}
            />
          )}
          {statsB && playerB && (
            <Radar
              name={playerB}
              dataKey={playerB}
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.25}
            />
          )}
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
