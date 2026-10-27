import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearSession, loadSession, saveSession, setUnauthorizedHandler, updateSessionUser } from './api.js'

const AuthContext = createContext(null)

export const homeFor = (user) => (user?.role === 'ADMIN' ? '/admin' : '/home')

// Screens that belong to one role's workspace. Everything else (the network) is shared.
const USER_ONLY = ['/home', '/projects', '/sdg', '/score', '/pipeline', '/browse']
const ADMIN_ONLY = ['/admin']
const under = (path, prefixes) => prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))

// May this user be sent back to `path` after signing in?
export function canReturnTo(user, path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return false
  if (under(path, ADMIN_ONLY)) return user.role === 'ADMIN'
  if (under(path, USER_ONLY)) return user.role !== 'ADMIN'
  return true
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadSession()?.user || null)

  useEffect(() => {
    // An expired or revoked token sends the user back to the login screen.
    setUnauthorizedHandler(() => {
      clearSession()
      setUser(null)
    })
  }, [])

  const login = useCallback(async (email, password, remember) => {
    const session = await api.post('/auth/login/', { email, password })
    saveSession(session, remember)
    setUser(session.user)
    return session.user
  }, [])

  // Public sign-up ("Join"): creates the account and signs in.
  const register = useCallback(async (form) => {
    const session = await api.post('/auth/register/', form)
    saveSession(session, true)
    setUser(session.user)
    return session.user
  }, [])

  const updateProfile = useCallback(async (changes) => {
    const fresh = await api.patch('/auth/me/', changes)
    updateSessionUser(fresh)
    setUser(fresh)
    return fresh
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout/')
    } catch {
      /* signing out locally is enough */
    }
    clearSession()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, login, register, updateProfile, logout }),
    [user, login, register, updateProfile, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
