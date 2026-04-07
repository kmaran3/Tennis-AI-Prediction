import { createContext, useContext, useEffect, useState } from 'react'
import { getMe } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  // On mount, verify any stored token and restore the session
  useEffect(() => {
    const token = localStorage.getItem('atp_token')
    if (!token) {
      setLoading(false)
      return
    }
    getMe()
      .then(res => setUser(res.data))
      .catch(() => localStorage.removeItem('atp_token'))
      .finally(() => setLoading(false))
  }, [])

  const login = (token, userData) => {
    localStorage.setItem('atp_token', token)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('atp_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
