"use client"

import { ShieldCheck } from "lucide-react"

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--footer-border)] bg-[var(--footer-bg)] px-4 sm:px-6 py-3.5 text-[var(--muted-foreground)]">
      <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between px-0 sm:px-2">
        <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
          <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>NANOTOPHEA · Natural Products Research Platform · Not a clinical dosing tool</span>
        </div>
        <p className="font-mono text-[10px] tracking-wider text-emerald-600 dark:text-emerald-400/80 font-medium">
          REFERENCE · LITERATURE · PREDICTED · EXPERIMENTAL · INTERPRETATION
        </p>
      </div>
    </footer>
  )
}
