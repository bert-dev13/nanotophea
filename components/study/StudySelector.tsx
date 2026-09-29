"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Check, ChevronDown, FolderOpen, Plus } from "lucide-react"
import { useStudy } from "@/components/providers/StudyProvider"
import type { StudyStatus } from "@/lib/domain/models"

const STATUS_TONE: Record<StudyStatus, { color: string; bg: string }> = {
  draft: { color: "#475569", bg: "#f1f5f9" },
  active: { color: "#0f766e", bg: "#ccfbf1" },
  analysis: { color: "#c2410c", bg: "#ffedd5" },
  archived: { color: "#64748b", bg: "#f8fafc" },
}

export function StudySelector() {
  const { studies, activeStudy, membership, createNewStudy, selectStudy, updateActiveStudy, loading } =
    useStudy()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState("NanoHepatoTea SIP 2026")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setMsg(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        setCreating(false)
        setMsg(null)
      }
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  const closeAll = () => {
    setOpen(false)
    setCreating(false)
    setMsg(null)
  }

  const openCreate = () => {
    setOpen(true)
    setCreating(true)
    setMsg(null)
  }

  const onCreate = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await createNewStudy({
        title: title.trim() || "Untitled study",
        shortTitle: "NanoHepatoTea",
        description: "In silico + experimental assessment of NanoHepatoTea against HepG2.",
        fairYear: "2026",
      })
      closeAll()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Create failed")
    } finally {
      setBusy(false)
    }
  }

  const studyLabel = activeStudy?.title || (loading ? "Loading…" : "Select study")
  const tone = activeStudy ? STATUS_TONE[activeStudy.status] : null

  return (
    <div className="relative flex items-center gap-1.5 min-w-0" ref={rootRef}>
      <button
        type="button"
        className={`nano-study-trigger nano-menu-trigger group inline-flex h-9 max-w-[min(100%,17rem)] sm:max-w-[22rem] md:max-w-[26rem] items-center gap-2 rounded-xl px-2.5 text-left ${
          open && !creating ? "nano-study-trigger--open" : ""
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Active study: ${studyLabel}`}
        disabled={loading}
        onClick={() => {
          if (open && !creating) closeAll()
          else {
            setCreating(false)
            setMsg(null)
            setOpen(true)
          }
        }}
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
              className="truncate text-[12.5px] font-semibold leading-tight"
              style={{ color: activeStudy ? "#0f172a" : "#94a3b8" }}
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
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${
            open && !creating ? "rotate-180 text-teal-700" : ""
          }`}
          aria-hidden
        />
      </button>

      <button
        type="button"
        className={`nano-new-study shrink-0 ${creating ? "nano-new-study--active" : ""}`}
        aria-label="New study"
        title="New study"
        onClick={openCreate}
      >
        <Plus size={15} strokeWidth={2.25} />
        <span className="hidden md:inline">New</span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Studies"
          className="nano-dropdown absolute left-0 top-full z-50 mt-2 w-[min(100vw-1.5rem,21rem)] overflow-hidden rounded-xl border border-teal-100 bg-white"
        >
          {creating ? (
            <div className="space-y-2.5 p-3.5">
              <p className="text-[12px] font-semibold text-slate-900">New study</p>
              <input
                ref={inputRef}
                className="nano-control w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] outline-none"
                value={title}
                placeholder="Study title"
                aria-label="Study title"
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onCreate()
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onCreate()}
                  className="flex-1 rounded-lg bg-teal-700 px-2.5 py-2 text-xs font-semibold text-white transition-[filter] duration-150 hover:brightness-105 disabled:opacity-60"
                >
                  {busy ? "Creating…" : "Create"}
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition-colors duration-150 hover:bg-slate-50"
                  onClick={() => {
                    setCreating(false)
                    setMsg(null)
                    if (studies.length === 0) closeAll()
                  }}
                >
                  Cancel
                </button>
              </div>
              {msg ? <p className="text-[11px] text-red-700">{msg}</p> : null}
            </div>
          ) : (
            <>
              <div className="max-h-56 overflow-y-auto py-1.5">
                {studies.length === 0 ? (
                  <p className="px-3.5 py-3 text-xs text-slate-400">
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
                        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[12.5px] transition-colors duration-150 hover:bg-teal-50/80"
                        style={{
                          color: selected ? "#0f172a" : "#64748b",
                          background: selected ? "#f0fdfa" : undefined,
                          fontWeight: selected ? 600 : 500,
                        }}
                        onClick={() => {
                          void selectStudy(s.id)
                          closeAll()
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
                        {selected ? <Check size={13} className="shrink-0 text-teal-700" aria-hidden /> : null}
                      </button>
                    )
                  })
                )}
              </div>

              {activeStudy && membership?.role === "OWNER" ? (
                <div className="border-t border-teal-50 px-3.5 py-2.5">
                  <label className="flex items-center justify-between gap-3 text-[11px] font-medium text-slate-500">
                    Status
                    <select
                      className="nano-control rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] capitalize outline-none"
                      value={activeStudy.status}
                      onChange={(e) =>
                        void updateActiveStudy({ status: e.target.value as StudyStatus })
                      }
                    >
                      {(["draft", "active", "analysis", "archived"] as StudyStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
