// Recharts components — we import only what we need
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

// Shows a grouped bar chart comparing surface win rates for two players.
// Props:
//   playerA, playerB — player name strings (used as chart labels)
//   statsA, statsB   — stats objects from the API (contain surface_win_rates)
export default function WinRateChart({ playerA, playerB, statsA, statsB }) {
  const surfaces = ['Hard', 'Clay', 'Grass']

  // Recharts needs data as an array of objects.
  // Each object represents one group of bars (one surface).
  const data = surfaces.map((surf) => ({
    surface: surf,
    // Use the win_rate value if it exists, otherwise null (no bar rendered)
    [playerA]: statsA?.surface_win_rates?.[surf]?.win_rate ?? null,
    [playerB]: statsB?.surface_win_rates?.[surf]?.win_rate ?? null,
  }))

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="font-semibold text-gray-800 mb-4">Win Rate by Surface</h3>
      {/* ResponsiveContainer makes the chart fill its parent's width */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="surface" tick={{ fontSize: 12 }} />
          {/* Format Y axis ticks as percentages */}
          <YAxis
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            domain={[0, 1]}
            tick={{ fontSize: 11 }}
          />
          {/* Format tooltip values as percentages */}
          <Tooltip
            formatter={(v) => v !== null ? `${(v * 100).toFixed(1)}%` : 'No data'}
          />
          <Legend />
          <Bar dataKey={playerA} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey={playerB} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
