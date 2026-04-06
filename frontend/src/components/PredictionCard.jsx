import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function PredictionCard({ prediction, playerA, playerB, surface, bestOf }) {
  const [copied, setCopied] = useState(false)

  if (!prediction) return null

  const {
    predicted_winner, win_probability, confidence,
    key_factors, narrative, predicted_score, upset_potential,
  } = prediction

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

  const barWidthA = predicted_winner === playerA
    ? win_probability * 100
    : (1 - win_probability) * 100

  const handleShare = async () => {
    const params = new URLSearchParams({
      a: playerA,
      b: playerB,
      ...(surface ? { surface } : {}),
      ...(bestOf  ? { best_of: bestOf } : {}),
    })
    const url = `${window.location.origin}/h2h?${params}`
    try {
      if (navigator.share) {
        await navigator.share({ title: `${playerA} vs ${playerB} — ATP Predictor`, url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (_) {}
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">

      {/* Winner header */}
      <div className="text-center border-b pb-4">
        <p className="text-xs text-gray-400 uppercase tracking-widest">Predicted Winner</p>
        <Link
          to={`/players?name=${encodeURIComponent(predicted_winner)}`}
          className="text-3xl font-bold text-gray-900 mt-1 hover:text-blue-600 transition-colors block"
        >
          {predicted_winner}
        </Link>
        <p className="text-sm text-gray-400 mt-1">Predicted score: {predicted_score}</p>
      </div>

      {/* Win probability bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <Link to={`/players?name=${encodeURIComponent(playerA)}`} className="font-medium hover:text-blue-500">
            {playerA}
          </Link>
          <Link to={`/players?name=${encodeURIComponent(playerB)}`} className="font-medium hover:text-blue-500">
            {playerB}
          </Link>
        </div>
        <div className="w-full h-5 bg-gray-100 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-blue-500 transition-all duration-700 ease-out"
            style={{ width: `${barWidthA}%` }}
          />
          <div className="h-full bg-purple-500 flex-1" />
        </div>
        <div className="flex justify-between text-xs mt-1 font-semibold">
          <span className="text-blue-600">{barWidthA.toFixed(0)}%</span>
          <span className="text-purple-600">{(100 - barWidthA).toFixed(0)}%</span>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${confidenceBadge}`}>
          Confidence: {confidence}
        </span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${upsetBadge}`}>
          Upset potential: {upset_potential}
        </span>
      </div>

      {/* Key factors */}
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

      {/* Narrative */}
      <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-green-400">
        <p className="text-sm text-gray-700 leading-relaxed italic">"{narrative}"</p>
      </div>

      {/* Share + profile links */}
      <div className="flex flex-wrap gap-2 pt-1 border-t">
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800
                     border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
        >
          {copied ? '✓ Copied!' : '🔗 Share'}
        </button>
        <Link
          to={`/players?name=${encodeURIComponent(playerA)}`}
          className="text-xs text-blue-500 hover:underline border border-gray-200 rounded-lg px-3 py-1.5"
        >
          {playerA} profile
        </Link>
        <Link
          to={`/players?name=${encodeURIComponent(playerB)}`}
          className="text-xs text-blue-500 hover:underline border border-gray-200 rounded-lg px-3 py-1.5"
        >
          {playerB} profile
        </Link>
      </div>
    </div>
  )
}
