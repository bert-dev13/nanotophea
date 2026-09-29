"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Check, ChevronDown, FolderOpen, Plus } from "lucide-react"
import { useStudy } from "@/components/providers/StudyProvider"
import type { StudyStatus } from "@/lib/domain/models"

export function StudySelector({ compact = false }: { compact?: boolean }) {
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
      setCreating(false)
      setOpen(false)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Create failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        type="button"
        className={`nano-menu-trigger inline-flex items-center gap-2 rounded-lg border text-left transition-[border-color,background,box-shadow] duration-150 ${
          compact ? "px-2 py-1.5 max-w-[11rem] sm:max-w-[16rem]" : "px-2.5 py-1.5 max-w-[14rem] sm:max-w-[20rem]"
        }`}
        style={{
          borderColor: open ? "#00a88266" : "#dde5ef",
          background: "#ffffff",
          boxShadow: open ? "0 0 0 3px #00a88214" : undefined,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Active study"
        disabled={loading}
        onClick={() => setOpen((v) => !v)}
      >
        <FolderOpen size={14} className="shrink-0" style={{ color: "#00a882" }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-medium leading-none" style={{ color: "#94a3b8" }}>
            Active study
          </span>
          <span
            className="mt-0.5 block truncate text-xs font-semibold leading-tight"
            style={{ color: "#0d1f3c" }}
          >
            {activeStudy?.title || (loading ? "Loading…" : "No studies yet")}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          style={{ color: "#94a3b8" }}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Studies"
          className="nano-dropdown absolute left-0 z-50 mt-1.5 w-[min(100vw-2rem,20rem)] origin-top-left overflow-hidden rounded-lg border shadow-lg"
          style={{ borderColor: "#e2e8f0", background: "#ffffff" }}
        >
          <div className="max-h-56 overflow-y-auto py-1">
            {studies.length === 0 ? (
              <p className="px-3 py-2 text-xs" style={{ color: "#94a3b8" }}>
                No studies yet
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
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors duration-150 hover:bg-slate-50"
                    style={{
                      color: selected ? "#0d1f3c" : "#475569",
                      background: selected ? "#00a8820d" : undefined,
                      fontWeight: selected ? 600 : 500,
                    }}
                    onClick={() => {
                      void selectStudy(s.id)
                      setOpen(false)
                      setCreating(false)
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    {selected ? <Check size={14} style={{ color: "#00a882" }} aria-hidden /> : null}
                  </button>
                )
              })
            )}
          </div>

          {activeStudy && membership?.role === "OWNER" ? (
            <div className="border-t px-3 py-2" style={{ borderColor: "#eef2f7" }}>
              <label className="block text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#94a3b8" }}>
                Status
                <select
                  className="nano-control mt-1 w-full rounded-md border px-2 py-1.5 text-xs outline-none"
                  style={{ borderColor: "#dde5ef", color: "#0d1f3c", background: "#ffffff" }}
                  value={activeStudy.status}
                  onChange={(e) => void updateActiveStudy({ status: e.target.value as StudyStatus })}
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

          <div className="border-t p-2" style={{ borderColor: "#eef2f7" }}>
            {!creating ? (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-bold text-white transition-[filter] duration-150 hover:brightness-105"
                style={{ background: "#00a882" }}
                onClick={() => setCreating(true)}
              >
                <Plus size={13} aria-hidden />
                New Study
              </button>
            ) : (
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold" style={{ color: "#546e8a" }}>
                  Study title
                  <input
                    ref={inputRef}
                    className="nano-control mt-1 w-full rounded-md border px-2.5 py-1.5 text-sm outline-none"
                    style={{ borderColor: "#dde5ef", color: "#0d1f3c" }}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void onCreate()
                    }}
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onCreate()}
                    className="flex-1 rounded-md px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                    style={{ background: "#00a882" }}
                  >
                    {busy ? "Creating…" : "Create"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-2.5 py-1.5 text-xs font-semibold"
                    style={{ borderColor: "#dde5ef", color: "#546e8a" }}
                    onClick={() => {
                      setCreating(false)
                      setMsg(null)
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {msg ? (
                  <p className="text-[11px]" style={{ color: "#b91c1c" }}>
                    {msg}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
