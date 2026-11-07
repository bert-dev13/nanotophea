"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Atom,
  CalendarRange,
  CheckCircle2,
  Filter,
  FlaskConical,
  FolderKanban,
  FolderOpen,
  Loader2,
  Microscope,
  MoreVertical,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { useStudy } from "@/components/providers/StudyProvider"
import { NewStudyModal } from "@/components/study/NewStudyModal"
import { DeleteStudyModal } from "@/components/study/DeleteStudyModal"
import type { Study, StudyStatus } from "@/lib/domain/models"
import { readWorkflowProgress, studyPath, WORKFLOW_STEPS } from "@/lib/workflow/studyFlow"

const STATUS_CONFIG: Record<
  StudyStatus,
  { label: string; badge: string; dot: string }
> = {
  draft: {
    label: "Draft",
    badge: "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]",
    dot: "bg-slate-400",
  },
  active: {
    label: "Active",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
  },
  analysis: {
    label: "In Analysis",
    badge: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    dot: "bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]",
  },
  completed: {
    label: "Completed",
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)]",
  },
  archived: {
    label: "Archived",
    badge: "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]",
    dot: "bg-slate-500",
  },
}

type FilterTab = "all" | StudyStatus
type SortOption = "updated" | "title" | "progress"

function formatUpdated(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d)
}

