import { useState } from 'react'
import PlayerSearch      from '../components/PlayerSearch'
import SurfaceSelector   from '../components/SurfaceSelector'
import TournamentBracket from '../components/TournamentBracket'
import { simulateTournament } from '../api/client'

// Supported bracket sizes. Must be powers of 2.
const DRAW_SIZES = [4, 8, 16]

export default function Tournament() {
  // User input state
  const [draw,     setDraw]     = useState([])       // Array of player names in bracket order
  const [surface,  setSurface]  = useState('Hard')
  const [bestOf,   setBestOf]   = useState(3)
  const [drawSize, setDrawSize] = useState(8)        // How many players in the bracket
  const [useMock,  setUseMock]  = useState(false)    // Mock mode skips LLM calls

  // API result state
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleAddPlayer = (name) => {
    if (draw.includes(name)) return           // Prevent duplicates
    if (draw.length >= drawSize) return        // Prevent exceeding draw size
    setDraw([...draw, name])                  // Spread creates a new array (React needs new refs)
  }

  const handleRemovePlayer = (name) => {
    setDraw(draw.filter((p) => p !== name))   // Filter returns array without the removed name
  }

  const handleChangeDrawSize = (size) => {
    setDrawSize(size)
    setDraw([])     // Reset draw when size changes
    setResult(null)
  }

  const handleSimulate = async () => {
    if (draw.length !== drawSize) {
      setError(`Please add exactly ${drawSize} players to the draw.`)
      return
    }
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const res = await simulateTournament({
        draw,
        surface,
        best_of: bestOf,
        mock: useMock,
      })
      setResult(res.data)
    } catch (e) {
      setError('Simulation failed. Check that the backend is running.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Tournament Simulator</h1>

      {/* Configuration card */}
      <div className="bg-white rounded-2xl shadow p-6 space-y-6">

        {/* Draw size, surface, best-of options */}
        <div className="flex flex-wrap gap-8 items-start">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Draw Size</p>
            <div className="flex gap-2">
              {DRAW_SIZES.map((n) => (
                <button
                  key={n}
                  onClick={() => handleChangeDrawSize(n)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    drawSize === n
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-300 text-gray-600 hover:border-gray-500'
                  }`}
                >
                  {n} players
                </button>
              ))}
            </div>
          </div>

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

        {/* Mock mode toggle — saves API costs while testing UI */}
        <label className="flex items-center gap-3 cursor-pointer w-fit">
          <div className="relative">
            <input
              type="checkbox"
              checked={useMock}
              onChange={(e) => setUseMock(e.target.checked)}
              className="sr-only"  // Visually hidden, but accessible
            />
            {/* Custom toggle appearance */}
            <div className={`w-10 h-6 rounded-full transition-colors ${
              useMock ? 'bg-blue-500' : 'bg-gray-200'
            }`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow mt-1 transition-transform ${
                useMock ? 'translate-x-5' : 'translate-x-1'
              }`} />
            </div>
          </div>
          <span className="text-sm text-gray-600">
            Mock mode{' '}
            <span className="text-gray-400">(skips AI calls — use while testing layout)</span>
          </span>
        </label>

        {/* Player search to add players to the draw */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Build Your Draw ({draw.length} / {drawSize} players)
          </p>
          <PlayerSearch
            onSelect={handleAddPlayer}
            placeholder="Search and add a player..."
          />
        </div>

        {/* Current draw — chips with remove button */}
        {draw.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {draw.map((name, index) => (
              <div
                key={name}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200
                           rounded-full pl-3 pr-2 py-1.5 text-sm transition-colors"
              >
                {/* Seed number */}
                <span className="text-gray-400 text-xs font-mono">#{index + 1}</span>
                <span className="font-medium text-gray-800">{name}</span>
                {/* Remove button */}
                <button
                  onClick={() => handleRemovePlayer(name)}
                  className="text-gray-400 hover:text-red-500 ml-1 text-base leading-none"
                  title="Remove player"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Cost warning for large real brackets */}
        {!useMock && drawSize > 4 && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            ⚠️ A {drawSize}-player bracket will make {drawSize - 1} AI API calls.
            Enable mock mode to test the UI without using API credits.
          </p>
        )}

        {/* Simulate button */}
        <button
          onClick={handleSimulate}
          disabled={loading || draw.length !== drawSize}
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                     text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-sm"
        >
          {loading ? '⏳ Simulating...' : `🏆 Simulate ${drawSize}-Player Tournament`}
        </button>
      </div>

      {/* Bracket display */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="font-semibold text-gray-800 mb-4">
          Bracket {result?.champion ? `— Champion: ${result.champion}` : ''}
        </h2>
        <TournamentBracket
          rounds={result?.rounds}
          champion={result?.champion}
          isLoading={loading}
        />
      </div>
    </div>
  )
}
