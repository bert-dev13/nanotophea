"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { useStudy } from "@/components/providers/StudyProvider"
import { assistantHref, type AssistantFocusId } from "@/lib/ai/focus"

export function AskAiLink({ context, label = "Ask AI about this result", className = "ai-ask", icon = false }: { context: AssistantFocusId; label?: string; className?: string; icon?: boolean }) {
  const { activeStudy } = useStudy()
  if (!activeStudy) return null
  return (
    <Link href={assistantHref(activeStudy.id, context)} className={className}>
      {icon ? <Sparkles size={14} strokeWidth={1.85} aria-hidden /> : null}
      {label}
    </Link>
  )
}
