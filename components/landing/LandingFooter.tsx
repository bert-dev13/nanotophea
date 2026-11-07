import { ShieldCheck } from "lucide-react"
import { BrandLogo } from "@/components/brand/BrandLogo"

const LINKS = [
  { href: "#top", label: "Top" },
  { href: "#platform", label: "Platform" },
  { href: "#workflow", label: "Workflow" },
  { href: "/?signin=1", label: "Sign In" },
]

export function LandingFooter() {
  return (
    <footer className="lp-footer relative border-t border-[var(--lp-footer-border)] bg-[var(--lp-footer-bg)] py-10 text-[var(--lp-footer-text)] transition-colors duration-300">
      <div className="lp-wrap lp-footer-grid flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-[var(--lp-border)] bg-[var(--lp-surface-elevated)] p-1.5 shadow-md">
            <BrandLogo size="sm" />
          </div>
          <div>
            <span className="block font-bold text-[var(--lp-heading)] tracking-tight text-sm font-display">
              HEPATOTEA
            </span>
            <span className="block text-xs text-[var(--lp-green)]">
              HepatoTea Bioinformatics Platform
            </span>
          </div>
        </div>

        <nav aria-label="Footer" className="flex items-center gap-5 text-xs">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[var(--lp-footer-text)] transition-colors hover:text-[var(--lp-green)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-[11px] text-[var(--lp-subtle)] text-center md:text-right">
          <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
          <span>Research use only · Not a clinical dosing tool</span>
        </div>
      </div>
    </footer>
  )
}

