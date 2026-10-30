"use client"

import { Atom, ChartNoAxesCombined, FlaskConical, Lightbulb, Scale, ScrollText, type LucideIcon } from "lucide-react"

const SUGGESTIONS: Array<{ category: string; prompt: string; icon: LucideIcon }> = [
  { category: "Study Summary", prompt: "Summarize my research findings", icon: ScrollText },
  { category: "Docking", prompt: "Explain my docking results", icon: Atom },
  { category: "Predictions", prompt: "Review my biological predictions", icon: ChartNoAxesCombined },
  { category: "Laboratory", prompt: "Explain my laboratory results", icon: FlaskConical },
  { category: "Compare Evidence", prompt: "Compare computational and experimental findings", icon: Scale },
  { category: "Limitations", prompt: "Identify the main research limitations", icon: Lightbulb },
]

export function SuggestedResearchPrompts({
  disabled,
  onAsk,
}: {
  disabled: boolean
  onAsk: (question: string) => void
}) {
  return (
    <div className="ai-prompts">
      {SUGGESTIONS.map((item) => {
        const Icon = item.icon
        return (
          <button key={item.prompt} type="button" className="ai-prompt" disabled={disabled} onClick={() => onAsk(item.prompt)}>
            <Icon size={16} strokeWidth={1.85} aria-hidden />
            <span>
              <small>{item.category}</small>
              {item.prompt}
            </span>
          </button>
        )
      })}
    </div>
  )
}
