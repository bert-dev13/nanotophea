"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ChevronDown, LogOut } from "lucide-react"
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

  const isAdmin = membership?.role === "OWNER"

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        className={`nano-account-trigger nano-menu-trigger inline-flex h-9 items-center gap-2 rounded-xl pl-1 pr-2 ${
          open ? "nano-account-trigger--open" : ""
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nano-account-avatar" aria-hidden>
          {initials}
        </span>
        <span className="hidden sm:flex min-w-0 flex-col items-start leading-none">
          <span className="max-w-[8rem] truncate text-[12px] font-semibold text-slate-900">
            {profile?.displayName || "Account"}
          </span>
          {isAdmin ? (
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-teal-700">
              Admin
            </span>
          ) : null}
        </span>
        <ChevronDown
          size={13}
          className={`hidden sm:block shrink-0 text-slate-400 transition-transform duration-150 ${
            open ? "rotate-180 text-teal-700" : ""
          }`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="nano-dropdown absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-teal-100 bg-white"
        >
          <div className="border-b border-teal-50 px-3.5 py-3">
            <p className="truncate text-[13px] font-semibold text-slate-900">
              {profile?.displayName || "Account"}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{profile?.email}</p>
            {isAdmin ? (
              <p className="mt-2 inline-flex rounded-md bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-teal-800">
                ADMINISTRATOR
              </p>
            ) : null}
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[12.5px] font-medium text-slate-600 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-700"
            onClick={() => {
              setOpen(false)
              void logout()
            }}
          >
            <LogOut size={14} strokeWidth={1.75} aria-hidden />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}
