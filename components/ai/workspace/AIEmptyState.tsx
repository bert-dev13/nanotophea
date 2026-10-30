"use client"

import { Sparkles } from "lucide-react"

export function AIEmptyState() {
  return (
    <div className="ai-empty">
      <span className="ai-welcome-mark" aria-hidden>
        <Sparkles size={26} strokeWidth={1.75} />
      </span>
    </div>
  )
}
