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
import { ChevronRight, PanelLeftClose, PanelLeftOpen, X } from "lucide-react"
import { BrandLogo } from "@/components/brand/BrandLogo"
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
  onToggleCollapse: () => void
}

export function AppNav({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggleCollapse,
}: AppNavProps) {
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
    onToggleCollapse,
    collapsed,
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-[#0c1929]/35 transition-opacity duration-200 lg:hidden ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
        onClick={onCloseMobile}
      />

      {/* Mobile drawer */}
      <aside
        className={`nano-sidebar fixed inset-y-0 left-0 z-50 flex w-[15.75rem] flex-col border-r bg-white shadow-xl transition-transform duration-200 ease-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
        aria-label="Mobile navigation"
      >
        <NavPanel {...panelProps} showLabels mode="mobile" />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`nano-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-white transition-[width] duration-200 ease-out lg:flex ${
          collapsed ? "w-[3.5rem]" : "w-[14.75rem]"
        }`}
        aria-label="Sidebar"
      >
        <NavPanel {...panelProps} showLabels={!collapsed} mode="desktop" />
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
  onToggleCollapse,
  collapsed,
  showLabels,
  mode,
}: {
  pathname: string
  activePhaseId: string
  expanded: Record<string, boolean>
  predictionsOpen: boolean
  toggleGroup: (id: string) => void
  setPredictionsOpen: Dispatch<SetStateAction<boolean>>
  onCloseMobile: () => void
  mobileOpen: boolean
  onToggleCollapse: () => void
  collapsed: boolean
  showLabels: boolean
  mode: "desktop" | "mobile"
}) {
  const onNavKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && mobileOpen) onCloseMobile()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Brand row — aligns with content top bar */}
      <div
        className={`flex h-12 shrink-0 items-center border-b ${
          showLabels ? "gap-2 px-3" : "justify-center px-1.5"
        }`}
      >
        <Link
          href="/"
          className={`group flex min-w-0 items-center gap-2 ${showLabels ? "flex-1" : ""}`}
          onClick={mode === "mobile" ? onCloseMobile : undefined}
          aria-label="NANOTOPHEA home"
        >
          <BrandLogo
            size="sm"
            priority={mode === "desktop"}
            className="!h-7 !w-7 transition-opacity duration-150 group-hover:opacity-80"
          />
          {showLabels ? (
            <span className="min-w-0">
              <span className="block truncate font-[family-name:var(--font-display)] text-[0.8125rem] font-semibold leading-none tracking-[-0.02em] text-[var(--foreground)]">
                NANOTOPHEA
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-medium leading-none text-[var(--muted-foreground)]">
                Research platform
              </span>
            </span>
          ) : null}
        </Link>

        {mode === "mobile" ? (
          <button
            type="button"
            className="nano-icon-btn"
            aria-label="Close navigation"
            onClick={onCloseMobile}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      <nav
        className={`flex-1 overflow-y-auto overflow-x-hidden py-2 ${showLabels ? "px-2" : "px-1.5"}`}
        aria-label="Research modules"
        onKeyDown={onNavKeyDown}
      >
        {NAV_GROUPS.map((group, gi) => {
          const isOpen = showLabels ? (expanded[group.id] ?? true) : true
          const groupActive = group.id === activePhaseId

          return (
            <div key={group.id} className={gi > 0 ? "mt-1.5" : ""}>
              {showLabels ? (
                <button
                  type="button"
                  className="nano-nav-section flex w-full items-center gap-1 rounded px-2 py-1 text-left transition-colors duration-150 hover:bg-[var(--nav-hover)]"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                >
                  <span
                    className="flex-1 text-[10px] font-semibold uppercase tracking-[0.07em]"
                    style={{ color: groupActive ? "var(--primary)" : "var(--nav-section)" }}
                  >
                    {group.label}
                  </span>
                  <ChevronRight
                    size={12}
                    className={`shrink-0 text-[var(--nav-section)] transition-transform duration-200 ${
                      isOpen ? "rotate-90" : ""
                    }`}
                    aria-hidden
                  />
                </button>
              ) : gi > 0 ? (
                <div className="mx-auto my-1.5 h-px w-5 bg-[var(--border)]" aria-hidden />
              ) : null}

              <div className={`nano-nav-collapse ${isOpen ? "nano-nav-collapse--open" : ""}`}>
                <div className="nano-nav-collapse-inner space-y-px pb-0.5">
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
                      <div key={child.label} className={showLabels ? "pt-0.5" : ""}>
                        {showLabels ? (
                          <button
                            type="button"
                            className="flex w-full items-center gap-1 rounded px-2 py-1 text-left transition-colors duration-150 hover:bg-[var(--nav-hover)]"
                            onClick={() => setPredictionsOpen((v) => !v)}
                            aria-expanded={childOpen}
                          >
                            <span
                              className="flex-1 pl-0.5 text-[11px] font-medium"
                              style={{
                                color: childActive ? "var(--accent)" : "var(--muted-foreground)",
                              }}
                            >
                              {child.label}
                            </span>
                            <ChevronRight
                              size={11}
                              className={`shrink-0 text-[var(--nav-section)] transition-transform duration-200 ${
                                childOpen ? "rotate-90" : ""
                              }`}
                              aria-hidden
                            />
                          </button>
                        ) : null}

                        <div
                          className={`nano-nav-collapse ${childOpen ? "nano-nav-collapse--open" : ""}`}
                        >
                          <div
                            className={`nano-nav-collapse-inner space-y-px ${
                              showLabels ? "ml-2 border-l border-[var(--border)] pl-1.5" : ""
                            }`}
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

      {mode === "desktop" ? (
        <div className="shrink-0 border-t p-1.5">
          <button
            type="button"
            className={`nano-icon-btn w-full ${showLabels ? "!w-full !justify-start gap-2 !px-2.5" : ""}`}
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
        </div>
      ) : null}
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
      className={`nano-nav-item group relative flex items-center rounded text-[12.5px] transition-[background,color] duration-150 ${
        collapsed ? "justify-center px-1.5 py-2" : "gap-2 px-2 py-1.5"
      }`}
      data-active={active ? "true" : undefined}
      data-nested={nested ? "true" : undefined}
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
      <Icon size={collapsed ? 17 : 15} className="nano-nav-icon shrink-0" strokeWidth={1.75} aria-hidden />
      {!collapsed ? <span className="truncate">{link.label}</span> : null}

      {tip ? (
        <span
          role="tooltip"
          className="nano-nav-tooltip pointer-events-none fixed z-[60] whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium text-white"
          style={{ top: tip.top, left: tip.left, transform: "translateY(-50%)" }}
        >
          {link.label}
        </span>
      ) : null}
    </Link>
  )
}
