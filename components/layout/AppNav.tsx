"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from "react"
import { ChevronDown, X } from "lucide-react"
import { NAV_GROUPS, type NavGroup, type NavLink } from "@/data/navigation"

const SIDEBAR_EXPANDED_KEY = "nanotophea.navExpanded"
const PREDICTIONS_KEY = "nanotophea.predictionsOpen"

function phaseMatches(group: NavGroup, pathname: string): boolean {
  const hrefs = [
    ...group.links.map((l) => l.href),
    ...(group.children?.flatMap((c) => c.links.map((l) => l.href)) ?? []),
  ]
  return hrefs.some((href) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")
  )
}

function isActiveHref(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")
}

function loadExpanded(): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(SIDEBAR_EXPANDED_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

interface AppNavProps {
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function AppNav({ collapsed, mobileOpen, onCloseMobile }: AppNavProps) {
  const pathname = usePathname()
  const activePhaseId = useMemo(() => {
    const hit = NAV_GROUPS.find((g) => phaseMatches(g, pathname))
    return hit?.id ?? "dashboard"
  }, [pathname])

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const g of NAV_GROUPS) init[g.id] = true
    return init
  })
  const [predictionsOpen, setPredictionsOpen] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const saved = loadExpanded()
    const next: Record<string, boolean> = {}
    for (const g of NAV_GROUPS) {
      next[g.id] = saved[g.id] ?? true
    }
    next[activePhaseId] = true
    setExpanded(next)

    try {
      const pred = localStorage.getItem(PREDICTIONS_KEY)
      setPredictionsOpen(pred === null ? true : pred === "1")
    } catch {
      setPredictionsOpen(true)
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(expanded))
    } catch {
      /* ignore */
    }
  }, [expanded, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(PREDICTIONS_KEY, predictionsOpen ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [predictionsOpen, hydrated])

  useEffect(() => {
    setExpanded((prev) => {
      if (prev[activePhaseId]) return prev
      return { ...prev, [activePhaseId]: true }
    })
    if (pathname.startsWith("/insilico/predictions")) {
      setPredictionsOpen(true)
    }
  }, [activePhaseId, pathname])

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

  const toggleGroup = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const panelProps = {
    pathname,
    activePhaseId,
    expanded,
    predictionsOpen,
    toggleGroup,
    setPredictionsOpen,
    onCloseMobile,
    mobileOpen,
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/30 transition-opacity duration-200 lg:hidden ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
        onClick={onCloseMobile}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[16.5rem] border-r bg-white shadow-xl transition-transform duration-200 ease-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ borderColor: "var(--border)" }}
        aria-hidden={!mobileOpen}
        aria-label="Mobile navigation"
      >
        <NavPanel {...panelProps} showLabels showMobileChrome />
      </aside>

      <aside
        className={`nano-sidebar hidden lg:flex sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 flex-col border-r bg-white transition-[width] duration-200 ease-out ${
          collapsed ? "w-[4.25rem]" : "w-[15.5rem]"
        }`}
        style={{ borderColor: "var(--border)" }}
        aria-label="Sidebar"
      >
        <NavPanel {...panelProps} showLabels={!collapsed} showMobileChrome={false} />
      </aside>
    </>
  )
}

