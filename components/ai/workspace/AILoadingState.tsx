"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

const PHASES = [
  "Analyzing your study...",
  "Reading evidence",
  "Connecting findings",
  "Preparing response",
]

export function AILoadingState() {
  const [index, setIndex] = useState(0)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const slowTimer = window.setTimeout(() => setSlow(true), 8000)
    const cycle = window.setInterval(() => {
      setIndex((current) => (current + 1) % PHASES.length)
    }, 2200)
    return () => {
      window.clearTimeout(slowTimer)
      window.clearInterval(cycle)
    }
  }, [])

  const label = slow ? "Generating response..." : PHASES[index]

  return (
    <div className="ai-loading" role="status" aria-live="polite">
      <span className="ai-loading-mark" aria-hidden>
        <Sparkles size={16} strokeWidth={1.85} />
      </span>
      <div>
        <p className="ai-phase" key={label}>
          {label}
          <span className="ai-dots" aria-hidden><i /><i /><i /></span>
        </p>
        <div className="ai-skel" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}
