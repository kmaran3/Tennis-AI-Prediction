import axios from 'axios'

// axios.create makes a reusable HTTP client with a shared base URL.
// VITE_API_URL is read from .env.local — defaults to local backend.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

// Search for players whose names match the query string
// q: string (at least 2 characters)
export const searchPlayers = (q) =>
  api.get(`/api/players/search?q=${encodeURIComponent(q)}`)

// Get full stats for one player, optionally filtered by surface
// name: string, surface: "Hard"|"Clay"|"Grass"|null
export const getPlayerStats = (name, surface = null) =>
  api.get(`/api/players/${encodeURIComponent(name)}/stats`, {
    params: surface ? { surface } : {}
  })

// Run a head-to-head AI prediction
// body: { player_a, player_b, surface, best_of }
export const predictH2H = (body) =>
  api.post('/api/predict/h2h', body)

// Simulate a tournament bracket
// body: { draw: [...playerNames], surface, best_of, mock }
export const simulateTournament = (body) =>
  api.post('/api/tournament/simulate', body)
