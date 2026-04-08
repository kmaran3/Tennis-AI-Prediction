import axios from 'axios'

// axios.create makes a reusable HTTP client with a shared base URL.
// VITE_API_URL is read from .env.local — defaults to local backend.
// In production the frontend is served by FastAPI itself, so the API is on the same origin.
// VITE_API_URL overrides this for local dev (points to localhost:8000).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
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

// Parse a tournament draw from pasted text or a base64 image
// body: { text } or { image_base64, media_type }
export const parseDraw = (body) =>
  api.post('/api/tournament/parse-draw', body)

// Fetch a tournament draw by name using Claude's training knowledge
// body: { tournament_name: string }
export const fetchDraw = (body) =>
  api.post('/api/tournament/fetch-draw', body)

// Get head-to-head record between two players
// a: string, b: string, surface: "Hard"|"Clay"|"Grass"|null
export const getH2HRecord = (a, b, surface = null) =>
  api.get('/api/players/h2h', { params: { a, b, ...(surface ? { surface } : {}) } })

// Get recent match form for a player
// name: string, n: number of matches
export const getRecentForm = (name, n = 8) =>
  api.get(`/api/players/${encodeURIComponent(name)}/recent-form?n=${n}`)

// Get today's ATP matches (legacy)
export const getTodaysMatches = () =>
  api.get('/api/matches/today')

// Get ATP matches for the next N days (frontend re-groups by local timezone)
export const getUpcomingMatches = (days = 7) =>
  api.get(`/api/matches/upcoming?days=${days}`)

// Look up the actual result of a match on Sofascore
export const getMatchResult = (player_a, player_b, after_date) =>
  api.get('/api/matches/result', { params: { player_a, player_b, after_date } })

// Attach JWT token to every request if present
api.interceptors.request.use(config => {
  const token = localStorage.getItem('atp_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const register = (body) => api.post('/api/auth/register', body)
export const login    = (body) => api.post('/api/auth/login', body)
export const getMe    = ()     => api.get('/api/auth/me')

// Saved predictions (persisted per account on the backend)
export const getSavedPredictions  = ()         => api.get('/api/saved-predictions')
export const postSavedPrediction  = (body)     => api.post('/api/saved-predictions', body)
export const putSavedPrediction   = (id, body) => api.put(`/api/saved-predictions/${id}`, body)
export const deleteSavedPrediction = (id)      => api.delete(`/api/saved-predictions/${id}`)
export const clearSavedPredictions = ()        => api.delete('/api/saved-predictions')