export function StudiesHome() {
  const router = useRouter()
  const { studies, activeStudy, loading, error, selectStudy, deleteStudyById } = useStudy()
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [progressReady, setProgressReady] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<FilterTab>("all")
  const [sortBy, setSortBy] = useState<SortOption>("updated")
  const [studyToDelete, setStudyToDelete] = useState<Study | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const titleId = useId()

  useEffect(() => {
    setProgressReady(true)
  }, [])

  const handleConfirmDelete = async (studyId: string) => {
    try {
      await deleteStudyById(studyId)
      setFeedbackMessage({
        type: "success",
        text: "Investigation deleted successfully.",
      })
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to delete this investigation. Please try again."
      setFeedbackMessage({
        type: "error",
        text: msg,
      })
      throw err
    }
  }

  // Metrics
  const counts = useMemo(
    () => ({
      total: studies.length,
      active: studies.filter((s) => s.status === "active").length,
      draft: studies.filter((s) => s.status === "draft").length,
      analysis: studies.filter((s) => s.status === "analysis").length,
      completed: studies.filter((s) => s.status === "completed").length,
      archived: studies.filter((s) => s.status === "archived").length,
    }),
    [studies]
  )

  // Filtered and sorted studies
  const filteredStudies = useMemo(() => {
    let result = [...studies]

    // Status tab filter
    if (activeTab !== "all") {
      result = result.filter((s) => s.status === activeTab)
    }

    // Text search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          (s.primaryCellLine && s.primaryCellLine.toLowerCase().includes(q)) ||
          (s.shortTitle && s.shortTitle.toLowerCase().includes(q)) ||
          (s.fairYear && s.fairYear.toLowerCase().includes(q))
      )
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title)
      }
      if (sortBy === "progress") {
        const progA = readWorkflowProgress(a.id)
        const progB = readWorkflowProgress(b.id)
        return progB - progA
      }
      // default: updated
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

    return result
  }, [studies, activeTab, searchQuery, sortBy])

  const openStudy = async (studyId: string) => {
    setOpeningId(studyId)
    setFormError(null)
    try {
      await selectStudy(studyId)
      const step = WORKFLOW_STEPS[readWorkflowProgress(studyId)] ?? WORKFLOW_STEPS[0]
      router.push(studyPath(studyId, step.id))
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not open the study")
      setOpeningId(null)
    }
  }

  return (
    <div className="w-full space-y-7 pb-12">
      {/* Hero Command Bar */}
      <header className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 backdrop-blur-xl shadow-lg">
        {/* Specular Edge Glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent"
          aria-hidden
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Sparkles size={14} className="text-emerald-500" />
              <span>BIOINFORMATICS RESEARCH PORTAL</span>
            </div>

            <h1 id={titleId} className="text-2xl sm:text-4xl font-extrabold text-[var(--card-foreground)] tracking-tight font-display">
              Research Studies
            </h1>

            <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
              Traceable computational pipelines, molecular docking calculations, and wet-lab validation
              records for <em>Phyllanthus niruri (Sampasampalukan)</em>.
            </p>
          </div>

          <button
            type="button"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:from-emerald-500 hover:to-teal-400 active:scale-95 shrink-0 self-start lg:self-auto"
            onClick={() => {
              setCreating(true)
              setFormError(null)
            }}
          >
            <Plus size={18} strokeWidth={2.5} className="transition-transform group-hover:rotate-90 duration-200" />
            <span>New Investigation</span>
          </button>
        </div>

        {/* Live Telemetry Metric Cards */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7 pt-6 border-t border-[var(--border)]">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5 backdrop-blur-md shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">Total Studies</span>
              <FolderKanban size={16} className="text-emerald-500" />
            </div>
            <p className="mt-1 text-2xl font-bold font-display text-[var(--card-foreground)]">
              {loading ? "—" : counts.total}
            </p>
            <p className="text-[10.5px] text-[var(--muted-foreground)] mt-0.5">Platform catalog</p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5 backdrop-blur-md shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">Active Pipelines</span>
              <Activity size={16} className="text-teal-500" />
            </div>
            <p className="mt-1 text-2xl font-bold font-display text-emerald-600 dark:text-emerald-300">
              {loading ? "—" : counts.active}
            </p>
            <p className="text-[10.5px] text-[var(--muted-foreground)] mt-0.5">Ongoing workflow</p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5 backdrop-blur-md shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">In Analysis</span>
              <Atom size={16} className="text-sky-500" />
            </div>
            <p className="mt-1 text-2xl font-bold font-display text-sky-600 dark:text-sky-300">
              {loading ? "—" : counts.analysis}
            </p>
            <p className="text-[10.5px] text-[var(--muted-foreground)] mt-0.5">Synthesis stage</p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5 backdrop-blur-md shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">Draft / Completed</span>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <p className="mt-1 text-2xl font-bold font-display text-[var(--card-foreground)]">
              {loading ? "—" : counts.completed + counts.draft}
            </p>
            <p className="text-[10.5px] text-[var(--muted-foreground)] mt-0.5">Archived & pending</p>
          </div>
        </div>
      </header>

      {/* Lightweight Status / Error Feedback Notice */}
      {feedbackMessage ? (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-xs font-semibold transition-all ${
            feedbackMessage.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss notice"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Interactive Controls: Search, Filter Tabs & Sorting */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-lg">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--muted-foreground)]">
            <Search size={16} strokeWidth={1.8} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search studies by title, cell line, description…"
            className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-10 pr-9 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {/* Filter Tabs & Sort Dropdown */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1">
            {(
              [
                { id: "all", label: "All", count: counts.total },
                { id: "active", label: "Active", count: counts.active },
                { id: "analysis", label: "Analysis", count: counts.analysis },
                { id: "draft", label: "Draft", count: counts.draft },
                { id: "completed", label: "Completed", count: counts.completed },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold ${
                    activeTab === tab.id
                      ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
                      : "bg-[var(--surface)] text-[var(--muted-foreground)] border border-[var(--border-subtle)]"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] py-2 pl-3 pr-8 text-xs font-medium text-[var(--foreground)] hover:border-[var(--border-strong)] focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="updated">Recently Updated</option>
              <option value="title">Title (A-Z)</option>
              <option value="progress">Workflow Progress</option>
            </select>
            <Filter
              size={12}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
          </div>
        </div>
      </div>

      {/* Modals & Alerts */}
      <NewStudyModal
        open={creating}
        onCloseAction={() => setCreating(false)}
        onCreatedAction={(study) => router.push(studyPath(study.id, "setup", "phytochemicals"))}
      />

      <DeleteStudyModal
        study={studyToDelete}
        open={Boolean(studyToDelete)}
        onClose={() => setStudyToDelete(null)}
        onConfirmDelete={handleConfirmDelete}
      />

      {error && !creating ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-xs text-rose-200">
          {error}
        </div>
      ) : null}

      {formError ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-xs text-rose-200">
          {formError}
        </div>
      ) : null}

      {/* Studies Grid Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--muted-foreground)] space-y-3">
          <Loader2 size={32} className="animate-spin text-emerald-500" />
          <p className="text-sm">Loading research studies catalog…</p>
        </div>
      ) : filteredStudies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)]/50 p-12 text-center space-y-3">
          <FolderKanban size={36} className="mx-auto text-[var(--muted-foreground)] opacity-60" />
          <h3 className="text-base font-bold text-[var(--foreground)]">
            {searchQuery || activeTab !== "all" ? "No matching studies found" : "No studies yet"}
          </h3>
          <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto">
            {searchQuery || activeTab !== "all"
              ? "Try adjusting your search criteria or resetting the active status filter."
              : "Initialize your first research investigation to begin the structured 6-stage bioinformatics workflow."}
          </p>
          {searchQuery || activeTab !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("")
                setActiveTab("all")
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
            >
              <span>Reset Filters</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-md transition-all"
            >
              <Plus size={15} />
              <span>Create Investigation</span>
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 list-none p-0 m-0">
          {filteredStudies.map((study, index) => (
            <StudyCard
              key={study.id}
              study={study}
              index={index}
              current={activeStudy?.id === study.id}
              progressReady={progressReady}
              opening={openingId === study.id}
              onOpen={() => void openStudy(study.id)}
              onDelete={() => setStudyToDelete(study)}
            />
          ))}
        </ul>
      )}

      {/* Compliance Disclaimer */}
      <p className="text-[11.5px] text-slate-500 text-center pt-4">
        Institutional Notice: Computational in silico outputs do not constitute experimental clinical proof. All investigations maintain traceable provenance.
      </p>
    </div>
  )
}

function StudyCard({
  study,
  current,
  progressReady,
  opening,
  onOpen,
  onDelete,
}: {
  study: Study
  index: number
  current: boolean
  progressReady: boolean
  opening: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const stepIndex = progressReady ? readWorkflowProgress(study.id) : 0
  const step = WORKFLOW_STEPS[stepIndex] ?? WORKFLOW_STEPS[0]
  const statusCfg = STATUS_CONFIG[study.status] ?? STATUS_CONFIG.draft
  const percentComplete = Math.round(((stepIndex + 1) / 6) * 100)

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  return (
    <li className="flex">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (!opening) onOpen()
          }
        }}
        onClick={() => {
          if (!opening) onOpen()
        }}
        className={`group relative flex w-full flex-col justify-between rounded-2xl border text-left p-6 transition-all duration-200 backdrop-blur-xl cursor-pointer ${
          current
            ? "border-emerald-500/60 bg-[var(--card)] shadow-xl ring-2 ring-emerald-500/25"
            : "border-[var(--card-border)] bg-[var(--card)] hover:border-emerald-500/40 hover:shadow-xl hover:-translate-y-1"
        }`}
      >
        {/* Top Edge Specular Glow */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] transition-opacity duration-300 ${
            current
              ? "bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent opacity-100"
              : "bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 group-hover:opacity-100"
          }`}
          aria-hidden
        />

        <div className="space-y-3.5">
          {/* Top Status & Indicator Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${statusCfg.badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                <span>{statusCfg.label}</span>
              </span>

              {current ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Current Study</span>
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              {study.fairYear ? (
                <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                  FAIR {study.fairYear}
                </span>
              ) : null}

              {/* Three-dot Actions Menu (⋯) */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] transition-colors"
                  aria-label={`Actions for ${study.title}`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen((v) => !v)
                  }}
                >
                  <MoreVertical size={15} />
                </button>

                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpen(false)
                        onOpen()
                      }}
                    >
                      <FolderOpen size={14} className="text-emerald-600 dark:text-emerald-400" />
                      <span>Open / Resume</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpen(false)
                        onDelete()
                      }}
                    >
                      <Trash2 size={14} />
                      <span>Delete Study</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Title & Description */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--card-foreground)] transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-300 line-clamp-1 font-display">
              {study.title}
            </h2>
            {study.description ? (
              <p className="mt-1.5 text-xs text-[var(--muted-foreground)] line-clamp-2 leading-relaxed">
                {study.description}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-[var(--muted-foreground)]/60 italic">No description provided</p>
            )}
          </div>

          {/* Telemetry Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[var(--muted-foreground)]">
            <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-1">
              <CalendarRange size={12} className="text-[var(--muted-foreground)] shrink-0" />
              <span>{formatUpdated(study.updatedAt)}</span>
            </span>

            {study.primaryCellLine ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-teal-500/30 bg-teal-500/10 px-2 py-1 text-teal-700 dark:text-teal-300 font-mono font-medium">
                <Microscope size={12} className="shrink-0" />
                <span>{study.primaryCellLine}</span>
              </span>
            ) : null}

            {study.shortTitle ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-1">
                <FlaskConical size={12} className="text-[var(--muted-foreground)] shrink-0" />
                <span className="truncate max-w-[120px]">{study.shortTitle}</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Milestone Pipeline Tracker & Action */}
        <div className="mt-6 pt-4 border-t border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--card-foreground)]">
              Stage {stepIndex + 1} of 6 · {step.label}
            </span>
            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
              {percentComplete}%
            </span>
          </div>

          {/* 6-step progress dots */}
          <div className="grid grid-cols-6 gap-1.5">
            {WORKFLOW_STEPS.map((s, idx) => {
              const isDone = idx < stepIndex
              const isCurr = idx === stepIndex
              return (
                <div
                  key={s.id}
                  title={`${s.number} ${s.label}`}
                  className={`h-1.5 rounded-full transition-all ${
                    isDone
                      ? "bg-emerald-500"
                      : isCurr
                      ? "bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.7)]"
                      : "bg-[var(--border)]"
                  }`}
                />
              )
            })}
          </div>

          {/* Bottom Action Button */}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] text-[var(--muted-foreground)]">
              {opening ? "Switching investigation…" : "Click to view workflow"}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-500 transition-colors">
              {opening ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Opening…</span>
                </>
              ) : (
                <>
                  <span>Resume</span>
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </li>
  )
}
