"use client"

import { BookOpen, Cpu, FlaskConical, Library, Scale, TestTubes, type LucideIcon } from "lucide-react"
import { useTheme } from "@/components/theme/ThemeProvider"
import { EVIDENCE_META, type EvidenceType } from "@/types/evidence"

const EVIDENCE_ICON: Record<EvidenceType, LucideIcon> = {
  REFERENCE: Library,
  LITERATURE: BookOpen,
  PREDICTED: Cpu,
  EXPERIMENTAL: TestTubes,
  SYNTHETIC: FlaskConical,
  INTERPRETATION: Scale,
  SIMULATION: Cpu,
}

const DARK_EVIDENCE: Record<EvidenceType, { color: string; bg: string; border: string }> = {
  REFERENCE: { color: "#94a3b8", bg: "rgba(148, 163, 184, 0.12)", border: "rgba(148, 163, 184, 0.28)" },
  LITERATURE: { color: "#c084fc", bg: "rgba(192, 132, 252, 0.12)", border: "rgba(192, 132, 252, 0.28)" },
  PREDICTED: { color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", border: "rgba(56, 189, 248, 0.28)" },
  EXPERIMENTAL: { color: "#34d399", bg: "rgba(52, 211, 153, 0.12)", border: "rgba(52, 211, 153, 0.28)" },
  SYNTHETIC: { color: "#fdba74", bg: "rgba(251, 146, 60, 0.12)", border: "rgba(251, 146, 60, 0.35)" },
  INTERPRETATION: { color: "#fbbf24", bg: "rgba(251, 191, 36, 0.12)", border: "rgba(251, 191, 36, 0.28)" },
  SIMULATION: { color: "#fb923c", bg: "rgba(251, 146, 60, 0.12)", border: "rgba(251, 146, 60, 0.28)" },
}

const LIGHT_EVIDENCE: Record<EvidenceType, { color: string; bg: string; border: string }> = {
  REFERENCE: { color: "#334155", bg: "#f1f5f9", border: "#cbd5e1" },
  LITERATURE: { color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
  PREDICTED: { color: "#0369a1", bg: "#e0f2fe", border: "#7dd3fc" },
  EXPERIMENTAL: { color: "#047857", bg: "#ecfdf5", border: "#6ee7b7" },
  SYNTHETIC: { color: "#c2410c", bg: "#fff7ed", border: "#fdba74" },
  INTERPRETATION: { color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  SIMULATION: { color: "#c2410c", bg: "#fff7ed", border: "#fdba74" },
}

interface EvidenceBadgeProps {
  type: EvidenceType
  size?: "sm" | "md"
  variant?: "default" | "workspace"
  className?: string
}

export function EvidenceBadge({ type, size = "sm", variant = "default", className = "" }: EvidenceBadgeProps) {
  const { theme } = useTheme()
  const meta = EVIDENCE_META[type]
  const isDark = theme === "dark"
  const tone = isDark ? DARK_EVIDENCE[type] : LIGHT_EVIDENCE[type]
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
  const Icon = EVIDENCE_ICON[type]
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-bold uppercase tracking-wider rounded border ${pad} ${className}`}
      style={{ color: tone.color, background: tone.bg, borderColor: tone.border }}
      title={meta.label}
    >
      {variant === "workspace" ? (
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: tone.color }} aria-hidden />
      ) : (
        <Icon size={size === "sm" ? 10 : 12} strokeWidth={2.25} aria-hidden />
      )}
      {meta.short}
    </span>
  )
}

export function EvidenceLegend() {
  const types = Object.keys(EVIDENCE_META) as EvidenceType[]
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {types.map((t) => (
        <EvidenceBadge key={t} type={t} />
      ))}
    </div>
  )
}
