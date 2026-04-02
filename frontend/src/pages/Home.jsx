// Link from react-router-dom gives us navigation without page reloads
import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="text-center py-16 space-y-10">

      {/* Hero section */}
      <div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight">
          🎾 ATP Match Predictor
        </h1>
        <p className="text-lg text-gray-500 mt-4 max-w-2xl mx-auto leading-relaxed">
          AI-powered tennis predictions backed by real ATP match data (2000–2026).
          Compare AI win probabilities against historical betting market odds.
        </p>
      </div>

      {/* Two CTA cards */}
      <div className="flex gap-6 justify-center flex-wrap">
        <Link
          to="/h2h"
          className="bg-green-500 hover:bg-green-600 text-white rounded-2xl px-8 py-7
                     text-left w-64 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
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
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-2xl px-8 py-7
                     text-left w-64 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          <div className="text-4xl mb-3">🏆</div>
          <h2 className="text-xl font-bold">Tournament Simulator</h2>
          <p className="text-blue-100 text-sm mt-2 leading-snug">
            Build a custom bracket with up to 16 players, pick a surface,
            and simulate the full tournament round by round.
          </p>
        </Link>
      </div>

      {/* Dataset attribution line */}
      <p className="text-sm text-gray-400">
        2000–2026 ATP match data · RAG pipeline · Betting odds analysis
      </p>
    </div>
  )
}
