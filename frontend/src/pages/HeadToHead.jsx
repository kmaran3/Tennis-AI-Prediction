import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import PlayerSearch       from '../components/PlayerSearch'
import SurfaceSelector    from '../components/SurfaceSelector'
import PredictionCard     from '../components/PredictionCard'
import OddsComparison     from '../components/OddsComparison'
import WinRateChart       from '../components/WinRateChart'
import SurfaceRadar       from '../components/SurfaceRadar'
import RecentForm         from '../components/RecentForm'
import { PredictionSkeleton, CardSkeleton } from '../components/Skeleton'
import { predictH2H, getPlayerStats, getRecentForm } from '../api/client'

// Save a prediction to localStorage for the accuracy tracker on Home
function savePrediction(record) {
  try {
    const prev = JSON.parse(localStorage.getItem('atp_predictions') || '[]')
    localStorage.setItem('atp_predictions', JSON.stringify([record, ...prev].slice(0, 100)))
  } catch (_) {}
}

export default function HeadToHead() {
  const [searchParams] = useSearchParams()

  // Pre-populate from URL params (Today page "Predict →" uses these)
  const [playerA, setPlayerA] = useState(searchParams.get('a') || '')
  const [playerB, setPlayerB] = useState(searchParams.get('b') || '')
  const [surface, setSurface] = useState(searchParams.get('surface') || 'Hard')
  const [bestOf,  setBestOf]  = useState(Number(searchParams.get('best_of')) || 3)

  const [prediction, setPrediction] = useState(null)
  const [statsA,     setStatsA]     = useState(null)
  const [statsB,     setStatsB]     = useState(null)
  const [formA,      setFormA]      = useState([])
  const [formB,      setFormB]      = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  // Fetch recent form whenever a player is selected
  useEffect(() => {
    if (!playerA) { setFormA([]); return }
    getRecentForm(playerA).then(r => setFormA(r.data.form || [])).catch(() => {})
  }, [playerA])

  useEffect(() => {
    if (!playerB) { setFormB([]); return }
    getRecentForm(playerB).then(r => setFormB(r.data.form || [])).catch(() => {})
  }, [playerB])

  const handlePredict = async () => {
    if (!playerA || !playerB) { setError('Please select both players.'); return }
    if (playerA === playerB)   { setError('Please select two different players.'); return }

    setLoading(true)
    setError('')
    setPrediction(null)

    try {
      const [predRes, statsARes, statsBRes] = await Promise.all([
        predictH2H({ player_a: playerA, player_b: playerB, surface, best_of: bestOf }),
        getPlayerStats(playerA, surface),
        getPlayerStats(playerB, surface),
      ])

      setPrediction(predRes.data)
      setStatsA(statsARes.data)
      setStatsB(statsBRes.data)

      // Save to accuracy tracker
      savePrediction({
        id: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        player_a: playerA,
        player_b: playerB,
        surface,
        best_of: bestOf,
        predicted_winner: predRes.data.predicted_winner,
        win_probability: predRes.data.win_probability,
        actual_winner: null,
      })
    } catch (e) {
      setError('Prediction failed. Check the backend is running and player names are valid.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Head-to-Head Predictor</h1>

      {/* Input card */}
      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlayerSearch label="Player A" onSelect={setPlayerA} placeholder="Search player A..." initialValue={playerA} />
          <PlayerSearch label="Player B" onSelect={setPlayerB} placeholder="Search player B..." initialValue={playerB} />
        </div>

        <div className="flex flex-wrap gap-8 items-start">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Surface</p>
            <SurfaceSelector value={surface} onChange={setSurface} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Format</p>
            <div className="flex gap-2">
              {[3, 5].map(n => (
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

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <button
          onClick={handlePredict}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed
                     text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-sm
                     w-full sm:w-auto"
        >
          {loading ? '⏳ Predicting...' : '🎾 Predict Match'}
        </button>
      </div>

      {/* Recent form — shown as soon as players are selected */}
      {(formA.length > 0 || formB.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formA.length > 0 && <RecentForm player={playerA} form={formA} />}
          {formB.length > 0 && <RecentForm player={playerB} form={formB} />}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PredictionSkeleton />
          <div className="space-y-6">
            <CardSkeleton lines={3} />
            <CardSkeleton lines={4} />
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && prediction && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PredictionCard
            prediction={prediction}
            playerA={playerA}
            playerB={playerB}
            surface={surface}
            bestOf={bestOf}
          />
          <div className="space-y-6">
            <OddsComparison
              playerName={prediction.predicted_winner}
              aiProb={prediction.win_probability}
              marketProb={prediction.market_implied_prob_winner}
            />
            <SurfaceRadar playerA={playerA} playerB={playerB} statsA={statsA} statsB={statsB} />
            <WinRateChart playerA={playerA} playerB={playerB} statsA={statsA} statsB={statsB} />
          </div>
        </div>
      )}
    </div>
  )
}
