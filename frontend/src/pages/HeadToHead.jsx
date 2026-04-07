import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PlayerSearch       from '../components/PlayerSearch'
import SurfaceSelector    from '../components/SurfaceSelector'
import PredictionCard     from '../components/PredictionCard'
import OddsComparison     from '../components/OddsComparison'
import WinRateChart       from '../components/WinRateChart'
import SurfaceRadar       from '../components/SurfaceRadar'
import RecentForm         from '../components/RecentForm'
import { PredictionSkeleton, CardSkeleton } from '../components/Skeleton'
import { predictH2H, getPlayerStats, getRecentForm, getH2HRecord } from '../api/client'

const storageKey = (email) => `atp_predictions_${email}`

// Save a prediction to localStorage for the accuracy tracker on Home
function savePrediction(record, email) {
  try {
    const key = storageKey(email)
    const prev = JSON.parse(localStorage.getItem(key) || '[]')
    localStorage.setItem(key, JSON.stringify([record, ...prev].slice(0, 100)))
  } catch (_) {}
}

// Compute accuracy stats from localStorage to feed back into the AI prompt
function buildAccuracyContext(email) {
  try {
    const history = JSON.parse(localStorage.getItem(storageKey(email)) || '[]')
    const scored = history.filter(r => r.actual_winner)
    if (scored.length < 3) return null
    const correct = scored.filter(r => r.actual_winner === r.predicted_winner).length
    const bySurface = {}
    scored.forEach(r => {
      if (!r.surface) return
      if (!bySurface[r.surface]) bySurface[r.surface] = { correct: 0, total: 0 }
      bySurface[r.surface].total++
      if (r.actual_winner === r.predicted_winner) bySurface[r.surface].correct++
    })
    Object.keys(bySurface).forEach(s => {
      bySurface[s].pct = Math.round(bySurface[s].correct / bySurface[s].total * 100)
    })
    const highConf = scored.filter(r => r.prediction?.confidence === 'high')
    const highConfCorrect = highConf.filter(r => r.actual_winner === r.predicted_winner).length
    return {
      total: scored.length,
      correct,
      overall_pct: Math.round(correct / scored.length * 100),
      by_surface: bySurface,
      high_conf_pct: highConf.length >= 2 ? Math.round(highConfCorrect / highConf.length * 100) : null,
    }
  } catch (_) { return null }
}

// Always read persisted state — URL params override names/surface but never clear the prediction
function loadSaved() {
  try { return JSON.parse(sessionStorage.getItem('h2h_state') || '{}') || {} } catch (_) { return {} }
}

