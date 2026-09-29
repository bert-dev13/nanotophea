"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import type { EvidenceType } from "@/types/evidence"

interface ModuleShellProps {
  icon: LucideIcon
  title: string
  subtitle: string
  evidence: EvidenceType | EvidenceType[]
  phase: "dashboard" | "research" | "insilico" | "lab" | "analysis"
  contractNote?: string
  children?: ReactNode
}

const PHASE_LABEL: Record<ModuleShellProps["phase"], string> = {
  dashboard: "Dashboard",
  research: "Research Data",
  insilico: "In-Silico Analysis",
  lab: "Laboratory Results",
  analysis: "Analysis",
}

export function ModuleShell({
  icon: Icon,
  title,
  subtitle,
  evidence,
  phase,
  contractNote,
  children,
}: ModuleShellProps) {
  const badges = Array.isArray(evidence) ? evidence : [evidence]

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4 sm:p-5" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="p-2.5 rounded-xl shrink-0" style={{ background: "#00a88212" }}>
            <Icon size={20} style={{ color: "#00a882" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "#546e8a" }}>
              {PHASE_LABEL[phase]}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "#0d1f3c" }}>
              {title}
            </h1>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: "#2a5070" }}>
              {subtitle}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {badges.map((b) => (
                <EvidenceBadge key={b} type={b} size="md" />
              ))}
            </div>
          </div>
        </div>
        {contractNote && (
          <p
            className="mt-4 text-xs leading-relaxed rounded-lg px-3 py-2 border"
            style={{ background: "#f8fafc", borderColor: "#e2e8f0", color: "#475569" }}
          >
            {contractNote}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

/** Placeholder body for modules not yet scientifically implemented */
export function ComingSoonPanel({
  title,
  points,
}: {
  title: string
  points: string[]
}) {
  return (
    <div className="rounded-xl border p-5" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <h2 className="text-sm font-bold mb-2" style={{ color: "#0d1f3c" }}>{title}</h2>
      <ul className="space-y-1.5">
        {points.map((p) => (
          <li key={p} className="text-sm flex gap-2" style={{ color: "#2a5070" }}>
            <span style={{ color: "#00a882" }}>•</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs mt-4 font-mono" style={{ color: "#94a3b8" }}>
        No scientific results are generated on this page yet — per STUDY_DESIGN_CONTRACT.md.
      </p>
    </div>
  )
}
