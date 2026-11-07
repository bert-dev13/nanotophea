"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, type KeyboardEvent, type ReactNode } from "react"
import {
  Activity,
  Atom,
  BarChart3,
  Check,
  CircleAlert,
  ClipboardList,
  FlaskConical,
  FolderOpen,
  Lock,
  LogOut,
  MessageSquareText,
  ScanSearch,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react"
import { BrandLogo } from "@/components/brand/BrandLogo"
import { ThemeToggle } from "@/components/theme/ThemeToggle"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { useWorkflowStatus } from "@/components/study/WorkflowStatus"
import {
  readWorkflowProgress,
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
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function AppNav({ mobileOpen, onCloseMobile }: AppNavProps) {
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
        className={`fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!mobileOpen}
        onClick={onCloseMobile}
      />

      <aside
        className={`nano-sidebar fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-background)] text-[var(--sidebar-foreground)] transition-transform duration-200 ease-out lg:hidden shadow-2xl ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
        aria-label="Mobile navigation"
      >
        <NavPanel
          pathname={pathname}
          mode="mobile"
          mobileOpen={mobileOpen}
          onCloseMobile={onCloseMobile}
        />
      </aside>

      <aside
        className="nano-sidebar sticky top-0 hidden h-screen w-[17rem] shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-background)] text-[var(--sidebar-foreground)] lg:flex"
        aria-label="Sidebar"
      >
        <NavPanel
          pathname={pathname}
          mode="desktop"
          mobileOpen={mobileOpen}
          onCloseMobile={onCloseMobile}
        />
      </aside>
    </>
  )
}