export default function HeadToHead() {
  const [searchParams] = useSearchParams()
  const savedState = loadSaved()

  // URL params (from Today page) take priority over saved names/surface
  const [playerA,    setPlayerA]    = useState(searchParams.get('a')          || savedState.playerA    || '')
  const [playerB,    setPlayerB]    = useState(searchParams.get('b')          || savedState.playerB    || '')
  const [surface,    setSurface]    = useState(searchParams.get('surface')    || savedState.surface    || 'Hard')
  const [bestOf,     setBestOf]     = useState(Number(searchParams.get('best_of')) || savedState.bestOf || 3)
  const [tournament, setTournament] = useState(searchParams.get('tournament') || savedState.tournament || '')
  const [round,      setRound]      = useState(searchParams.get('round')      || savedState.round      || '')

  // Prediction/stats always restored from sessionStorage (independent of how we navigated here)
  const [prediction, setPrediction] = useState(savedState.prediction || null)
  const [statsA,     setStatsA]     = useState(savedState.statsA || null)
  const [statsB,     setStatsB]     = useState(savedState.statsB || null)
  const [formA,      setFormA]      = useState([])
  const [formB,      setFormB]      = useState([])
  const [h2hRecord,  setH2hRecord]  = useState(null)
  const [h2hOpen,    setH2hOpen]    = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [saved,      setSaved]      = useState(false)
  const { user } = useAuth()

  // Persist state whenever it changes so navigating to player profile and back restores everything
  useEffect(() => {
    sessionStorage.setItem('h2h_state', JSON.stringify({
      playerA, playerB, surface, bestOf, tournament, round, prediction, statsA, statsB,
    }))
  }, [playerA, playerB, surface, bestOf, tournament, round, prediction, statsA, statsB])

  // Fetch recent form whenever a player is selected
  useEffect(() => {
    if (!playerA) { setFormA([]); return }
    getRecentForm(playerA).then(r => setFormA(r.data.form || [])).catch(() => {})
  }, [playerA])

  useEffect(() => {
    if (!playerB) { setFormB([]); return }
    getRecentForm(playerB).then(r => setFormB(r.data.form || [])).catch(() => {})
  }, [playerB])

  // Fetch H2H record whenever both players are set
  useEffect(() => {
    if (!playerA || !playerB) { setH2hRecord(null); return }
    getH2HRecord(playerA, playerB)
      .then(r => setH2hRecord(r.data))
      .catch(() => setH2hRecord({ matches: 0, player_a_wins: 0, player_b_wins: 0 }))
  }, [playerA, playerB])

  const handlePredict = async () => {
    if (!playerA || !playerB) { setError('Please select both players.'); return }
    if (playerA === playerB)   { setError('Please select two different players.'); return }

    setLoading(true)
    setError('')
    setPrediction(null)

    try {
      const [predRes, statsARes, statsBRes] = await Promise.all([
        predictH2H({ player_a: playerA, player_b: playerB, surface, best_of: bestOf, accuracy_context: buildAccuracyContext(user?.email) }),
        getPlayerStats(playerA, surface),
        getPlayerStats(playerB, surface),
      ])

      setPrediction(predRes.data)
      setStatsA(statsARes.data)
      setStatsB(statsBRes.data)
      setSaved(false)
    } catch (e) {
      setError('Prediction failed. Check the backend is running and player names are valid.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (!prediction || saved) return
    savePrediction({
      id: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      player_a: playerA,
      player_b: playerB,
      surface,
      best_of: bestOf,
      tournament,
      round,
      predicted_winner: prediction.predicted_winner,
      predicted_score:  prediction.predicted_score,
      win_probability:  prediction.win_probability,
      actual_winner: null,
      prediction,
      statsA,
      statsB,
    })
    savePrediction({
      id: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      player_a: playerA,
      player_b: playerB,
      surface,
      best_of: bestOf,
      tournament,
      round,
      predicted_winner: prediction.predicted_winner,
      predicted_score:  prediction.predicted_score,
      win_probability:  prediction.win_probability,
      actual_winner: null,
      prediction,
      statsA,
      statsB,
    }, user?.email)
    setSaved(true)
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Head-to-Head Predictor</h1>

      {/* Input card */}
      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <PlayerSearch label="Player A" onSelect={setPlayerA} placeholder="Search player A..." initialValue={playerA} />
            {playerA && (
              <Link to={`/players?name=${encodeURIComponent(playerA)}`} className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                View {playerA}'s profile →
              </Link>
            )}
          </div>
          <div>
            <PlayerSearch label="Player B" onSelect={setPlayerB} placeholder="Search player B..." initialValue={playerB} />
            {playerB && (
              <Link to={`/players?name=${encodeURIComponent(playerB)}`} className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                View {playerB}'s profile →
              </Link>
            )}
          </div>
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

        {/* H2H record strip */}
        {playerA && playerB && (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {/* Clickable header */}
            <button
              onClick={() => setH2hOpen(o => !o)}
              className="w-full flex items-center gap-3 bg-gray-50 hover:bg-gray-100 transition-colors px-4 py-3"
            >
              <span className="text-sm font-semibold text-gray-700 flex-1 text-right truncate">{playerA}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xl font-bold text-gray-900">
                  {h2hRecord ? h2hRecord.player_a_wins : '–'}
                </span>
                <span className="text-xs text-gray-400 font-medium">H2H</span>
                <span className="text-xl font-bold text-gray-900">
                  {h2hRecord ? h2hRecord.player_b_wins : '–'}
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{playerB}</span>
              <span className="text-gray-400 text-xs ml-2 flex-shrink-0">{h2hOpen ? '▲' : '▼'}</span>
            </button>

            {/* Expandable match list */}
            {h2hOpen && (
              <div className="divide-y divide-gray-100">
                {!h2hRecord || h2hRecord.matches === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No prior meetings in dataset</p>
                ) : (
                  h2hRecord.matches_detail.map((m, i) => {
                    const winnerIsA = m.winner === playerA ||
                      m.winner.toLowerCase().includes(playerA.split(' ').slice(-1)[0].toLowerCase())
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                        <span className="text-gray-400 w-20 flex-shrink-0">{m.date}</span>
                        <span className="flex-1 text-gray-700 truncate">{m.tournament}</span>
                        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded font-medium ${
                          m.surface === 'Clay'  ? 'bg-orange-100 text-orange-700' :
                          m.surface === 'Grass' ? 'bg-green-100 text-green-700'  :
                                                  'bg-blue-100 text-blue-700'
                        }`}>{m.surface}</span>
                        <span className="text-gray-400 flex-shrink-0 w-16 text-center">{m.round}</span>
                        <span className={`font-semibold flex-shrink-0 w-24 text-right ${winnerIsA ? 'text-blue-600' : 'text-orange-600'}`}>
                          {m.winner.split(' ').slice(-1)[0]} {m.score}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )}

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
            onSave={handleSave}
            saved={saved}
          />
          <div className="space-y-6">
            <OddsComparison
              playerName={prediction.predicted_winner}
              aiProb={prediction.win_probability}
              marketProb={null}
            />
            <SurfaceRadar playerA={playerA} playerB={playerB} statsA={statsA} statsB={statsB} />
            <WinRateChart playerA={playerA} playerB={playerB} statsA={statsA} statsB={statsB} />
          </div>
        </div>
      )}
    </div>
  )
}
