import { useState, useEffect, useRef } from 'react'
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
import { predictH2H, getPlayerStats, getRecentForm, getH2HRecord, getSavedPredictions, postSavedPrediction } from '../api/client'

// Compute accuracy stats from a history array to feed back into the AI prompt
function buildAccuracyContext(history) {
  try {
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

// Read return state from sessionStorage (pure read, no side effects — safe for StrictMode).
// This key is only written when clicking a player profile link from the prediction result.
function readReturnState() {
  try {
    const raw = sessionStorage.getItem('h2h_return')
    if (!raw) return {}
    const s = JSON.parse(raw)
    return s?.prediction ? s : {}
  } catch (_) { return {} }
}

const PREDICT_STAGES = [
  { at: 0,  msg: 'Loading player stats…' },
  { at: 18, msg: 'Analysing head-to-head history…' },
  { at: 38, msg: 'Retrieving match context…' },
  { at: 58, msg: 'Running AI model…' },
  { at: 78, msg: 'Generating prediction…' },
  { at: 92, msg: 'Almost there…' },
]

function PredictProgress({ active }) {
  const [pct, setPct] = useState(0)
  const [stage, setStage] = useState(PREDICT_STAGES[0].msg)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!active) { setPct(0); setStage(PREDICT_STAGES[0].msg); return }
    setPct(0)
    const start = Date.now()
    const DURATION = 22000 // ~22 s simulated fill to 97%
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const raw = Math.min(97, (elapsed / DURATION) * 97)
      setPct(raw)
      const s = [...PREDICT_STAGES].reverse().find(s => raw >= s.at)
      if (s) setStage(s.msg)
    }, 80)
    return () => clearInterval(timerRef.current)
  }, [active])

  if (!active) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{stage}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function HeadToHead() {
  const [searchParams] = useSearchParams()

  // Lazy initializer reads sessionStorage once per mount. It's pure (no removal)
  // so StrictMode's double-invoke produces the same result both times.
  const [_init] = useState(readReturnState)

  // Clear the return state after mount so direct /h2h navigation stays blank.
  useEffect(() => { sessionStorage.removeItem('h2h_return') }, [])

  // URL params (from Today page) take priority over saved names/surface
  const [playerA,    setPlayerA]    = useState(searchParams.get('a')          || _init.playerA    || '')
  const [playerB,    setPlayerB]    = useState(searchParams.get('b')          || _init.playerB    || '')
  const [surface,    setSurface]    = useState(searchParams.get('surface')    || _init.surface    || 'Hard')
  const [bestOf,     setBestOf]     = useState(Number(searchParams.get('best_of')) || _init.bestOf || 3)
  const [tournament, setTournament] = useState(searchParams.get('tournament') || _init.tournament || '')
  const [round,      setRound]      = useState(searchParams.get('round')      || _init.round      || '')

  // Prediction/stats — only restored when coming back from a player profile
  const [prediction, setPrediction] = useState(_init.prediction || null)
  const [statsA,     setStatsA]     = useState(_init.statsA || null)
  const [statsB,     setStatsB]     = useState(_init.statsB || null)
  const [formA,      setFormA]      = useState([])
  const [formB,      setFormB]      = useState([])
  const [h2hRecord,  setH2hRecord]  = useState(null)
  const [h2hOpen,    setH2hOpen]    = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [saved,      setSaved]      = useState(false)
  const [history,    setHistory]    = useState([])
  const { user } = useAuth()

  // Fetch saved predictions for accuracy context, and check if restored prediction was already saved
  useEffect(() => {
    if (!user) return
    getSavedPredictions().then(r => {
      setHistory(r.data)
      // If we restored a prediction from the profile-back navigation, mark it saved
      // if a matching entry already exists in history
      if (_init.prediction) {
        const match = r.data.some(h =>
          ((h.player_a === _init.playerA && h.player_b === _init.playerB) ||
           (h.player_a === _init.playerB && h.player_b === _init.playerA)) &&
          h.surface === _init.surface
        )
        if (match) setSaved(true)
      }
    }).catch(() => {})
  }, [user])

  // Called when the user clicks a player profile link while a prediction is visible.
  // Saves current state so it can be restored when they navigate back.
  const saveStateForProfile = () => {
    if (!prediction) return
    try {
      sessionStorage.setItem('h2h_return', JSON.stringify({
        playerA, playerB, surface, bestOf, tournament, round, prediction, statsA, statsB,
      }))
    } catch (_) {}
  }

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
        predictH2H({ player_a: playerA, player_b: playerB, surface, best_of: bestOf, accuracy_context: buildAccuracyContext(history) }),
        getPlayerStats(playerA, surface),
        getPlayerStats(playerB, surface),
      ])

      setPrediction(predRes.data)
      setStatsA(statsARes.data)
      setStatsB(statsBRes.data)
      // Mark as already saved if this matchup+surface exists in history
      const alreadySaved = history.some(h =>
        ((h.player_a === playerA && h.player_b === playerB) ||
         (h.player_a === playerB && h.player_b === playerA)) &&
        h.surface === surface
      )
      setSaved(alreadySaved)
    } catch (e) {
      setError('Prediction failed. Check the backend is running and player names are valid.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!prediction || saved) return
    const record = {
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
    }
    try {
      await postSavedPrediction(record)
      setSaved(true)
    } catch (e) {
      console.error('Failed to save prediction', e)
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Head-to-Head Predictor</h1>

      {/* Input card */}
      <div className="bg-white rounded-2xl shadow p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <PlayerSearch label="Player A" onSelect={setPlayerA} placeholder="Search player A..." initialValue={playerA} />
            {playerA && (
              <Link to={`/players?name=${encodeURIComponent(playerA)}`} onClick={saveStateForProfile} className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                View {playerA}'s profile →
              </Link>
            )}
          </div>
          <div>
            <PlayerSearch label="Player B" onSelect={setPlayerB} placeholder="Search player B..." initialValue={playerB} />
            {playerB && (
              <Link to={`/players?name=${encodeURIComponent(playerB)}`} onClick={saveStateForProfile} className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                View {playerB}'s profile →
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-6 items-start">
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
                  Bo{n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* H2H record strip */}
        {playerA && playerB && (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setH2hOpen(o => !o)}
              className="w-full flex items-center gap-2 bg-gray-50 hover:bg-gray-100 transition-colors px-4 py-3"
            >
              <span className="text-xs sm:text-sm font-semibold text-gray-700 flex-1 text-right truncate min-w-0">{playerA}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-lg sm:text-xl font-bold text-gray-900">
                  {h2hRecord ? h2hRecord.player_a_wins : '–'}
                </span>
                <span className="text-xs text-gray-400 font-medium">H2H</span>
                <span className="text-lg sm:text-xl font-bold text-gray-900">
                  {h2hRecord ? h2hRecord.player_b_wins : '–'}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-700 flex-1 truncate min-w-0">{playerB}</span>
              <span className="text-gray-400 text-xs ml-1 flex-shrink-0">{h2hOpen ? '▲' : '▼'}</span>
            </button>

            {h2hOpen && (
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {!h2hRecord || h2hRecord.matches === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No prior meetings in dataset</p>
                ) : (
                  h2hRecord.matches_detail.map((m, i) => {
                    const winnerIsA = m.winner === playerA ||
                      m.winner.toLowerCase().includes(playerA.split(' ').slice(-1)[0].toLowerCase())
                    return (
                      <div key={i} className="flex items-center gap-2 px-3 py-2.5 text-xs">
                        <span className="text-gray-400 flex-shrink-0 w-16">{m.date?.slice(0, 7)}</span>
                        <span className="flex-1 text-gray-700 truncate min-w-0">{m.tournament}</span>
                        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded font-medium ${
                          m.surface === 'Clay'  ? 'bg-orange-100 text-orange-700' :
                          m.surface === 'Grass' ? 'bg-green-100 text-green-700'  :
                                                  'bg-blue-100 text-blue-700'
                        }`}>{m.surface[0]}</span>
                        <span className={`font-semibold flex-shrink-0 ${winnerIsA ? 'text-blue-600' : 'text-orange-600'}`}>
                          {m.winner.split(' ').slice(-1)[0]}
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

        <div className="space-y-3">
          <PredictProgress active={loading} />
          <button
            onClick={handlePredict}
            disabled={loading}
            className="bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                       text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-sm
                       w-full sm:w-auto"
          >
            {loading ? 'Predicting…' : '🎾 Predict Match'}
          </button>
        </div>
      </div>

      {/* Recent form — shown as soon as players are selected */}
      {(formA.length > 0 || formB.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {formA.length > 0 && <RecentForm player={playerA} form={formA} />}
          {formB.length > 0 && <RecentForm player={playerB} form={formB} />}
        </div>
      )}

      {/* Results */}
      {!loading && prediction && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <PredictionCard
            prediction={prediction}
            playerA={playerA}
            playerB={playerB}
            surface={surface}
            bestOf={bestOf}
            onSave={handleSave}
            saved={saved}
            onProfileClick={saveStateForProfile}
          />
          <div className="space-y-4 sm:space-y-6">
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
