"use client"

import type { LucideIcon } from "lucide-react"
import { ModuleShell, ComingSoonPanel } from "@/components/ui/ModuleShell"
import type { EvidenceType } from "@/types/evidence"

export function PlaceholderModule({
  icon,
  title,
  subtitle,
  evidence,
  phase,
  contractNote,
  upcoming,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  evidence: EvidenceType | EvidenceType[]
  phase: "dashboard" | "research" | "insilico" | "lab" | "analysis"
  contractNote: string
  upcoming: string[]
}) {
  return (
    <ModuleShell
      icon={icon}
      title={title}
      subtitle={subtitle}
      evidence={evidence}
      phase={phase}
      contractNote={contractNote}
    >
      <ComingSoonPanel title="Implementation status" points={upcoming} />
    </ModuleShell>
  )
}
