"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase/client"
import { upsertUserProfile } from "@/lib/repositories/userRepository"
import type { UserProfile } from "@/lib/domain/models"

interface AuthContextValue {
  user: User | null
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
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshProfile = useCallback(async () => {
    const auth = getFirebaseAuth()
    const current = auth.currentUser
    if (!current) {
      setProfile(null)
      return
    }
    const p = await upsertUserProfile({
      id: current.uid,
      email: current.email || "",
      displayName: current.displayName,
      photoURL: current.photoURL,
      defaultRole: "OWNER",
    })
    setProfile(p)
  }, [])

  useEffect(() => {
    let unsub = () => {}
    try {
      const auth = getFirebaseAuth()
      unsub = onAuthStateChanged(auth, async (next) => {
        setUser(next)
        if (!next) {
          setProfile(null)
          setLoading(false)
          return
        }
        try {
          const p = await upsertUserProfile({
            id: next.uid,
            email: next.email || "",
            displayName: next.displayName,
            photoURL: next.photoURL,
            defaultRole: "OWNER",
          })
          setProfile(p)
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to load profile")
        } finally {
          setLoading(false)
        }
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Firebase Auth init failed")
      setLoading(false)
    }
    return () => unsub()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)
  }, [])

  const logout = useCallback(async () => {
    setError(null)
    await signOut(getFirebaseAuth())
    setProfile(null)
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
