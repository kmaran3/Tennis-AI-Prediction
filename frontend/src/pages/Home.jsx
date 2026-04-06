import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ── Accuracy Tracker ────────────────────────────────────────────────────────
function AccuracyTracker() {
  const [history, setHistory] = useState([])
  const [editing, setEditing] = useState(null)  // id of the record being edited

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem('atp_predictions') || '[]'))
    } catch (_) {}
  }, [])

  const setActual = (id, winner) => {
    const updated = history.map(r => r.id === id ? { ...r, actual_winner: winner } : r)
    setHistory(updated)
    localStorage.setItem('atp_predictions', JSON.stringify(updated))
    setEditing(null)
  }

  const clearHistory = () => {
    if (window.confirm('Clear all prediction history?')) {
      setHistory([])
      localStorage.removeItem('atp_predictions')
    }
  }

  if (history.length === 0) return null

  const scored = history.filter(r => r.actual_winner)
  const correct = scored.filter(r => r.actual_winner === r.predicted_winner).length
  const accuracy = scored.length > 0 ? Math.round((correct / scored.length) * 100) : null

  return (
    <div className="bg-white rounded-2xl shadow p-6 space-y-4 text-left">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Prediction History</h2>
        <button onClick={clearHistory} className="text-xs text-gray-400 hover:text-red-500">
          Clear
        </button>
      </div>

      {/* Accuracy stats */}
      <div className="flex gap-4 flex-wrap">
        <div className="bg-blue-50 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{history.length}</p>
          <p className="text-xs text-blue-500">Total predictions</p>
        </div>
        <div className="bg-green-50 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-green-700">{scored.length}</p>
          <p className="text-xs text-green-500">Results recorded</p>
        </div>
        {accuracy !== null && (
          <div className="bg-purple-50 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-purple-700">{accuracy}%</p>
            <p className="text-xs text-purple-500">AI accuracy</p>
          </div>
        )}
      </div>

      {/* Recent predictions */}
      <div className="space-y-2">
        {history.slice(0, 5).map(r => (
          <div key={r.id} className="flex items-center gap-3 text-sm py-2 border-b last:border-0">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">
                {r.predicted_winner}
                <span className="text-gray-400 font-normal"> won vs </span>
                {r.player_a === r.predicted_winner ? r.player_b : r.player_a}
              </p>
              <p className="text-xs text-gray-400">{r.surface} · {r.date}</p>
            </div>

            {r.actual_winner ? (
              // Show result
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                r.actual_winner === r.predicted_winner
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {r.actual_winner === r.predicted_winner ? '✓ Correct' : '✗ Wrong'}
              </span>
            ) : editing === r.id ? (
              // Enter actual winner
              <div className="flex gap-1 flex-shrink-0">
                {[r.player_a, r.player_b].map(p => (
                  <button
                    key={p}
                    onClick={() => setActual(r.id, p)}
                    className="text-xs bg-gray-800 text-white px-2 py-0.5 rounded-full truncate max-w-[80px]"
                  >
                    {p.split(' ').slice(-1)[0]}
                  </button>
                ))}
                <button onClick={() => setEditing(null)} className="text-xs text-gray-400">✕</button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(r.id)}
                className="text-xs text-blue-500 hover:underline flex-shrink-0"
              >
                Record result
              </button>
            )}
          </div>
        ))}
      </div>

      {accuracy === null && scored.length === 0 && (
        <p className="text-xs text-gray-400">
          Click "Record result" on any prediction to track AI accuracy.
        </p>
      )}
    </div>
  )
}

// ── Home page ───────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="space-y-10 py-8">

      {/* Hero */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
          🎾 ATP Match Predictor
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          AI-powered tennis predictions backed by real ATP match data (2000–2026).
          Compare AI win probabilities against historical betting market odds.
        </p>
      </div>

      {/* CTA cards */}
      <div className="flex gap-4 justify-center flex-wrap">
        <Link
          to="/today"
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl px-7 py-6
                     text-left w-60 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          <div className="text-4xl mb-3">📅</div>
          <h2 className="text-xl font-bold">Today's Matches</h2>
          <p className="text-emerald-100 text-sm mt-2 leading-snug">
            Live ATP schedule — click any match to instantly run an AI prediction.
          </p>
        </Link>

        <Link
          to="/h2h"
          className="bg-green-500 hover:bg-green-600 text-white rounded-2xl px-7 py-6
                     text-left w-60 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          <div className="text-4xl mb-3">⚔️</div>
          <h2 className="text-xl font-bold">Head-to-Head</h2>
          <p className="text-green-100 text-sm mt-2 leading-snug">
            Pick two players and a surface. Get an AI prediction with key factors,
            win probability, and betting market comparison.
          </p>
        </Link>

        <Link
          to="/tournament"
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-2xl px-7 py-6
                     text-left w-60 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          <div className="text-4xl mb-3">🏆</div>
          <h2 className="text-xl font-bold">Tournament</h2>
          <p className="text-blue-100 text-sm mt-2 leading-snug">
            Upload a draw image or search by tournament name. Simulate the full bracket
            round by round with AI predictions.
          </p>
        </Link>
      </div>

      {/* Accuracy tracker — only shows once predictions have been made */}
      <AccuracyTracker />

      <p className="text-sm text-gray-400 text-center">
        2000–2026 ATP match data · RAG pipeline · Claude AI · Betting odds analysis
      </p>
    </div>
  )
}