function NavPanel({
  pathname,
  mode,
  mobileOpen,
  onCloseMobile,
}: {
  pathname: string
  mode: "desktop" | "mobile"
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const { profile, logout } = useAuth()
  const { activeStudy, studies } = useStudy()
  const { readiness } = useWorkflowStatus()
  const studiesActive = pathname === "/"
  const currentStepId = activeStudy ? stepIdFromPathname(pathname, activeStudy.id) : null

  const onNavKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && mobileOpen) onCloseMobile()
  }

  const closeIfMobile = mode === "mobile" ? onCloseMobile : undefined

  const accountName = profile?.displayName || "Investigator"
  const accountEmail = profile?.email || ""
  const activeStepIdx = activeStudy ? readWorkflowProgress(activeStudy.id) : 0
  const viewedStep = WORKFLOW_STEPS.find((step) => step.id === currentStepId) ?? WORKFLOW_STEPS[activeStepIdx] ?? WORKFLOW_STEPS[0]
  const completedStages = readiness
    ? WORKFLOW_STEPS.filter((step) => stepRecordStatus(step.id, readiness) === "complete").length
    : null
  const studyComplete = completedStages === WORKFLOW_STEPS.length
  const progressLabel = studyComplete
    ? "6/6 Stages Completed"
    : completedStages === null
      ? `${activeStepIdx + 1}/6 Stages`
      : `${completedStages}/6 Stages`

  return (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className="nano-side-head border-b border-[var(--sidebar-border)] px-4 py-3.5 flex items-center justify-between">
        <Link
          href="/"
          className="nano-side-brand group flex items-center gap-3 min-w-0"
          onClick={closeIfMobile}
          aria-label="HEPATOTEA studies"
        >
          <div className="login-pulse-ring relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-[var(--sidebar-surface)] shadow-md">
            <BrandLogo
              size="sm"
              priority={mode === "desktop"}
              className="!h-6 !w-6"
            />
          </div>
          <div className="min-w-0">
            <span className="block font-display font-extrabold text-sm tracking-wide text-[var(--sidebar-foreground)] group-hover:text-emerald-400 transition-colors">
              HEPATOTEA
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10.5px] font-semibold text-emerald-400 tracking-tight">
                Research Platform
              </span>
            </div>
          </div>
        </Link>
        {mode === "mobile" ? (
          <button
            type="button"
            className="nano-side-icon text-[var(--sidebar-muted)] hover:text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-hover)] p-1 rounded-lg transition-colors"
            aria-label="Close navigation"
            onClick={onCloseMobile}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      {/* Main Navigation Scrollable Body */}
      <nav
        className="nano-side-scroll flex-1 overflow-y-auto overflow-x-hidden px-3 py-3.5 space-y-4"
        aria-label="Research workflow"
        onKeyDown={onNavKeyDown}
      >
        {/* Studies Hub */}
        <div>
          <p className="px-2 text-[10.5px] font-semibold tracking-wider uppercase text-[var(--sidebar-muted)]">
            Platform Hub
          </p>
          <div className="mt-1.5">
            <NavLink
              href="/"
              label="All Studies"
              active={studiesActive}
              badge={studies.length > 0 ? `${studies.length}` : undefined}
              icon={<FolderOpen size={16} strokeWidth={1.8} aria-hidden />}
              onClick={closeIfMobile}
            />
          </div>
        </div>

        {/* Current Study Card Slot */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <p className="text-[10.5px] font-semibold tracking-wider uppercase text-[var(--sidebar-muted)]">
              Active Investigation
            </p>
            {activeStudy ? (
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                {progressLabel}
              </span>
            ) : null}
          </div>

          {activeStudy ? (
            <div
              className="group relative rounded-xl border border-emerald-500/30 bg-[var(--sidebar-surface)] p-3 shadow-sm backdrop-blur-md transition-all hover:border-emerald-500/50"
              title={activeStudy.title}
            >
              <div className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[var(--sidebar-foreground)] truncate">
                    {activeStudy.title}
                  </p>
                  <p className="text-[11px] text-emerald-400 truncate mt-0.5 font-medium">
                    {studyComplete ? "Study Complete" : `Stage ${viewedStep.number} · ${viewedStep.label}`}
                  </p>
                </div>
              </div>

              {/* 6-segment mini progress track */}
              <div className="mt-2.5 grid grid-cols-6 gap-1">
                {WORKFLOW_STEPS.map((s, idx) => {
                  const filled = readiness
                    ? stepRecordStatus(s.id, readiness) === "complete"
                    : idx <= activeStepIdx
                  return (
                    <span
                      key={s.id}
                      title={s.label}
                      className={`h-1 rounded-full transition-colors ${
                        filled
                          ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                          : "bg-[var(--sidebar-border)]"
                      }`}
                    />
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--sidebar-border)] bg-[var(--sidebar-surface)]/50 p-3 text-center">
              <p className="text-xs text-[var(--sidebar-muted)]">No active study selected</p>
              <Link
                href="/"
                className="mt-1.5 inline-block text-[11px] text-emerald-400 hover:underline font-semibold"
                onClick={closeIfMobile}
              >
                Open study list →
              </Link>
            </div>
          )}
        </div>

        {/* Workflow Stages */}
        <div>
          <p className="px-2 text-[10.5px] font-semibold tracking-wider uppercase text-[var(--sidebar-muted)]">
            Pipeline Stages
          </p>
          <ol className="nano-flow-list mt-1.5 space-y-1">
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
                    icon={<Icon size={15} strokeWidth={1.8} aria-hidden />}
                    onClick={closeIfMobile}
                  />
                </li>
              )
            })}
          </ol>
        </div>

        {/* Research Tools */}
        <div className="pt-2 border-t border-[var(--sidebar-border)]">
          <p className="px-2 text-[10.5px] font-semibold tracking-wider uppercase text-[var(--sidebar-muted)]">
            Research Intelligence
          </p>
          <div className="mt-1.5">
            {activeStudy ? (
              <NavLink
                href={`/study/${activeStudy.id}/assistant`}
                label="AI Research Assistant"
                active={pathname.startsWith(`/study/${activeStudy.id}/assistant`)}
                tool
                badge="Copilot"
                icon={<MessageSquareText size={16} strokeWidth={1.8} aria-hidden />}
                onClick={closeIfMobile}
              />
            ) : (
              <span
                className="nano-flow-nav nano-flow-nav--idle flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-[var(--sidebar-muted)] opacity-60 cursor-not-allowed"
                title="Select a study to activate AI Assistant"
              >
                <span className="nano-nav-glyph">
                  <MessageSquareText size={16} strokeWidth={1.8} aria-hidden />
                </span>
                <span className="nano-flow-label">AI Research Assistant</span>
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* Account Footer Console */}
      <div className="nano-side-foot border-t border-[var(--sidebar-border)] p-3 bg-[var(--sidebar-background)]">
        <div className="flex items-center gap-2.5 px-1 py-1 mb-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white shadow-md">
            {accountInitials(accountName, accountEmail)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[var(--sidebar-foreground)] truncate">{accountName}</p>
            <p className="text-[11px] text-[var(--sidebar-muted)] truncate">{accountEmail}</p>
          </div>
          <ThemeToggle compact />
        </div>

        <button
          type="button"
          className="group flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--sidebar-border)] bg-[var(--sidebar-hover)] py-2 text-xs font-medium text-[var(--sidebar-foreground)] transition-all hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 active:scale-98"
          aria-label="Log out"
          onClick={() => void logout()}
        >
          <LogOut size={14} strokeWidth={1.8} className="transition-transform group-hover:-translate-x-0.5" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  )
}

function accountInitials(name: string, email: string): string {
  const source = (name || email || "I").trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function availabilityLabel(availability: StepAvailability, status: StepRecordStatus): string {
  if (availability === "locked") return "Locked"
  if (availability === "review" || status === "review") return "Needs Review"
  if (status === "complete") return "Completed"
  if (status === "in_progress") return "In Progress"
  if (availability === "current") return "Current"
  return "Available"
}

function StepLink({
  href,
  number,
  label,
  current,
  status,
  availability,
  icon,
  onClick,
}: {
  href: string | null
  number: string
  label: string
  current: boolean
  status: StepRecordStatus
  availability: StepAvailability
  icon: ReactNode
  onClick?: () => void
}) {
  const note = availabilityLabel(availability, status)
  const isLocked = availability === "locked"

  const body = (
    <>
      <span className="font-mono text-[10.5px] font-bold text-[var(--sidebar-muted)] shrink-0">
        {number}
      </span>
      <span className="nano-nav-glyph flex h-6 w-6 shrink-0 items-center justify-center text-[var(--sidebar-muted)] group-hover:text-emerald-400 transition-colors">
        {isLocked ? <Lock size={13} strokeWidth={1.8} aria-hidden /> : icon}
      </span>
      <span className="nano-flow-label flex-1 truncate text-xs font-medium text-[var(--sidebar-foreground)]">
        {label}
      </span>
      <StepMark status={status} isLocked={isLocked} current={current} />
    </>
  )

  if (!href || isLocked) {
    const idleTitle = isLocked ? `${label} · Prerequisites not yet met` : "Open a study first"
    return (
      <span
        className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-[var(--sidebar-muted)] opacity-60 cursor-not-allowed select-none"
        data-availability={availability}
        aria-label={idleTitle}
        title={idleTitle}
      >
        {body}
      </span>
    )
  }

  return (
    <Link
      href={href}
      className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs transition-all ${
        current
          ? "bg-[var(--sidebar-active)] border border-[var(--sidebar-active-border)] text-[var(--sidebar-active-foreground)] font-semibold shadow-sm"
          : "hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-foreground)]/85 hover:text-[var(--sidebar-foreground)]"
      }`}
      data-current={current ? "true" : undefined}
      data-status={status}
      data-availability={availability}
      aria-current={current ? "step" : undefined}
      title={note ? `${label} · ${note}` : label}
      onClick={onClick}
    >
      {body}
    </Link>
  )
}

function StepMark({
  status,
  isLocked,
  current,
}: {
  status: StepRecordStatus
  isLocked: boolean
  current: boolean
}) {
  if (status === "complete") {
    return (
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-sm"
        title="Stage completed"
      >
        <Check size={10} strokeWidth={3} />
      </span>
    )
  }
  if (status === "review") {
    return (
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-sm"
        title="Requires review"
      >
        <CircleAlert size={10} strokeWidth={2.5} />
      </span>
    )
  }
  if (current) {
    return (
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
    )
  }
  if (isLocked) {
    return null
  }
  return <span className="h-1.5 w-1.5 rounded-full bg-[var(--sidebar-border)] shrink-0" />
}

function NavLink({
  href,
  label,
  active,
  badge,
  icon,
  tool = false,
  onClick,
}: {
  href: string
  label: string
  active: boolean
  badge?: string
  icon: ReactNode
  tool?: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium transition-all ${
        active
          ? "bg-[var(--sidebar-active)] border border-[var(--sidebar-active-border)] text-[var(--sidebar-active-foreground)] font-semibold shadow-sm"
          : "hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-foreground)]/85 hover:text-[var(--sidebar-foreground)]"
      }`}
      data-active={active ? "true" : undefined}
      data-tool={tool ? "true" : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-[var(--sidebar-muted)] group-hover:text-emerald-400 transition-colors">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      {badge ? (
        <span className="rounded-md border border-[var(--sidebar-border)] bg-[var(--sidebar-surface)] px-1.5 py-0.5 text-[10px] font-mono text-emerald-400 font-bold">
          {badge}
        </span>
      ) : null}
    </Link>
  )
}
