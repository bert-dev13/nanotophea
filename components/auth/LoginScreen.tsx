"use client"

import { useState } from "react"
import { BrandLogo } from "@/components/brand/BrandLogo"
import { useAuth } from "@/components/providers/AuthProvider"

export function LoginScreen() {
  const { login, error, clearError, loading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    clearError()
    setBusy(true)
    try {
      await login(email, password)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Sign-in failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f4f7fc" }}>
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-sm"
        style={{ background: "#ffffff", borderColor: "#dde5ef" }}
      >
        <div className="flex flex-col items-center text-center mb-5">
          <BrandLogo size="hero" priority className="mb-3" />
          <p className="text-sm font-semibold" style={{ color: "#0d1f3c" }}>
            Sign in to continue research work
          </p>
          <p className="text-[11px] mt-1" style={{ color: "#546e8a" }}>
            NanoHepatoTea Bioinformatics Research Platform
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-xs font-semibold" style={{ color: "#546e8a" }}>
            Email
            <input
              type="email"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "#dde5ef" }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="block text-xs font-semibold" style={{ color: "#546e8a" }}>
            Password
            <input
              type="password"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "#dde5ef" }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={6}
            />
          </label>

          {(localError || error) && (
            <p
              className="text-xs rounded-lg px-3 py-2"
              style={{ background: "#fef2f2", color: "#b91c1c" }}
            >
              {localError || error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || loading}
            className="w-full rounded-lg py-2.5 text-sm font-bold text-white"
            style={{ background: busy ? "#94a3b8" : "#00a882" }}
          >
            {busy ? "Please wait…" : "Login"}
          </button>
        </form>

        <p className="text-[11px] mt-4 leading-relaxed text-center" style={{ color: "#94a3b8" }}>
          Prototype access is limited to the configured administrator account.
          Self-registration is disabled.
        </p>
      </div>
    </div>
  )
}
