"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react"
import {
  Activity,
  Atom,
  BarChart3,
  Check,
  CircleAlert,
  ClipboardList,
  FlaskConical,
  FolderOpen,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ScanSearch,
  X,
  type LucideIcon,
} from "lucide-react"
import { BrandLogo } from "@/components/brand/BrandLogo"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { useWorkflowStatus } from "@/components/study/WorkflowStatus"
import {
  stepIdFromPathname,
  stepRecordStatus,
  studyPath,
  WORKFLOW_STEPS,
  type StepId,
  type StepRecordStatus,
} from "@/lib/workflow/studyFlow"

const STEP_ICONS: Record<StepId, LucideIcon> = {
  setup: ClipboardList,
  insilico: ScanSearch,
  docking: Atom,
  predictions: Activity,
  laboratory: FlaskConical,
  analysis: BarChart3,
}

interface AppNavProps {
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
  onToggleCollapse: () => void
}

export function AppNav({ collapsed, mobileOpen, onCloseMobile, onToggleCollapse }: AppNavProps) {
  const pathname = usePathname()

  useEffect(() => {
    onCloseMobile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-[#0c1929]/35 transition-opacity duration-200 lg:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!mobileOpen}
        onClick={onCloseMobile}
      />

      <aside
        className={`nano-sidebar fixed inset-y-0 left-0 z-50 flex w-[17.25rem] flex-col border-r bg-white shadow-xl transition-transform duration-200 ease-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
        aria-label="Mobile navigation"
      >
        <NavPanel
          pathname={pathname}
          showLabels
          mode="mobile"
          collapsed={false}
          mobileOpen={mobileOpen}
          onCloseMobile={onCloseMobile}
          onToggleCollapse={onToggleCollapse}
        />
      </aside>

      <aside
        className={`nano-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-white transition-[width] duration-200 ease-out lg:flex ${
          collapsed ? "w-[3.5rem]" : "w-[17.25rem]"
        }`}
        aria-label="Sidebar"
      >
        <NavPanel
          pathname={pathname}
          showLabels={!collapsed}
          mode="desktop"
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={onCloseMobile}
          onToggleCollapse={onToggleCollapse}
        />
      </aside>
    </>
  )
}

function NavPanel({
  pathname,
  showLabels,
  mode,
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggleCollapse,
}: {
  pathname: string
  showLabels: boolean
  mode: "desktop" | "mobile"
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
  onToggleCollapse: () => void
}) {
  const { profile, logout } = useAuth()
  const { activeStudy } = useStudy()
  const { readiness } = useWorkflowStatus()
  const studiesActive = pathname === "/"
  const currentStepId = activeStudy ? stepIdFromPathname(pathname, activeStudy.id) : null

  const onNavKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && mobileOpen) onCloseMobile()
  }

  const closeIfMobile = mode === "mobile" ? onCloseMobile : undefined

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-12 shrink-0 items-center border-b ${
          showLabels ? "gap-2 px-3" : "justify-center px-1.5"
        }`}
      >
        <Link
          href="/"
          className={`group flex min-w-0 items-center gap-2 ${showLabels ? "flex-1" : ""}`}
          onClick={closeIfMobile}
          aria-label="NANOTOPHEA studies"
        >
          <BrandLogo
            size="sm"
            priority={mode === "desktop"}
            className="!h-7 !w-7 transition-opacity duration-150 group-hover:opacity-80"
          />
          {showLabels ? (
            <span className="truncate font-[family-name:var(--font-display)] text-[0.8125rem] font-semibold leading-none tracking-[-0.02em] text-[var(--foreground)]">
              NANOTOPHEA
            </span>
          ) : null}
        </Link>
        {mode === "mobile" ? (
          <button type="button" className="nano-icon-btn" aria-label="Close navigation" onClick={onCloseMobile}>
            <X size={16} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      <nav
        className={`flex-1 overflow-y-auto overflow-x-hidden py-2 ${showLabels ? "px-2" : "px-1.5"}`}
        aria-label="Research workflow"
        onKeyDown={onNavKeyDown}
      >
        <NavLink
          href="/"
          label="Studies"
          active={studiesActive}
          collapsed={!showLabels}
          icon={<FolderOpen size={showLabels ? 15 : 16} strokeWidth={1.75} aria-hidden />}
          onClick={closeIfMobile}
        />

        <p className={`nano-nav-kicker ${showLabels ? "" : "sr-only"}`}>Current study</p>
        {activeStudy ? (
          <p
            className={`nano-study-name ${showLabels ? "" : "sr-only"}`}
            title={activeStudy.title}
          >
            {activeStudy.title}
          </p>
        ) : showLabels ? (
          <p className="px-2 pb-1 text-[12px] text-[var(--nav-section)]">No study open</p>
        ) : null}

        <p className={`nano-nav-kicker ${showLabels ? "mt-2" : "sr-only"}`}>Research workflow</p>
        <ol className="space-y-0.5">
          {WORKFLOW_STEPS.map((step) => {
            const status = stepRecordStatus(step.id, activeStudy ? readiness : null)
            const current = currentStepId === step.id
            const Icon = STEP_ICONS[step.id]
            const href = activeStudy ? studyPath(activeStudy.id, step.id) : null
            return (
              <li key={step.id}>
                <StepLink
                  href={href}
                  number={step.number}
                  label={step.label}
                  current={current}
                  status={status}
                  collapsed={!showLabels}
                  icon={<Icon size={15} strokeWidth={1.75} aria-hidden />}
                  onClick={closeIfMobile}
                />
              </li>
            )
          })}
        </ol>
      </nav>

      <div className={`shrink-0 border-t ${showLabels ? "p-2.5" : "p-1.5"}`}>
        {showLabels ? (
          <div className="mb-2 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--nav-section)]">
              Account
            </p>
            <p className="mt-1 truncate text-[12.5px] font-semibold text-[var(--foreground)]">
              {profile?.displayName || "Account"}
            </p>
            <p className="truncate text-[11px] text-[var(--muted-foreground)]">{profile?.email}</p>
          </div>
        ) : null}
        <button
          type="button"
          className={`nano-icon-btn ${showLabels ? "!h-8 !w-full !justify-start gap-2 !px-2" : "w-full"}`}
          aria-label="Log out"
          onClick={() => void logout()}
        >
          <LogOut size={15} strokeWidth={1.75} />
          {showLabels ? <span className="text-[12.5px] font-medium">Log out</span> : null}
        </button>
        {mode === "desktop" ? (
          <button
            type="button"
            className={`nano-icon-btn mt-1 w-full ${showLabels ? "!h-8 !justify-start gap-2 !px-2" : ""}`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <PanelLeftOpen size={15} strokeWidth={1.75} />
            ) : (
              <>
                <PanelLeftClose size={15} strokeWidth={1.75} />
                <span className="text-[12px] font-medium">Collapse</span>
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function statusNote(status: StepRecordStatus): string | null {
  if (status === "complete") return "Completed"
  if (status === "review") return "Review required"
  return null
}

function StepLink({
  href,
  number,
  label,
  current,
  status,
  collapsed,
  icon,
  onClick,
}: {
  href: string | null
  number: string
  label: string
  current: boolean
  status: StepRecordStatus
  collapsed: boolean
  icon: ReactNode
  onClick?: () => void
}) {
  const note = statusNote(status)
  const tipLabel = note ? `${number} ${label} · ${note}` : `${number} ${label}`
  const className = `nano-flow-nav ${collapsed ? "nano-flow-nav--collapsed" : ""}`

  const body = (
    <>
      <span className="nano-flow-num">{number}</span>
      <span className="nano-nav-icon shrink-0">{icon}</span>
      {collapsed ? null : <span className="min-w-0 flex-1 truncate">{label}</span>}
      {status === "complete" ? (
        <Check size={13} strokeWidth={2.5} className="nano-flow-check shrink-0" aria-hidden />
      ) : null}
      {status === "review" ? (
        <CircleAlert size={13} strokeWidth={2.25} className="nano-flow-review shrink-0" aria-hidden />
      ) : null}
      {collapsed && status === "complete" ? <span className="sr-only">Completed</span> : null}
      {status === "review" ? <span className="sr-only">Review required</span> : null}
    </>
  )

  if (!href) {
    return (
      <span className={`${className} nano-flow-nav--idle`} title="Open a study first">
        {body}
        <CollapsedTip collapsed={collapsed} label={tipLabel} />
      </span>
    )
  }

  return (
    <Link
      href={href}
      className={className}
      data-current={current ? "true" : undefined}
      data-status={status}
      aria-current={current ? "step" : undefined}
      aria-label={collapsed ? tipLabel : undefined}
      title={collapsed ? undefined : note || undefined}
      onClick={onClick}
    >
      {body}
      <CollapsedTip collapsed={collapsed} label={tipLabel} />
    </Link>
  )
}

function CollapsedTip({ collapsed, label }: { collapsed: boolean; label: string }) {
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null)
  if (!collapsed) return null
  return (
    <span
      className="absolute inset-0"
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setTip({ top: r.top + r.height / 2, left: r.right + 8 })
      }}
      onMouseLeave={() => setTip(null)}
      onFocus={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setTip({ top: r.top + r.height / 2, left: r.right + 8 })
      }}
      onBlur={() => setTip(null)}
    >
      {tip ? (
        <span
          role="tooltip"
          className="nano-nav-tooltip pointer-events-none fixed z-[60] whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium text-white"
          style={{ top: tip.top, left: tip.left, transform: "translateY(-50%)" }}
        >
          {label}
        </span>
      ) : null}
    </span>
  )
}

function NavLink({
  href,
  label,
  active,
  collapsed,
  icon,
  onClick,
}: {
  href: string
  label: string
  active: boolean
  collapsed: boolean
  icon: ReactNode
  onClick?: () => void
}) {
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null)

  return (
    <Link
      href={href}
      className={`nano-nav-item relative flex items-center rounded text-[12.5px] transition-[background,color] duration-150 ${
        collapsed ? "justify-center px-1.5 py-2" : "gap-2 px-2 py-1.5"
      }`}
      data-active={active ? "true" : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!collapsed) return
        const r = e.currentTarget.getBoundingClientRect()
        setTip({ top: r.top + r.height / 2, left: r.right + 8 })
      }}
      onMouseLeave={() => setTip(null)}
    >
      <span className="nano-nav-icon shrink-0">{icon}</span>
      {collapsed ? null : <span className="truncate">{label}</span>}
      {tip ? (
        <span
          role="tooltip"
          className="nano-nav-tooltip pointer-events-none fixed z-[60] whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium text-white"
          style={{ top: tip.top, left: tip.left, transform: "translateY(-50%)" }}
        >
          {label}
        </span>
      ) : null}
    </Link>
  )
}
