"use client"

import { EVIDENCE_META, type EvidenceType } from "@/types/evidence"

interface EvidenceBadgeProps {
  type: EvidenceType
  size?: "sm" | "md"
  className?: string
}

export function EvidenceBadge({ type, size = "sm", className = "" }: EvidenceBadgeProps) {
  const meta = EVIDENCE_META[type]
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
  return (
    <span
      className={`inline-flex items-center font-mono font-bold uppercase tracking-wider rounded border ${pad} ${className}`}
      style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}
      title={meta.label}
    >
      {meta.short}
    </span>
  )
}

export function EvidenceLegend() {
  const types = Object.keys(EVIDENCE_META) as EvidenceType[]
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-xs font-medium" style={{ color: "#546e8a" }}>Evidence:</span>
      {types.map((t) => (
        <EvidenceBadge key={t} type={t} />
      ))}
    </div>
  )
}
