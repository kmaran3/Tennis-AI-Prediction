import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login as apiLogin, register as apiRegister } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [tab,      setTab]      = useState('signin') // 'signin' | 'signup'
  const [email,    setEmail]    = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)

  const { login } = useAuth()
  const navigate  = useNavigate()

  const switchTab = (t) => {
    setTab(t)
    setError('')
    setEmail('')
    setUsername('')
    setPassword('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    try {
      let res
      if (tab === 'signin') {
        res = await apiLogin({ email, password })
      } else {
        if (!username.trim()) {
          setError('Username is required.')
          setBusy(false)
          return
        }
        res = await apiRegister({ username, email, password })
      }
      login(res.data.token, res.data.user)
      navigate('/')
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block text-green-500 text-4xl mb-3">🎾</Link>
          <h1 className="text-2xl font-bold text-gray-900">ATP Predictor</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to unlock AI predictions</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => switchTab('signin')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === 'signin'
                  ? 'text-green-500 border-b-2 border-green-500 bg-white'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchTab('signup')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === 'signup'
                  ? 'text-green-500 border-b-2 border-green-500 bg-white'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* Username — Sign Up only */}
            {tab === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. RafaFan"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900
                             focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent
                             placeholder-gray-300 transition"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900
                           focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent
                           placeholder-gray-300 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900
                           focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent
                           placeholder-gray-300 transition"
              />
            </div>

            {/* Inline error */}
            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-semibold text-sm py-3 rounded-xl transition-all flex items-center
                         justify-center gap-2 mt-2"
            >
              {busy ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {tab === 'signin' ? 'Signing in…' : 'Creating account…'}
                </>
              ) : (
                tab === 'signin' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          {/* Footer toggle */}
          <div className="px-6 pb-5 text-center text-xs text-gray-400">
            {tab === 'signin' ? (
              <>
                Don't have an account?{' '}
                <button onClick={() => switchTab('signup')} className="text-green-500 font-semibold hover:underline">
                  Sign up free
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={() => switchTab('signin')} className="text-green-500 font-semibold hover:underline">
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>

        {/* Back to home */}
        <p className="text-center mt-4 text-xs text-gray-400">
          <Link to="/" className="hover:text-gray-600 transition-colors">← Back to home</Link>
        </p>

      </div>
    </div>
  )
}
