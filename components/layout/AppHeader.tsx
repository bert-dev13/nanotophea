"use client"

import { usePathname } from "next/navigation"
import { BrandLogo } from "@/components/brand/BrandLogo"
import { useStudy } from "@/components/providers/StudyProvider"

interface AppHeaderProps {
  onOpenMobileNav: () => void
}

/** Content-column top bar. Account and logout live in the sidebar. */
export function AppHeader({ onOpenMobileNav }: AppHeaderProps) {
  const pathname = usePathname()
  const { activeStudy } = useStudy()
  const inStudy = pathname.startsWith("/study/")
  const title = inStudy ? activeStudy?.title || "Current study" : "Studies"

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
      </button>
      <p className="min-w-0 truncate text-[13px] font-semibold text-[var(--foreground)]">{title}</p>
    </header>
  )
}
