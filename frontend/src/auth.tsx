import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as api from './api'
import type { AuthResponse, User } from './api'
import { clearRecentlyViewed } from './recentlyViewed'

interface AuthState {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  signup: (data: Parameters<typeof api.signup>[0]) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)
const TOKEN_KEY = 'cc_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<User | null>(null)

  // Restore the session on page load. Only drop the token if the server says it's invalid (401);
  // if the server is unreachable (e.g. restarting), keep it and retry instead of logging the user out.
  useEffect(() => {
    if (!token || user) return
    let cancelled = false
    let retry: ReturnType<typeof setTimeout> | undefined
    const check = () =>
      api
        .fetchMe(token)
        .then((u) => !cancelled && setUser(u))
        .catch((err) => {
          if (cancelled) return
          if (err instanceof api.UnauthorizedError) {
            localStorage.removeItem(TOKEN_KEY)
            setToken(null)
          } else {
            retry = setTimeout(check, 3000)
          }
        })
    check()
    return () => {
      cancelled = true
      clearTimeout(retry)
    }
  }, [token, user])

  function save({ token, user }: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, token)
    setToken(token)
    setUser(user)
  }

  const value: AuthState = {
    user,
    token,
    login: async (email, password) => save(await api.login(email, password)),
    signup: async (data) => save(await api.signup(data)),
    logout: () => {
      if (token) api.logout(token).catch(() => {})
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
      clearRecentlyViewed() // don't show the next person on a shared computer what this shopper browsed
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
