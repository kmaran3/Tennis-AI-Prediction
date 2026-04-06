// useState: stores component-level data that causes re-renders when it changes
// useEffect: runs side effects (like API calls) in response to state changes
import { useState, useEffect } from 'react'
import { searchPlayers } from '../api/client'

// Props this component accepts:
//   onSelect(playerName) — called when user clicks a player from the dropdown
//   placeholder         — placeholder text for the text input
//   label               — optional label shown above the input
//   initialValue        — pre-populate the input (e.g. from URL params)
export default function PlayerSearch({ onSelect, placeholder = "Search player...", label, initialValue = '' }) {
  const [query, setQuery]     = useState(initialValue)  // Text the user has typed
  const [results, setResults] = useState([])   // Array of player name strings from API
  const [loading, setLoading] = useState(false)

  // Sync if parent updates initialValue after mount (e.g. URL param navigation)
  useEffect(() => {
    if (initialValue) setQuery(initialValue)
  }, [initialValue])

  // This useEffect runs every time `query` changes.
  // We wait 300ms after the last keystroke before calling the API (debouncing).
  // This prevents spamming the API on every single character typed.
  useEffect(() => {
    if (query.length < 2) {
      setResults([])  // Clear dropdown if query is too short
      return
    }

    // Set a 300ms delay before calling the API
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchPlayers(query)
        setResults(res.data.results)
      } catch (e) {
        console.error('Player search error:', e)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    // Cleanup function: cancels the timer if the user types again before 300ms
    // Without this, multiple API calls could overlap
    return () => clearTimeout(timer)
  }, [query]) // ← only re-runs when `query` changes

  const handleSelect = (name) => {
    setQuery(name)    // Fill the input with the selected name
    setResults([])    // Close the dropdown
    onSelect(name)    // Notify the parent component (e.g. HeadToHead page)
  }

  return (
    <div className="relative w-full">
      {/* Label shown above input */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}

      {/* Text input */}
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          // If user edits after selecting, clear the selection
        }}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
      />

      {/* Loading indicator */}
      {loading && (
        <span className="absolute right-3 top-3 text-xs text-gray-400">Searching...</span>
      )}

      {/* Dropdown results list — only rendered when results exist */}
      {results.length > 0 && (
        <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg
                       shadow-xl mt-1 max-h-52 overflow-y-auto">
          {results.map((name) => (
            <li
              key={name}
              onClick={() => handleSelect(name)}
              className="px-4 py-2.5 text-sm cursor-pointer hover:bg-green-50
                         hover:text-green-800 transition-colors"
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
