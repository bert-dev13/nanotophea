"use client"

import { BrandLogo } from "@/components/brand/BrandLogo"
import { UserMenu } from "@/components/layout/UserMenu"
import { StudySelector } from "@/components/study/StudySelector"

interface AppHeaderProps {
  onOpenMobileNav: () => void
}

/**
 * Content-column top bar: study context + account.
 * Mobile uses the brand mark to open navigation (no hamburger).
 */
export function AppHeader({ onOpenMobileNav }: AppHeaderProps) {
  return (
    <header className="nano-topbar sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b px-3 sm:px-5">
      <button
        type="button"
        className="group flex shrink-0 items-center gap-2 rounded-lg px-1 py-1 transition-colors duration-150 hover:bg-teal-50 lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenMobileNav}
      >
        <BrandLogo
          size="sm"
          className="!h-7 !w-7 transition-opacity duration-150 group-hover:opacity-85"
        />
        <span className="hidden min-[420px]:block font-[family-name:var(--font-display)] text-[0.8125rem] font-semibold tracking-[-0.02em] text-slate-900">
          NANOTOPHEA
        </span>
      </button>

      <div
        className="hidden h-5 w-px shrink-0 bg-teal-200/80 min-[420px]:block lg:hidden"
        aria-hidden
      />

      <div className="flex min-w-0 flex-1 items-center">
        <StudySelector />
      </div>

      <UserMenu />
    </header>
  )
}
