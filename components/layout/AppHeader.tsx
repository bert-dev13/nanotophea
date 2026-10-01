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
    <header className="nano-topbar sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b px-3 sm:px-5">
      <button
        type="button"
        className="nano-topbar-menu inline-flex lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenMobileNav}
      >
        <BrandLogo size="sm" className="!h-7 !w-7" />
      </button>
      <div className="min-w-0">
        <p className="nano-topbar-kicker">{inStudy ? "Current study" : "Workspace"}</p>
        <p className="nano-topbar-title">{title}</p>
      </div>
    </header>
  )
}
