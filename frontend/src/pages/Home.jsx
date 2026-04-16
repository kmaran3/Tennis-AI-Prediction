import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMatchResult, getSavedPredictions, putSavedPrediction, deleteSavedPrediction, clearSavedPredictions } from '../api/client'
import { useAuth } from '../context/AuthContext'

// ── Accuracy Tracker ────────────────────────────────────────────────────────
function AccuracyTracker() {
  const [history, setHistory] = useState([])
  const [showAll, setShowAll] = useState(false)
  const navigate = useNavigate()

  const settlingRef = useRef(false)

  useEffect(() => {
    settlingRef.current = false
    let current

    getSavedPredictions()
      .then(res => {
        current = res.data
        setHistory(current)

        // Auto-settle unsettled predictions
        if (settlingRef.current) return
        settlingRef.current = true
        const unsettled = current.filter(r => !r.actual_winner)
        if (unsettled.length === 0) return

        unsettled.forEach(async (r) => {
          try {
            const res = await getMatchResult(r.player_a, r.player_b, r.date)
            if (res.data.found && res.data.winner) {
              await putSavedPrediction(r.id, { actual_winner: res.data.winner, actual_score: res.data.score || null })
              setHistory(prev => prev.map(x =>
                x.id === r.id ? { ...x, actual_winner: res.data.winner } : x
              ))
            }
          } catch (_) {}
        })
      })
      .catch(() => {})
  }, [])

  const deleteOne = async (id) => {
    try {
      await deleteSavedPrediction(id)
      setHistory(prev => prev.filter(r => r.id !== id))
    } catch (_) {}
  }

  const clearHistory = async () => {
    if (window.confirm('Clear all prediction history?')) {
      try {
        await clearSavedPredictions()
        setHistory([])
      } catch (_) {}
    }
  }

  const openPrediction = (r) => {
    if (!r.prediction) return
    sessionStorage.setItem('h2h_state', JSON.stringify({
      playerA: r.player_a, playerB: r.player_b,
      surface: r.surface,  bestOf: r.best_of,
      tournament: r.tournament || '', round: r.round || '',
      prediction: r.prediction, statsA: r.statsA, statsB: r.statsB,
    }))
    navigate('/h2h')
  }

  if (history.length === 0) return null

  const scored   = history.filter(r => r.actual_winner)
  const correct  = scored.filter(r => r.actual_winner === r.predicted_winner).length
  const accuracy = scored.length > 0 ? Math.round((correct / scored.length) * 100) : null
  const visible  = showAll ? history : history.slice(0, 5)

  return (
    <div className="bg-white rounded-2xl shadow p-6 space-y-4 text-left">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Saved Predictions</h2>
        <button onClick={clearHistory} className="text-xs text-gray-400 hover:text-red-500">
          Clear all
        </button>
      </div>

      {/* Summary stats */}
      <div className="flex gap-4 flex-wrap">
        <div className="bg-blue-50 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{history.length}</p>
          <p className="text-xs text-blue-500">Total</p>
        </div>
        <div className="bg-green-50 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-green-700">{scored.length}</p>
          <p className="text-xs text-green-500">Recorded</p>
        </div>
        {accuracy !== null && (
          <div className="bg-purple-50 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-purple-700">{accuracy}%</p>
            <p className="text-xs text-purple-500">Accuracy</p>
          </div>
        )}
      </div>

      {/* Prediction rows */}
      <div className="space-y-1">
        {visible.map(r => (
          <div key={r.id} className="group rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
            {/* Top row: prediction info + result badge */}
            <div className="flex items-start gap-3 px-4 pt-3 pb-1">
              {/* Clickable text area → restore prediction */}
              <button
                onClick={() => openPrediction(r)}
                disabled={!r.prediction}
                className="flex-1 min-w-0 text-left disabled:cursor-default"
              >
                <p className="font-medium text-gray-800 text-sm truncate">
                  <span className="text-indigo-600">{r.predicted_winner}</span>
                  <span className="text-gray-400 font-normal"> def. </span>
                  {r.player_a === r.predicted_winner ? r.player_b : r.player_a}
                </p>
                <div className="flex flex-col gap-1 mt-1">
                  {/* Scorecards */}
                  {(r.predicted_score || r.actual_score) && (
                    <div className="flex gap-8 flex-wrap">
                      {r.predicted_score && (() => {
                        const winner = r.predicted_winner
                        const loser  = r.player_a === winner ? r.player_b : r.player_a
                        const sets   = r.predicted_score.split(/[\s,]+/).filter(s => s.includes('-'))
                        return (
                          <div>
                            <p className="text-xs font-semibold text-blue-500 mb-1 uppercase tracking-wide">Predicted</p>
                            <table className="text-xs font-mono border-separate" style={{ borderSpacing: '4px 0' }}>
                              <tbody>
                                <tr className="text-gray-800 font-bold">
                                  <td className="font-sans text-xs text-gray-700 pr-2 text-right whitespace-nowrap">{winner.split(' ').pop()}</td>
                                  {sets.map((s, i) => <td key={i} className="text-center w-5">{s.split('-')[0]}</td>)}
                                </tr>
                                <tr className="text-gray-400">
                                  <td className="font-sans text-xs pr-2 text-right whitespace-nowrap">{loser.split(' ').pop()}</td>
                                  {sets.map((s, i) => <td key={i} className="text-center w-5">{s.split('-')[1]}</td>)}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )
                      })()}
                      {r.actual_score && r.actual_winner && (() => {
                        // Always show actual winner on top
                        const actualWinner = r.actual_winner
                        const actualLoser  = r.player_a === actualWinner ? r.player_b : r.player_a
                        const aIsWinner    = r.player_a === actualWinner
                        const winIdx       = aIsWinner ? 0 : 1
                        const loseIdx      = aIsWinner ? 1 : 0
                        const sets = r.actual_score.split(/[\s,]+/).filter(s => s.includes('-'))
                        return (
                          <div>
                            <p className={`text-xs font-semibold mb-1 uppercase tracking-wide ${r.actual_winner === r.predicted_winner ? 'text-emerald-600' : 'text-red-500'}`}>Actual</p>
                            <table className="text-xs font-mono border-separate" style={{ borderSpacing: '4px 0' }}>
                              <tbody>
                                <tr className="text-gray-800 font-bold">
                                  <td className="font-sans text-xs text-gray-700 pr-2 text-right whitespace-nowrap">{actualWinner.split(' ').pop()}</td>
                                  {sets.map((s, i) => <td key={i} className="text-center w-5">{s.split('-')[winIdx]}</td>)}
                                </tr>
                                <tr className="text-gray-400">
                                  <td className="font-sans text-xs pr-2 text-right whitespace-nowrap">{actualLoser.split(' ').pop()}</td>
                                  {sets.map((s, i) => <td key={i} className="text-center w-5">{s.split('-')[loseIdx]}</td>)}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                  {/* Meta row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400">{r.surface}</span>
                    {r.best_of && (
                      <span className="text-xs text-gray-400">Bo{r.best_of}</span>
                    )}
                    {r.tournament && (
                      <span className="text-xs text-gray-400 truncate max-w-[140px]">{r.tournament}</span>
                    )}
                    {r.round && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{r.round}</span>
                    )}
                    <span className="text-xs text-gray-300">{r.date}</span>
                  </div>
                </div>
              </button>

              {/* Result badge — not a button, just a status indicator */}
              {r.actual_winner && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 pointer-events-none ${
                  r.actual_winner === r.predicted_winner
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {r.actual_winner === r.predicted_winner ? '✓' : '✗'}
                </span>
              )}
            </div>

            {/* Action row */}
            <div className="flex items-center gap-3 px-4 pb-2">
              {!r.actual_winner && (
                <span className="text-xs text-gray-400 italic">Checking result…</span>
              )}
              <button
                onClick={() => deleteOne(r.id)}
                className="text-xs text-gray-300 hover:text-red-400 ml-auto transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {history.length > 5 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="text-xs text-blue-500 hover:underline w-full text-center"
        >
          {showAll ? 'Show less' : `Show all ${history.length} predictions`}
        </button>
      )}

      {accuracy === null && scored.length === 0 && (
        <p className="text-xs text-gray-400">
          Results are looked up automatically · Click any row to see full breakdown
        </p>
      )}
    </div>
  )
}

// ── Home page ───────────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth()
  return (
    <div className="space-y-6 sm:space-y-10 py-2 sm:py-6">

      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 leading-tight">
          🎾 ATP Match Predictor
        </h1>
        <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          AI-powered tennis predictions backed by real ATP match data (2000–2026).
          Win probabilities, head-to-head breakdowns, and full tournament simulations.
        </p>
      </div>

      {/* CTA cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-xl mx-auto w-full">
        <Link
          to="/today"
          className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-2xl px-5 py-5 sm:px-7 sm:py-6
                     text-left shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
        >
          <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">📅</div>
          <h2 className="text-lg sm:text-xl font-bold">Match Center</h2>
          <p className="text-emerald-100 text-sm mt-1.5 leading-snug">
            Live ATP schedule — tap any match to instantly run an AI prediction.
          </p>
        </Link>

        <Link
          to="/h2h"
          className="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-2xl px-5 py-5 sm:px-7 sm:py-6
                     text-left shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
        >
          <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">⚔️</div>
          <h2 className="text-lg sm:text-xl font-bold">Head-to-Head</h2>
          <p className="text-green-100 text-sm mt-1.5 leading-snug">
            Pick two players and a surface. Get an AI prediction with win probability and key stats.
          </p>
        </Link>
      </div>

      {user && <AccuracyTracker />}

      <p className="text-sm text-gray-400 text-center">
        2000–2026 ATP match data · RAG pipeline · Claude AI
      </p>
    </div>
  )
}
