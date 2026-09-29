"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { AppHeader } from "@/components/layout/AppHeader"
import { AppNav } from "@/components/layout/AppNav"
import { AppFooter } from "@/components/layout/AppFooter"
import { ScientificNotice } from "@/components/layout/ScientificNotice"
import { AuthProvider, useAuth } from "@/components/providers/AuthProvider"
import { StudyProvider } from "@/components/providers/StudyProvider"
import { LoginScreen } from "@/components/auth/LoginScreen"
import { BrandLogo } from "@/components/brand/BrandLogo"

const SIDEBAR_COLLAPSE_KEY = "nanotophea.sidebarCollapsed"

function LoadingBrand({ label }: { label: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-3"
      style={{ background: "#f4f7fc" }}
    >
      <BrandLogo size="lg" priority />
      <p className="text-sm font-mono" style={{ color: "#546e8a" }}>
        {label}
      </p>
    </div>
  )
}

function AuthenticatedShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1")
    } catch {
      /* ignore */
    }
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0")
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  if (loading) {
    return <LoadingBrand label="Checking authentication…" />
  }

  if (!user) {
    return <LoginScreen />
  }

  return (
    <StudyProvider>
      <div
        className={`min-h-screen flex flex-col ${ready ? "nano-shell--in" : "opacity-0"}`}
        style={{ background: "#f4f7fc" }}
      >
        <AppHeader
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <div className="flex flex-1 min-h-0">
          <AppNav
            collapsed={sidebarCollapsed}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <ScientificNotice />
            <main className="nano-main-in flex-1 w-full mx-auto max-w-7xl px-3 sm:px-5 py-5">
              {children}
            </main>
            <AppFooter />
          </div>
        </div>
      </div>
    </StudyProvider>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <LoadingBrand label="Loading NANOTOPHEA…" />
  }

  return (
    <AuthProvider>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </AuthProvider>
  )
}
