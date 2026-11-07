"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Check, ChevronDown, FolderOpen, Plus } from "lucide-react"
import { useStudy } from "@/components/providers/StudyProvider"
import { NewStudyModal } from "@/components/study/NewStudyModal"
import type { StudyStatus } from "@/lib/domain/models"

const STATUS_TONE: Record<StudyStatus, { color: string; bg: string }> = {
  draft: { color: "#475569", bg: "#f1f5f9" },
  active: { color: "#0f766e", bg: "#ccfbf1" },
  analysis: { color: "#c2410c", bg: "#ffedd5" },
  completed: { color: "#166534", bg: "#dcfce7" },
  archived: { color: "#64748b", bg: "#f8fafc" },
}

export function StudySelector() {
  const { studies, activeStudy, selectStudy, updateActiveStudy, loading } = useStudy()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const studyLabel = activeStudy?.title || (loading ? "Loading…" : "Select study")
  const tone = activeStudy ? STATUS_TONE[activeStudy.status] : null

  return (
    <div className="relative flex items-center gap-1.5 min-w-0" ref={rootRef}>
      <button
        type="button"
        className={`nano-study-trigger nano-menu-trigger group inline-flex h-9 max-w-[min(100%,17rem)] sm:max-w-[22rem] md:max-w-[26rem] items-center gap-2 rounded-xl px-2.5 text-left ${
          open ? "nano-study-trigger--open" : ""
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Active study: ${studyLabel}`}
        disabled={loading}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="nano-study-icon shrink-0" aria-hidden>
          <FolderOpen size={14} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-teal-700/70 leading-none">
            Active study
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <span
              className="truncate text-[12.5px] font-semibold leading-tight text-[var(--foreground)]"
            >
              {studyLabel}
            </span>
            {tone ? (
              <span
                className="hidden sm:inline shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide capitalize"
                style={{ color: tone.color, background: tone.bg }}
              >
                {activeStudy?.status}
              </span>
            ) : null}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-[var(--muted-foreground)] transition-transform duration-150 ${
            open ? "rotate-180 text-teal-600 dark:text-teal-400" : ""
          }`}
          aria-hidden
        />
      </button>

      <button
        type="button"
        className={`nano-new-study shrink-0 ${creating ? "nano-new-study--active" : ""}`}
        aria-label="New study"
        title="New study"
        onClick={() => {
          setOpen(false)
          setCreating(true)
        }}
      >
        <Plus size={15} strokeWidth={2.25} />
        <span className="hidden md:inline">New</span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Studies"
          className="nano-dropdown absolute left-0 top-full z-50 mt-2 w-[min(100vw-1.5rem,21rem)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] backdrop-blur-xl shadow-2xl"
        >
          <div className="max-h-56 overflow-y-auto py-1.5">
                {studies.length === 0 ? (
                  <p className="px-3.5 py-3 text-xs text-[var(--muted-foreground)]">
                    No studies yet. Create one to begin.
                  </p>
                ) : (
                  studies.map((s) => {
                    const selected = s.id === activeStudy?.id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[12.5px] transition-colors duration-150 hover:bg-[var(--surface-secondary)]"
                        style={{
                          color: selected ? "var(--foreground)" : "var(--muted-foreground)",
                          background: selected ? "rgba(20, 184, 166, 0.15)" : undefined,
                          fontWeight: selected ? 650 : 500,
                        }}
                        onClick={() => {
                          void selectStudy(s.id)
                          setOpen(false)
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">{s.title}</span>
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                          style={{
                            color: STATUS_TONE[s.status].color,
                            background: STATUS_TONE[s.status].bg,
                          }}
                        >
                          {s.status}
                        </span>
                        {selected ? <Check size={13} className="shrink-0 text-teal-600 dark:text-teal-400" aria-hidden /> : null}
                      </button>
                    )
                  })
                )}
              </div>

              {activeStudy ? (
                <div className="border-t border-[var(--border)] px-3.5 py-2.5">
                  <label className="flex items-center justify-between gap-3 text-[11px] font-medium text-[var(--muted-foreground)]">
                    Status
                    <select
                      className="nano-control rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--foreground)] px-2 py-1.5 text-[11px] capitalize outline-none"
                      value={activeStudy.status}
                      onChange={(e) =>
                        void updateActiveStudy({ status: e.target.value as StudyStatus })
                      }
                    >
                      {(["draft", "active", "analysis", "completed", "archived"] as StudyStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
        </div>
      ) : null}
      <NewStudyModal open={creating} onCloseAction={() => setCreating(false)} />
    </div>
  )
}
