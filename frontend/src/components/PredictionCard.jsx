// Displays the full AI prediction result from POST /api/predict/h2h.
// Props:
//   prediction — the response object (predicted_winner, win_probability, etc.)
//   playerA    — name of player A (string)
//   playerB    — name of player B (string)
export default function PredictionCard({ prediction, playerA, playerB }) {
  // Don't render anything if no prediction has been made yet
  if (!prediction) return null

  const {
    predicted_winner, win_probability, confidence,
    key_factors, narrative, predicted_score, upset_potential
  } = prediction

  // Color-code confidence and upset badges
  const confidenceBadge = {
    high:   'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low:    'bg-red-100 text-red-800',
  }[confidence] || 'bg-gray-100 text-gray-700'

  const upsetBadge = {
    low:    'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high:   'bg-red-100 text-red-800',
  }[upset_potential] || 'bg-gray-100 text-gray-700'

  // Calculate the bar width for each player
  // If playerA is the predicted winner, bar fills to win_probability from the left
  const barWidthA = predicted_winner === playerA
    ? win_probability * 100
    : (1 - win_probability) * 100

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">

      {/* Winner header */}
      <div className="text-center border-b pb-4">
        <p className="text-xs text-gray-400 uppercase tracking-widest">Predicted Winner</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{predicted_winner}</p>
        <p className="text-sm text-gray-400 mt-1">Predicted score: {predicted_score}</p>
      </div>

      {/* Win probability bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span className="font-medium">{playerA}</span>
          <span className="font-medium">{playerB}</span>
        </div>
        <div className="w-full h-5 bg-gray-100 rounded-full overflow-hidden flex">
          {/* Player A's portion of the bar */}
          <div
            className="h-full bg-blue-500 transition-all duration-700 ease-out"
            style={{ width: `${barWidthA}%` }}
          />
          {/* Player B's portion fills the rest */}
          <div className="h-full bg-purple-500 flex-1" />
        </div>
        <div className="flex justify-between text-xs mt-1 font-semibold">
          <span className="text-blue-600">{barWidthA.toFixed(0)}%</span>
          <span className="text-purple-600">{(100 - barWidthA).toFixed(0)}%</span>
        </div>
      </div>

      {/* Confidence and upset badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${confidenceBadge}`}>
          Confidence: {confidence}
        </span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${upsetBadge}`}>
          Upset potential: {upset_potential}
        </span>
      </div>

      {/* Key factors list */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Key Factors</p>
        <ul className="space-y-1.5">
          {(key_factors || []).map((f, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-600">
              <span className="text-green-500 flex-shrink-0">→</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* AI analyst narrative */}
      <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-green-400">
        <p className="text-sm text-gray-700 leading-relaxed italic">"{narrative}"</p>
      </div>
    </div>
  )
}
