"use client"

import Link from "next/link"
import { Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react"
import { BrandLogo } from "@/components/brand/BrandLogo"
import { UserMenu } from "@/components/layout/UserMenu"
import { StudySelector } from "@/components/study/StudySelector"

interface AppHeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenMobileNav: () => void
}

export function AppHeader({ sidebarCollapsed, onToggleSidebar, onOpenMobileNav }: AppHeaderProps) {
  return (
    <header
      className="nano-chrome sticky top-0 z-40 border-b"
      style={{ background: "#ffffff", borderColor: "var(--border)" }}
    >
      <div className="flex h-14 items-center gap-2 sm:gap-3 px-2.5 sm:px-3">
        {/* Mobile hamburger */}
        <button
          type="button"
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors duration-150 hover:bg-slate-50"
          style={{ borderColor: "#e2e8f0", color: "#475569" }}
          aria-label="Open navigation"
          onClick={onOpenMobileNav}
        >
          <Menu size={18} />
        </button>

        {/* Desktop sidebar toggle */}
        <button
          type="button"
          className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors duration-150 hover:bg-slate-50"
          style={{ borderColor: "#e2e8f0", color: "#475569" }}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleSidebar}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>

        {/* Brand */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 min-w-0 shrink-0"
          aria-label="NANOTOPHEA home"
        >
          <BrandLogo size="sm" priority className="!h-8 !w-8" />
          <span className="min-w-0 hidden min-[400px]:block">
            <span
              className="block font-[family-name:var(--font-display)] text-[0.95rem] sm:text-base font-bold leading-none tracking-tight"
              style={{ color: "#0d1f3c" }}
            >
              NANOTOPHEA
            </span>
            <span
              className="mt-0.5 hidden md:block text-[10px] font-medium leading-none truncate"
              style={{ color: "#64748b" }}
            >
              Natural Products Research Platform
            </span>
          </span>
        </Link>

        {/* Center: study selector */}
        <div className="flex-1 flex justify-center min-w-0 px-1 sm:px-2">
          <StudySelector compact />
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="hidden xl:inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium"
            style={{ borderColor: "#e8eef5", background: "#f8fafc", color: "#64748b" }}
            title="Outputs carry explicit evidence classes"
          >
            <ShieldCheck size={12} style={{ color: "#00a882" }} aria-hidden />
            Evidence-aware
          </span>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
