"use client"

import { Suspense, useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AppHeader } from "@/components/layout/AppHeader"
import { AppNav } from "@/components/layout/AppNav"
import { AppFooter } from "@/components/layout/AppFooter"
import { AuthProvider, useAuth } from "@/components/providers/AuthProvider"
import { StudyProvider } from "@/components/providers/StudyProvider"
import { ResearchAssistantProvider } from "@/components/ai/research-assistant"
import { WorkflowStatusProvider } from "@/components/study/WorkflowStatus"
import { LoginScreen } from "@/components/auth/LoginScreen"
import { LandingPage } from "@/components/landing/LandingPage"
import { BrandLogo } from "@/components/brand/BrandLogo"

function LoadingBrand({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[var(--background)] text-[var(--foreground)]">
      <div className="login-pulse-ring rounded-2xl border border-emerald-500/30 bg-[var(--surface)] p-3 shadow-xl">
        <BrandLogo size="lg" priority />
      </div>
      <p className="text-sm font-medium text-[var(--muted-foreground)]">
        {label}
      </p>
    </div>
  )
}

function AuthenticatedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const assistant = pathname.includes("/assistant")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <StudyProvider>
      <WorkflowStatusProvider>
        <ResearchAssistantProvider>
          <div
            className={`nano-shell relative flex min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-emerald-500/30 selection:text-emerald-200 ${
              assistant ? "nano-shell--workspace" : ""
            } ${ready ? "nano-shell--in" : "opacity-0"}`}
          >
            {/* Atmospheric Ambient Glow Orbs for Workspace */}
            <div
              className="login-orb-1 pointer-events-none fixed -left-20 -top-20 h-[36rem] w-[36rem] rounded-full bg-emerald-500/10 blur-[150px]"
              aria-hidden
            />
            <div
              className="login-orb-2 pointer-events-none fixed -bottom-32 -right-20 h-[38rem] w-[38rem] rounded-full bg-teal-500/10 blur-[160px]"
              aria-hidden
            />
            <div className="login-grid-bg pointer-events-none fixed inset-0 z-0 opacity-40" aria-hidden />

            <AppNav
              mobileOpen={mobileOpen}
              onCloseMobile={() => setMobileOpen(false)}
            />

            <div className={`relative z-10 flex min-w-0 flex-1 flex-col ${assistant ? "min-h-0" : ""}`}>
              <AppHeader onOpenMobileNav={() => setMobileOpen(true)} />
              <main className={assistant ? "nano-assistant-main" : "nano-main-in flex-1 w-full px-4 sm:px-6 lg:px-8 py-6"}>
                {children}
              </main>
              {assistant ? null : <AppFooter />}
            </div>
          </div>
        </ResearchAssistantProvider>
      </WorkflowStatusProvider>
    </StudyProvider>
  )
}

function Gate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const search = useSearchParams()
  const router = useRouter()
  const { user, loading } = useAuth()
  const signingIn = search.get("signin") === "1"

  useEffect(() => {
    if (user && signingIn && pathname === "/") router.replace("/")
  }, [user, signingIn, pathname, router])

  if (loading) return <LoadingBrand label="Checking authentication..." />
  if (!user && pathname === "/" && !signingIn) return <LandingPage />
  if (!user) return <LoginScreen />
  return <AuthenticatedShell>{children}</AuthenticatedShell>
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <LoadingBrand label="Loading HEPATOTEA..." />
  }

  const loadingFallback = <LoadingBrand label="Loading HEPATOTEA..." />

  return (
    <AuthProvider>
      <Suspense fallback={loadingFallback}>
        <Gate>{children}</Gate>
      </Suspense>
    </AuthProvider>
  )
}
