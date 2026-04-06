import { useState, useRef } from 'react'
import PlayerSearch      from '../components/PlayerSearch'
import SurfaceSelector   from '../components/SurfaceSelector'
import TournamentBracket from '../components/TournamentBracket'
import { simulateTournament, parseDraw, fetchDraw } from '../api/client'

const DRAW_SIZES = [4, 8, 16, 32]

// Snap a number to the nearest valid draw size (power of 2 between 4 and 32)
function snapToDrawSize(n) {
  const valid = [4, 8, 16, 32]
  return valid.find(s => s >= n) || 32
}

export default function Tournament() {
  // ── Draw state ──────────────────────────────────────────────────────────
  const [draw,           setDraw]           = useState([])
  const [drawSize,       setDrawSize]       = useState(8)
  const [completedRounds, setCompletedRounds] = useState([])  // pre-populated from image
  const [surface,        setSurface]        = useState('Hard')
  const [bestOf,         setBestOf]         = useState(3)
  const [useMock,        setUseMock]        = useState(false)

  // ── Import section state ────────────────────────────────────────────────
  const [importTab,   setImportTab]   = useState('image')  // 'image' | 'text' | 'search'
  const [pasteText,   setPasteText]   = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceNote,  setSourceNote]  = useState('')
  const [importing,   setImporting]   = useState(false)
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef(null)

  // ── Simulation result state ─────────────────────────────────────────────
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleAddPlayer = (name) => {
    if (draw.includes(name) || draw.length >= drawSize) return
    setDraw([...draw, name])
  }

  const handleRemovePlayer = (name) => {
    setDraw(draw.filter(p => p !== name))
  }

  const handleChangeDrawSize = (size) => {
    setDrawSize(size)
    setDraw([])
    setCompletedRounds([])
    setResult(null)
    setSourceNote('')
  }

  // Parse image or pasted text
  const handleImport = async () => {
    setImportError('')
    setImporting(true)
    try {
      let body = {}
      if (importTab === 'text') {
        if (!pasteText.trim()) { setImportError('Paste some draw text first.'); return }
        body = { text: pasteText }
      } else {
        const file = fileInputRef.current?.files?.[0]
        if (!file) { setImportError('Select an image file first.'); return }
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        body = { image_base64: base64, media_type: file.type }
      }

      const res = await parseDraw(body)
      if (res.data.error) { setImportError(res.data.error); return }

      if (res.data.type === 'in_progress') {
        // Bracket with real results already played
        const completed = res.data.completed_rounds || []
        const remaining = res.data.remaining_players || []

        if (remaining.length < 2) {
          setImportError('Could not identify remaining players from this draw.')
          return
        }

        const snapped = snapToDrawSize(remaining.length)
        setCompletedRounds(completed)
        setDrawSize(snapped)
        setDraw(remaining.slice(0, snapped))
        setResult(null)
        setSourceNote(
          `Imported in-progress bracket — ${completed.length} completed round(s) shown, ` +
          `${remaining.length} players remaining.`
        )
      } else {
        // Clean (unplayed) draw
        const players = res.data.players || []
        if (players.length < 2) {
          setImportError('Could not find enough players in the draw.')
          return
        }
        const snapped = snapToDrawSize(players.length)
        setCompletedRounds([])
        setDrawSize(snapped)
        setDraw(players.slice(0, snapped))
        setResult(null)
        setSourceNote('')
      }

      if (res.data.tournament_name) {
        setSearchQuery(res.data.tournament_name)
      }

      setPasteText('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      setImportError('Import failed. Check that the backend is running.')
      console.error(e)
    } finally {
      setImporting(false)
    }
  }

  // Fetch draw by tournament name
  const handleFetchByName = async () => {
    if (!searchQuery.trim()) return
    setImportError('')
    setImporting(true)
    setCompletedRounds([])
    setSourceNote('')
    try {
      const res = await fetchDraw({ tournament_name: searchQuery })
      if (res.data.error) { setImportError(res.data.error); return }

      const players = res.data.players || []
      if (players.length < 2) {
        setImportError('No players found for that tournament.')
        return
      }

      const snapped = snapToDrawSize(players.length)
      setDrawSize(snapped)
      setDraw(players.slice(0, snapped))
      setResult(null)

      if (res.data.surface) setSurface(res.data.surface)
      if (res.data.source_note) setSourceNote(res.data.source_note)
    } catch (e) {
      setImportError('Search failed. Check that the backend is running.')
      console.error(e)
    } finally {
      setImporting(false)
    }
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

  const hasCompletedRounds = completedRounds.length > 0

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Tournament Simulator</h1>

      {/* ── Config card ── */}
      <div className="bg-white rounded-2xl shadow p-6 space-y-6">

        {/* Draw size / surface / format */}
        <div className="flex flex-wrap gap-8 items-start">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Draw Size</p>
            <div className="flex gap-2">
              {DRAW_SIZES.map(n => (
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

        {/* Mock mode */}
        <label className="flex items-center gap-3 cursor-pointer w-fit">
          <div className="relative">
            <input
              type="checkbox"
              checked={useMock}
              onChange={e => setUseMock(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-10 h-6 rounded-full transition-colors ${useMock ? 'bg-blue-500' : 'bg-gray-200'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow mt-1 transition-transform ${useMock ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
          </div>
          <span className="text-sm text-gray-600">
            Mock mode <span className="text-gray-400">(skips AI calls — use while testing layout)</span>
          </span>
        </label>

        {/* ── Import Draw panel ── */}
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Import Draw</p>

          {/* Tab switcher */}
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'image',  label: 'Upload Image' },
              { id: 'text',   label: 'Paste Text' },
              { id: 'search', label: 'Search by Name' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setImportTab(tab.id); setImportError('') }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  importTab === tab.id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-300 text-gray-500 hover:border-gray-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Image tab */}
          {importTab === 'image' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                Upload a screenshot of any bracket (ATP, ESPN, Tennis Abstract, etc.).
                Claude reads the results — if matches are already played, it shows them as real results
                and only predicts the remaining rounds.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3
                           file:rounded-full file:border-0 file:text-xs file:font-medium
                           file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>
          )}

          {/* Text paste tab */}
          {importTab === 'text' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                Go to atptour.com → any tournament → Draw tab, select all text and paste below.
              </p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={5}
                placeholder="Paste the draw text here..."
                className="w-full border border-gray-200 rounded-lg p-3 text-sm font-mono
                           resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          )}

          {/* Search tab */}
          {importTab === 'search' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                Type a tournament name and Claude will recall the draw from its training knowledge
                (covers events up to mid-2025).
              </p>
              <div className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFetchByName()}
                  placeholder='e.g. "Wimbledon 2024" or "Monte-Carlo Masters 2024"'
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={handleFetchByName}
                  disabled={importing || !searchQuery.trim()}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                             text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all"
                >
                  {importing ? 'Searching…' : 'Search'}
                </button>
              </div>
            </div>
          )}

          {importError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{importError}</p>
          )}

          {/* Parse button — only for image/text tabs */}
          {importTab !== 'search' && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                         text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all shadow-sm"
            >
              {importing ? 'Parsing…' : 'Parse Draw with AI'}
            </button>
          )}
        </div>

        {/* Source note from fetch/parse */}
        {sourceNote && (
          <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">{sourceNote}</p>
        )}

        {/* Manual player search */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            {hasCompletedRounds
              ? `Remaining Players to Simulate (${draw.length} / ${drawSize})`
              : `Build Your Draw (${draw.length} / ${drawSize} players)`
            }
          </p>
          <PlayerSearch
            onSelect={handleAddPlayer}
            placeholder="Or search and add players manually…"
          />
        </div>

        {/* Player chips */}
        {draw.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {draw.map((name, index) => (
              <div
                key={name}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200
                           rounded-full pl-3 pr-2 py-1.5 text-sm transition-colors"
              >
                <span className="text-gray-400 text-xs font-mono">#{index + 1}</span>
                <span className="font-medium text-gray-800">{name}</span>
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

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {!useMock && drawSize > 4 && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            ⚠️ {drawSize} remaining players = {drawSize - 1} AI API calls.
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
          {loading
            ? '⏳ Simulating…'
            : hasCompletedRounds
            ? `🎾 Simulate Remaining ${drawSize} Players`
            : `🏆 Simulate ${drawSize}-Player Tournament`
          }
        </button>
      </div>

      {/* ── Bracket display ── */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="font-semibold text-gray-800 mb-1">
          Bracket {result?.champion ? `— Predicted Champion: ${result.champion}` : ''}
        </h2>
        {hasCompletedRounds && !result && (
          <p className="text-xs text-gray-400 mb-4">
            Showing {completedRounds.length} completed round(s) from the imported draw.
            Click Simulate to predict the remaining matches.
          </p>
        )}
        <TournamentBracket
          rounds={result?.rounds}
          champion={result?.champion}
          isLoading={loading}
          completedRounds={completedRounds}
        />
      </div>
    </div>
  )
}
