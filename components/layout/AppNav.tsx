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
  Lock,
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
  stepAvailability,
  stepIdFromPathname,
  stepRecordStatus,
  studyPath,
  WORKFLOW_STEPS,
  type StepAvailability,
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
        className={`nano-sidebar fixed inset-y-0 left-0 z-50 flex w-[18.75rem] flex-col border-r shadow-2xl transition-transform duration-200 ease-out lg:hidden ${
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
        className={`nano-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r transition-[width] duration-200 ease-out lg:flex ${
          collapsed ? "w-[4.5rem]" : "w-[18.75rem]"
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

  const accountName = profile?.displayName || "Account"
  const accountEmail = profile?.email || ""

  return (
    <div className="flex h-full flex-col">
      <div className={`nano-side-head ${showLabels ? "" : "nano-side-head--compact"}`}>
        <Link
          href="/"
          className="nano-side-brand"
          onClick={closeIfMobile}
          aria-label="NANOTOPHEA studies"
        >
          <span className="nano-side-logo">
            <BrandLogo
              size="sm"
              priority={mode === "desktop"}
              className="!h-7 !w-7"
            />
          </span>
          {showLabels ? (
            <span className="min-w-0">
              <span className="nano-side-word">NANOTOPHEA</span>
              <span className="nano-side-tag">Research platform</span>
            </span>
          ) : null}
        </Link>
        {mode === "mobile" ? (
          <button type="button" className="nano-side-icon" aria-label="Close navigation" onClick={onCloseMobile}>
            <X size={16} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      <nav
        className={`nano-side-scroll flex-1 overflow-y-auto overflow-x-hidden ${showLabels ? "px-2.5 py-3" : "px-2 py-3"}`}
        aria-label="Research workflow"
        onKeyDown={onNavKeyDown}
      >
        <NavLink
          href="/"
          label="Studies"
          active={studiesActive}
          collapsed={!showLabels}
          icon={<FolderOpen size={16} strokeWidth={1.75} aria-hidden />}
          onClick={closeIfMobile}
        />

        <div className={showLabels ? "nano-study-slot" : "sr-only"}>
          <p className="nano-nav-kicker">Current study</p>
          {activeStudy ? (
            <div className="nano-study-card" title={activeStudy.title}>
              <span className="nano-study-dot" aria-hidden />
              <p className="nano-study-name">{activeStudy.title}</p>
            </div>
          ) : (
            <p className="nano-study-empty">No study open</p>
          )}
        </div>

        <p className={`nano-nav-kicker ${showLabels ? "" : "sr-only"}`}>Research workflow</p>
        <ol className="nano-flow-list">
          {WORKFLOW_STEPS.map((step) => {
            const status = stepRecordStatus(step.id, activeStudy ? readiness : null)
            const current = currentStepId === step.id
            const availability = activeStudy
              ? stepAvailability(step.id, readiness, current)
              : "available"
            const Icon = STEP_ICONS[step.id]
            const href =
              activeStudy && availability !== "locked" ? studyPath(activeStudy.id, step.id) : null
            return (
              <li key={step.id}>
                <StepLink
                  href={href}
                  number={step.number}
                  label={step.label}
                  current={current}
                  status={status}
                  availability={availability}
                  collapsed={!showLabels}
                  icon={<Icon size={15} strokeWidth={1.75} aria-hidden />}
                  onClick={closeIfMobile}
                />
              </li>
            )
          })}
        </ol>
      </nav>

      <div className={`nano-side-foot ${showLabels ? "" : "nano-side-foot--compact"}`}>
        <div className={`nano-side-account ${showLabels ? "" : "nano-side-account--compact"}`}>
          <span className="nano-side-avatar" title={showLabels ? undefined : accountName}>
            {accountInitials(accountName, accountEmail)}
          </span>
          {showLabels ? (
            <div className="min-w-0">
              <p className="nano-side-account-name truncate">{accountName}</p>
              <p className="nano-side-account-email truncate">{accountEmail}</p>
            </div>
          ) : null}
        </div>
        <div className={`nano-side-actions ${mode === "desktop" && showLabels ? "nano-side-actions--split" : ""}`}>
          <button
            type="button"
            className={`nano-side-icon ${showLabels ? "nano-side-icon--wide" : "w-full"}`}
            aria-label="Log out"
            onClick={() => void logout()}
          >
            <LogOut size={15} strokeWidth={1.75} />
            {showLabels ? <span>Log out</span> : null}
          </button>
          {mode === "desktop" ? (
            <button
              type="button"
              className={`nano-side-icon ${showLabels ? "nano-side-icon--wide" : "w-full"}`}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={onToggleCollapse}
            >
              {collapsed ? (
                <PanelLeftOpen size={15} strokeWidth={1.75} />
              ) : (
                <>
                  <PanelLeftClose size={15} strokeWidth={1.75} />
                  <span>Collapse</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function accountInitials(name: string, email: string): string {
  const source = (name || email || "A").trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function availabilityLabel(availability: StepAvailability, status: StepRecordStatus): string {
  if (availability === "locked") return "Locked"
  if (availability === "review" || status === "review") return "Review"
  if (availability === "current") return "Current"
  if (status === "complete") return "Completed"
  return "Available"
}

function StepLink({
  href,
  number,
  label,
  current,
  status,
  availability,
  collapsed,
  icon,
  onClick,
}: {
  href: string | null
  number: string
  label: string
  current: boolean
  status: StepRecordStatus
  availability: StepAvailability
  collapsed: boolean
  icon: ReactNode
  onClick?: () => void
}) {
  const note = availabilityLabel(availability, status)
  const tipLabel = `${number} ${label} · ${note}`
  const className = `nano-flow-nav ${collapsed ? "nano-flow-nav--collapsed" : ""} ${
    availability === "locked" ? "nano-flow-nav--locked" : ""
  }`

  const body = (
    <>
      <span className="nano-flow-num">{number}</span>
      <span className="nano-nav-glyph">
        {availability === "locked" ? <Lock size={14} strokeWidth={1.75} aria-hidden /> : icon}
        {status === "complete" ? (
          <span className="nano-flow-pip nano-flow-pip--done">
            <Check size={9} strokeWidth={3} aria-hidden />
          </span>
        ) : null}
        {status === "review" ? (
          <span className="nano-flow-pip nano-flow-pip--review">
            <CircleAlert size={9} strokeWidth={2.5} aria-hidden />
          </span>
        ) : null}
      </span>
      {collapsed ? null : <span className="nano-flow-label">{label}</span>}
      {collapsed ? null : <span className="nano-flow-state">{note}</span>}
    </>
  )

  if (!href) {
    const idleTitle = availability === "locked" ? `${label} is locked until Research Setup is complete` : "Open a study first"
    return (
      <span className={`${className} nano-flow-nav--idle`} data-availability={availability} title={idleTitle}>
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
      data-availability={availability}
      aria-current={current ? "step" : undefined}
      aria-label={collapsed ? tipLabel : undefined}
      title={collapsed ? undefined : note ? `${label} · ${note}` : label}
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
          className="nano-nav-tooltip pointer-events-none fixed z-[60] whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-medium"
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
      className={`nano-nav-item ${collapsed ? "nano-nav-item--collapsed" : ""}`}
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
      <span className="nano-nav-glyph">{icon}</span>
      {collapsed ? null : <span className="nano-flow-label">{label}</span>}
      {tip ? (
        <span
          role="tooltip"
          className="nano-nav-tooltip pointer-events-none fixed z-[60] whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-medium"
          style={{ top: tip.top, left: tip.left, transform: "translateY(-50%)" }}
        >
          {label}
        </span>
      ) : null}
    </Link>
  )
}
