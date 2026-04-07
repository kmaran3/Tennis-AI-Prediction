// Compares the AI's win probability against historical market-implied probability.
// This is the unique differentiating feature of this app.
// Props:
//   playerName  — the predicted winner's name
//   aiProb      — float (0 to 1): AI's predicted win probability
//   marketProb  — float or null: avg historical market-implied prob for this winner
export default function OddsComparison({ playerName, aiProb }) {
  if (!aiProb) return null

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="font-semibold text-gray-800 mb-4">AI Win Probability</h3>
      <div className="text-center bg-blue-50 rounded-xl p-6">
        <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
          AI Prediction
        </p>
        <p className="text-5xl font-bold text-blue-700 mt-2">
          {(aiProb * 100).toFixed(0)}%
        </p>
        <p className="text-sm text-gray-500 mt-2">{playerName} wins</p>
      </div>
    </div>
  )
}
