"use client"

import { usePathname } from "next/navigation"
import { BrandLogo } from "@/components/brand/BrandLogo"
import { ThemeToggle } from "@/components/theme/ThemeToggle"
import { useStudy } from "@/components/providers/StudyProvider"

interface AppHeaderProps {
  onOpenMobileNav: () => void
}

/** Content-column top bar styled with theme-aware glassmorphism. */
export function AppHeader({ onOpenMobileNav }: AppHeaderProps) {
  const pathname = usePathname()
  const { activeStudy } = useStudy()
  const inStudy = pathname.startsWith("/study/")
  const title = inStudy ? activeStudy?.title || "Current study" : "Research Studies Hub"

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-[var(--header-border)] bg-[var(--header-bg)] px-4 sm:px-6 backdrop-blur-xl">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          className="inline-flex lg:hidden p-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-emerald-500/40"
          aria-label="Open navigation"
          onClick={onOpenMobileNav}
        >
          <BrandLogo size="sm" className="!h-5 !w-5" />
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-mono">
            {inStudy ? "Active Investigation" : "Platform Hub"}
          </p>
          <p className="text-sm font-bold text-[var(--foreground)] truncate font-display">
            {title}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] text-[var(--muted-foreground)]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          <span>Pipeline Online</span>
        </div>
        <ThemeToggle compact />
      </div>
    </header>
  )
}
