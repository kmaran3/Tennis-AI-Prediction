// Compares the AI's win probability against historical market-implied probability.
// This is the unique differentiating feature of this app.
// Props:
//   playerName  — the predicted winner's name
//   aiProb      — float (0 to 1): AI's predicted win probability
//   marketProb  — float or null: avg historical market-implied prob for this winner
export default function OddsComparison({ playerName, aiProb, marketProb }) {
  if (!aiProb) return null

  // How much does the AI differ from the market? Positive = AI more bullish
  const diffPercent = marketProb ? ((aiProb - marketProb) * 100) : null

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="font-semibold text-gray-800 mb-1">AI vs Market Comparison</h3>
      <p className="text-xs text-gray-400 mb-4">
        Market probability is the average historical betting market implied probability
        for {playerName} in past H2H meetings.
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* AI probability */}
        <div className="text-center bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
            AI Prediction
          </p>
          <p className="text-4xl font-bold text-blue-700 mt-2">
            {(aiProb * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">{playerName} wins</p>
        </div>

        {/* Market probability */}
        <div className="text-center bg-purple-50 rounded-xl p-4">
          <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide">
            Historical Market
          </p>
          {marketProb ? (
            <>
              <p className="text-4xl font-bold text-purple-700 mt-2">
                {(marketProb * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-gray-400 mt-1">Avg implied odds</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-6">
              No H2H odds data available
            </p>
          )}
        </div>
      </div>

      {/* Divergence summary */}
      {diffPercent !== null && (
        <div className="mt-4 p-3 bg-gray-50 rounded-xl text-center">
          <p className="text-sm text-gray-600">
            AI is{' '}
            <span className={`font-bold ${diffPercent > 0 ? 'text-blue-600' : 'text-red-500'}`}>
              {Math.abs(diffPercent).toFixed(1)}%{' '}
              {diffPercent > 0 ? 'more confident' : 'less confident'}
            </span>{' '}
            than the historical betting market.
          </p>
        </div>
      )}
    </div>
  )
}