function NavPanel({
  pathname,
  activePhaseId,
  expanded,
  predictionsOpen,
  toggleGroup,
  setPredictionsOpen,
  onCloseMobile,
  mobileOpen,
  showLabels,
  showMobileChrome,
}: {
  pathname: string
  activePhaseId: string
  expanded: Record<string, boolean>
  predictionsOpen: boolean
  toggleGroup: (id: string) => void
  setPredictionsOpen: Dispatch<SetStateAction<boolean>>
  onCloseMobile: () => void
  mobileOpen: boolean
  showLabels: boolean
  showMobileChrome: boolean
}) {
  const onNavKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && mobileOpen) onCloseMobile()
  }

  return (
    <div className="flex h-full flex-col">
      {showMobileChrome ? (
        <div
          className="flex items-center justify-between px-3 py-2 border-b"
          style={{ borderColor: "#eef2f7" }}
        >
          <span className="text-xs font-bold tracking-wide" style={{ color: "#0d1f3c" }}>
            Navigation
          </span>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-slate-50"
            style={{ color: "#64748b" }}
            aria-label="Close navigation"
            onClick={onCloseMobile}
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-1"
        aria-label="Research modules"
        onKeyDown={onNavKeyDown}
      >
        {NAV_GROUPS.map((group) => {
          const isOpen = showLabels ? (expanded[group.id] ?? true) : true
          const groupActive = group.id === activePhaseId

          return (
            <div key={group.id} className="nano-nav-group">
              {showLabels ? (
                <button
                  type="button"
                  className="nano-nav-section flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-slate-50"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                >
                  <span
                    className="flex-1 text-[10px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: groupActive ? "#00a882" : "#94a3b8" }}
                  >
                    {group.label}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
                    style={{ color: "#cbd5e1" }}
                    aria-hidden
                  />
                </button>
              ) : (
                <div
                  className="mx-auto mb-1 mt-2 h-px w-6 first:mt-0"
                  style={{ background: "#e8eef5" }}
                  aria-hidden
                />
              )}

              <div className={`nano-nav-collapse ${isOpen ? "nano-nav-collapse--open" : ""}`}>
                <div className="nano-nav-collapse-inner space-y-0.5 pb-1">
                  {group.links.map((link) => (
                    <NavItem
                      key={link.href}
                      link={link}
                      pathname={pathname}
                      collapsed={!showLabels}
                    />
                  ))}

                  {group.children?.map((child) => {
                    const childActive = child.links.some((l) => isActiveHref(pathname, l.href))
                    const childOpen = !showLabels || predictionsOpen || childActive

                    return (
                      <div key={child.label} className="pt-0.5">
                        {showLabels ? (
                          <button
                            type="button"
                            className="flex w-full items-center gap-1 rounded-md px-2.5 py-1.5 text-left transition-colors duration-150 hover:bg-slate-50"
                            onClick={() => setPredictionsOpen((v) => !v)}
                            aria-expanded={childOpen}
                          >
                            <span
                              className="flex-1 text-[11px] font-semibold"
                              style={{ color: childActive ? "#0369a1" : "#64748b" }}
                            >
                              {child.label}
                            </span>
                            <ChevronDown
                              size={12}
                              className={`shrink-0 transition-transform duration-200 ${childOpen ? "" : "-rotate-90"}`}
                              style={{ color: "#cbd5e1" }}
                              aria-hidden
                            />
                          </button>
                        ) : null}

                        <div
                          className={`nano-nav-collapse ${childOpen ? "nano-nav-collapse--open" : ""}`}
                        >
                          <div
                            className={`nano-nav-collapse-inner space-y-0.5 ${showLabels ? "pl-2" : ""}`}
                          >
                            {child.links.map((link) => (
                              <NavItem
                                key={link.href}
                                link={link}
                                pathname={pathname}
                                collapsed={!showLabels}
                                nested
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </nav>
    </div>
  )
}

function NavItem({
  link,
  pathname,
  collapsed,
  nested = false,
}: {
  link: NavLink
  pathname: string
  collapsed: boolean
  nested?: boolean
}) {
  const Icon = link.icon
  const active = isActiveHref(pathname, link.href)
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null)

  return (
    <Link
      href={link.href}
      className={`nano-nav-item group relative flex items-center gap-2.5 rounded-md text-[12.5px] font-medium transition-[background,color] duration-150 ${
        collapsed ? "justify-center px-2 py-2" : "px-2.5 py-1.5"
      }`}
      style={{
        color: active ? (nested ? "#0369a1" : "#0d1f3c") : "#546e8a",
        background: active ? (nested ? "#e0f2fe" : "#00a88214") : "transparent",
        fontWeight: active ? 600 : 500,
      }}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? link.label : undefined}
      onMouseEnter={(e) => {
        if (!collapsed) return
        const r = e.currentTarget.getBoundingClientRect()
        setTip({ top: r.top + r.height / 2, left: r.right + 8 })
      }}
      onMouseLeave={() => setTip(null)}
      onFocus={(e) => {
        if (!collapsed) return
        const r = e.currentTarget.getBoundingClientRect()
        setTip({ top: r.top + r.height / 2, left: r.right + 8 })
      }}
      onBlur={() => setTip(null)}
    >
      {active && !collapsed ? (
        <span
          className="nano-nav-active-bar absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full"
          style={{ background: nested ? "#0284c7" : "#00a882" }}
          aria-hidden
        />
      ) : null}
      <Icon
        size={collapsed ? 18 : 15}
        className="shrink-0 opacity-90"
        style={{ color: active ? (nested ? "#0284c7" : "#00a882") : undefined }}
        aria-hidden
      />
      {!collapsed ? <span className="truncate">{link.label}</span> : null}

      {tip ? (
        <span
          role="tooltip"
          className="nano-nav-tooltip pointer-events-none fixed z-[60] whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-white shadow-md"
          style={{ top: tip.top, left: tip.left, transform: "translateY(-50%)" }}
        >
          {link.label}
        </span>
      ) : null}
    </Link>
  )
}
