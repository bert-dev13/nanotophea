"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"

export function UserMenu() {
  const { profile, logout } = useAuth()
  const { membership } = useStudy()
  const [open, setOpen] = useState(false)
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

  const initials =
    profile?.displayName
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "U"

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="nano-menu-trigger inline-flex items-center gap-2 rounded-lg border pl-1.5 pr-2 py-1 text-left transition-[border-color,background,box-shadow] duration-150"
        style={{ borderColor: open ? "#00a88266" : "#dde5ef", background: "#ffffff" }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold text-white"
          style={{ background: "#0d1f3c" }}
          aria-hidden
        >
          {initials}
        </span>
        <span className="hidden sm:flex min-w-0 flex-col leading-tight">
          <span className="text-xs font-semibold truncate max-w-[8rem]" style={{ color: "#0d1f3c" }}>
            {profile?.displayName || "Account"}
          </span>
          {membership?.role === "OWNER" ? (
            <span className="text-[10px] font-medium tracking-wide" style={{ color: "#64748b" }}>
              Administrator
            </span>
          ) : null}
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
          role="menu"
          className="nano-dropdown absolute right-0 z-50 mt-1.5 w-56 origin-top-right overflow-hidden rounded-lg border shadow-lg"
          style={{ borderColor: "#e2e8f0", background: "#ffffff" }}
        >
          <div className="border-b px-3 py-2.5" style={{ borderColor: "#eef2f7" }}>
            <p className="text-xs font-semibold truncate" style={{ color: "#0d1f3c" }}>
              {profile?.displayName || "Account"}
            </p>
            <p className="mt-0.5 text-[11px] truncate" style={{ color: "#64748b" }}>
              {profile?.email}
            </p>
            {membership?.role === "OWNER" ? (
              <p
                className="mt-1.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium"
                style={{ borderColor: "#e2e8f0", color: "#475569", background: "#f8fafc" }}
              >
                <UserIcon size={10} aria-hidden />
                Administrator
              </p>
            ) : null}
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors duration-150 hover:bg-slate-50"
            style={{ color: "#475569" }}
            onClick={() => {
              setOpen(false)
              void logout()
            }}
          >
            <LogOut size={14} aria-hidden />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  )
}
