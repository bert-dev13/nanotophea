"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { UserProfile } from "@/lib/domain/models"

export interface AuthUser {
  uid: string
  id: string
  email: string | null
  displayName: string | null
  photoURL?: string | null
  role?: string
  getIdToken: () => Promise<string>
}

interface AuthContextValue {
  user: AuthUser | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sessionTokenRef = useRef<string>("")

  const buildAuthUser = useCallback((p: UserProfile, token: string): AuthUser => {
    return {
      uid: p.id,
      id: p.id,
      email: p.email,
      displayName: p.displayName,
      photoURL: p.photoURL,
      role: p.role || p.defaultRole,
      getIdToken: async () => sessionTokenRef.current || token,
    }
  }, [])

  // Initial session verification on mount
  useEffect(() => {
    let mounted = true

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session", {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        })

        if (!res.ok) {
          if (mounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
          return
        }

        const data = await res.json()
        if (mounted) {
          if (data?.user) {
            sessionTokenRef.current = data.token || ""
            setProfile(data.user)
            setUser(buildAuthUser(data.user, data.token || ""))
          } else {
            sessionTokenRef.current = ""
            setUser(null)
            setProfile(null)
          }
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          console.warn("[AuthProvider] Session verification error:", err)
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    }

    checkSession()
    return () => {
      mounted = false
    }
  }, [buildAuthUser])

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      })
      if (!res.ok) {
        setProfile(null)
        setUser(null)
        return
      }
      const data = await res.json()
      if (data?.user) {
        sessionTokenRef.current = data.token || sessionTokenRef.current
        setProfile(data.user)
        setUser(buildAuthUser(data.user, sessionTokenRef.current))
      } else {
        setProfile(null)
        setUser(null)
      }
    } catch {
      // Retain existing state if network hiccup
    }
  }, [buildAuthUser])

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null)
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = data?.error || "Invalid email or password."
        setError(msg)
        throw new Error(msg)
      }

      if (data?.user) {
        sessionTokenRef.current = data.token || ""
        setProfile(data.user)
        setUser(buildAuthUser(data.user, data.token || ""))
      }
    },
    [buildAuthUser]
  )

  const logout = useCallback(async () => {
    setError(null)
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(sessionTokenRef.current ? { Authorization: `Bearer ${sessionTokenRef.current}` } : {}),
        },
      })
    } catch {
      // Invalidate client side regardless
    } finally {
      sessionTokenRef.current = ""
      setUser(null)
      setProfile(null)
      // Redirect to login / landing page
      window.location.href = "/"
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      login,
      logout,
      refreshProfile,
      clearError: () => setError(null),
    }),
    [user, profile, loading, error, login, logout, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
