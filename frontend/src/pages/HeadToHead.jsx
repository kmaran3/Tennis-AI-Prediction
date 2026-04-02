// useState lets us store data inside this component that persists across re-renders.
// When state changes, React re-renders the component with the new values.
import { useState } from 'react'
import PlayerSearch    from '../components/PlayerSearch'
import SurfaceSelector from '../components/SurfaceSelector'
import PredictionCard  from '../components/PredictionCard'
import OddsComparison  from '../components/OddsComparison'
import WinRateChart    from '../components/WinRateChart'
import { predictH2H, getPlayerStats } from '../api/client'

export default function HeadToHead() {
  // User input state
  const [playerA,  setPlayerA]  = useState('')      // Selected player A name
  const [playerB,  setPlayerB]  = useState('')      // Selected player B name
  const [surface,  setSurface]  = useState('Hard')  // Selected surface
  const [bestOf,   setBestOf]   = useState(3)       // 3 or 5 sets

  // API result state
  const [prediction, setPrediction] = useState(null)  // AI prediction response
  const [statsA,     setStatsA]     = useState(null)  // Player A stats
  const [statsB,     setStatsB]     = useState(null)  // Player B stats
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  const handlePredict = async () => {
    // Validate inputs before calling the API
    if (!playerA || !playerB) {
      setError('Please select both players.')
      return
    }
    if (playerA === playerB) {
      setError('Please select two different players.')
      return
    }

    setLoading(true)
    setError('')
    setPrediction(null)

    try {
      // Promise.all runs three API calls simultaneously (faster than sequential)
      const [predRes, statsARes, statsBRes] = await Promise.all([
        predictH2H({ player_a: playerA, player_b: playerB, surface, best_of: bestOf }),
        getPlayerStats(playerA, surface),
        getPlayerStats(playerB, surface),
      ])

      setPrediction(predRes.data)
      setStatsA(statsARes.data)
      setStatsB(statsBRes.data)
    } catch (e) {
      setError('Prediction failed. Check the backend is running and player names are valid.')
      console.error(e)
    } finally {
      // Always runs — clears loading state whether call succeeded or failed
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Head-to-Head Predictor</h1>

      {/* Input card */}
      <div className="bg-white rounded-2xl shadow p-6 space-y-6">

        {/* Player search inputs side by side on wide screens */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlayerSearch
            label="Player A"
            onSelect={setPlayerA}
            placeholder="Search player A..."
          />
          <PlayerSearch
            label="Player B"
            onSelect={setPlayerB}
            placeholder="Search player B..."
          />
        </div>

        {/* Surface and best-of options */}
        <div className="flex flex-wrap gap-8 items-start">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Surface</p>
            <SurfaceSelector value={surface} onChange={setSurface} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Format</p>
            <div className="flex gap-2">
              {[3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setBestOf(n)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    bestOf === n
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-300 text-gray-600 hover:border-gray-500'
                  }`}
                >
                  Best of {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Predict button */}
        <button
          onClick={handlePredict}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed
                     text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-sm"
        >
          {loading ? '⏳ Predicting...' : '🎾 Predict Match'}
        </button>
      </div>

      {/* Results — only render once we have a prediction */}
      {prediction && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: main prediction card */}
          <PredictionCard
            prediction={prediction}
            playerA={playerA}
            playerB={playerB}
          />

          {/* Right column: odds comparison + surface chart */}
          <div className="space-y-6">
            <OddsComparison
              playerName={prediction.predicted_winner}
              aiProb={prediction.win_probability}
              marketProb={prediction.market_implied_prob_winner}
            />
            <WinRateChart
              playerA={playerA}
              playerB={playerB}
              statsA={statsA}
              statsB={statsB}
            />
          </div>
        </div>
      )}
    </div>
  )
}
