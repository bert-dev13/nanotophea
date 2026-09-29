"use client"

import { Info } from "lucide-react"

/** Compact disclaimer — sits below the header, not inside the brand chrome. */
export function ScientificNotice() {
  return (
    <div
      className="nano-notice border-b px-3 sm:px-4 py-1.5"
      style={{ background: "#f8fafc", borderColor: "#e8eef5" }}
      role="note"
    >
      <p
        className="flex items-center gap-2 text-[11px] leading-snug"
        style={{ color: "#64748b" }}
      >
        <Info size={12} className="shrink-0 opacity-70" aria-hidden style={{ color: "#00a882" }} />
        <span>
          Computational outputs do not constitute experimental proof. Evidence classes follow the
          Study Design Contract.
        </span>
      </p>
    </div>
  )
}
