"use client"

import { useEffect, useRef, useState } from "react"
import {
  Activity,
  Atom,
  BarChart3,
  ChevronDown,
  ClipboardList,
  FlaskConical,
  ScanSearch,
  TestTube,
  type LucideIcon,
} from "lucide-react"
import { ASSISTANT_FOCI, assistantFocusId, type AssistantFocusId } from "@/lib/ai/focus"

const ICONS: Record<AssistantFocusId, LucideIcon> = {
  entire: ClipboardList,
  setup: ClipboardList,
  insilico: ScanSearch,
  docking: Atom,
  dpph: Activity,
  mtt: Activity,
  ldh: Activity,
  ros: Activity,
  bax: Activity,
  "hippo-yap": Activity,
  laboratory: FlaskConical,
  characterization: TestTube,
  analysis: BarChart3,
}

const GROUPS: Array<{ label?: string; ids: AssistantFocusId[] }> = [
  { ids: ["entire"] },
  { ids: ["setup", "insilico", "docking"] },
  { label: "Biological predictions", ids: ["dpph", "mtt", "ldh", "ros", "bax", "hippo-yap"] },
  { label: "Experimental", ids: ["laboratory", "characterization"] },
  { label: "Analysis", ids: ["analysis"] },
]

export function AIContextSelector({
  focus,
  onChange,
}: {
  focus: AssistantFocusId
  onChange: (focus: AssistantFocusId) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const current = ASSISTANT_FOCI.find((item) => item.id === focus) ?? ASSISTANT_FOCI[0]
  const CurrentIcon = ICONS[current.id]

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="ai-context-select" ref={root}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Research context: ${current.label}`}
        onClick={() => setOpen((value) => !value)}
      >
        <CurrentIcon size={14} aria-hidden />
        {current.label}
        <ChevronDown size={13} aria-hidden />
      </button>
      {open ? (
        <ul role="listbox" aria-label="Research context">
          {GROUPS.map((group) => (
            <li key={group.label || group.ids[0]}>
              {group.label ? <p>{group.label}</p> : null}
              {group.ids.map((id) => {
                const item = ASSISTANT_FOCI.find((row) => row.id === id)
                if (!item) return null
                const Icon = ICONS[id]
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={focus === id}
                    onClick={() => {
                      onChange(assistantFocusId(id))
                      setOpen(false)
                    }}
                  >
                    <Icon size={14} aria-hidden />
                    {item.label}
                  </button>
                )
              })}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
