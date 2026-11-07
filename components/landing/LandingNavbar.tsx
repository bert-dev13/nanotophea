"use client"

import { useEffect, useState } from "react"
import { ArrowRight, Menu, X } from "lucide-react"
import { BrandLogo } from "@/components/brand/BrandLogo"
import { EnterLink } from "@/components/landing/EnterLink"
import { NAV_LINKS } from "@/components/landing/content"
import { ThemeToggle } from "@/components/theme/ThemeToggle"

const SECTION_IDS = NAV_LINKS.map((link) => link.href.slice(1))

export function LandingNavbar() {
  const [open, setOpen] = useState(false)
  const [stuck, setStuck] = useState(false)
  const [active, setActive] = useState("")

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 6)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const nodes = SECTION_IDS.map((id) => document.getElementById(id)).filter((node): node is HTMLElement => Boolean(node))
    if (nodes.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) setActive(visible.target.id)
      },
      { rootMargin: "-18% 0px -58% 0px", threshold: [0.12, 0.35, 0.6] },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  return (
    <header className={`lp-nav sticky top-0 z-50 w-full${stuck ? " is-stuck" : ""}`}>
      <div className="lp-wrap lp-nav-bar">
        <a href="#top" className="lp-lockup group">
          <div className="login-pulse-ring relative rounded-xl border border-[var(--lp-badge-border)] bg-[var(--lp-surface-elevated)] p-1 shadow-md">
            <BrandLogo size="sm" priority />
          </div>
          <span>
            <span className="lp-word transition-colors group-hover:text-[var(--lp-green)]">HEPATOTEA</span>
            <span className="lp-sub">Research Platform</span>
          </span>
        </a>

        <nav className="lp-nav-links" aria-label="Page">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} data-current={active === link.href.slice(1) ? "true" : undefined}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="lp-nav-actions">
          <EnterLink variant="quiet">Sign In</EnterLink>
          <EnterLink>
            Open Platform
            <ArrowRight size={15} aria-hidden />
          </EnterLink>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-2 lg:hidden ml-auto">
          <button
            type="button"
            className="lp-menu"
            aria-expanded={open}
            aria-controls="lp-mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
          <ThemeToggle />
        </div>
      </div>


      {open ? (
        <nav id="lp-mobile-nav" className="lp-wrap lp-mobile" aria-label="Page">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <div className="flex items-center justify-between w-full pt-3 pb-1 border-t border-[var(--lp-border)]">
            <span className="text-xs font-semibold text-[var(--lp-muted)] uppercase tracking-wider">Appearance</span>
            <ThemeToggle showLabel />
          </div>
          <EnterLink variant="quiet">Sign In</EnterLink>
          <EnterLink>
            Open Platform
            <ArrowRight size={15} aria-hidden />
          </EnterLink>
        </nav>
      ) : null}
    </header>
  )
}

