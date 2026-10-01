"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  Atom,
  BarChart3,
  BookOpen,
  ChevronRight,
  Cpu,
  FlaskConical,
  Leaf,
  Library,
  Microscope,
  Play,
  Shield,
} from "lucide-react"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { useStudy } from "@/components/providers/StudyProvider"
import type { StudyStatus } from "@/lib/domain/models"

const WORKFLOW: {
  stage: string
  title: string
  summary: string
  href: string
  icon: LucideIcon
  accent: string
  soft: string
  border: string
  modules: string[]
}[] = [
  {
    stage: "01",
    title: "In-Silico",
    summary: "ADMET, docking imports, and documented assay predictions.",
    href: "/insilico/admet",
    icon: Cpu,
    accent: "#0e7490",
    soft: "#ecfeff",
    border: "#a5f3fc",
    modules: ["ADMET", "Docking", "Predictions"],
  },
  {
    stage: "02",
    title: "Laboratory",
    summary: "Experimental DPPH & LDH on HepG2, plus characterization.",
    href: "/lab/dpph",
    icon: FlaskConical,
    accent: "#0f766e",
    soft: "#f0fdfa",
    border: "#99f6e4",
    modules: ["DPPH", "LDH", "Characterization"],
  },
  {
    stage: "03",
    title: "Analysis",
    summary: "Statistics, prediction vs experimental, interpretation.",
    href: "/analysis/compare",
    icon: BarChart3,
    accent: "#c2410c",
    soft: "#fff7ed",
    border: "#fed7aa",
    modules: ["Statistics", "Compare", "Interpret"],
  },
]

const RESEARCH_LINKS: {
  href: string
  label: string
  icon: LucideIcon
  accent: string
  soft: string
}[] = [
  { href: "/research/formulation", label: "Formulation", icon: Leaf, accent: "#15803d", soft: "#f0fdf4" },
  { href: "/research/phytochemicals", label: "Phytochemicals", icon: FlaskConical, accent: "#0d9488", soft: "#f0fdfa" },
  { href: "/research/proteins", label: "Proteins", icon: Atom, accent: "#0369a1", soft: "#f0f9ff" },
  { href: "/research/cell-lines", label: "Cell Lines", icon: Microscope, accent: "#1d4ed8", soft: "#eff6ff" },
  { href: "/research/references", label: "References", icon: Library, accent: "#57534e", soft: "#fafaf9" },
]

const STATUS_META: Record<
  StudyStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  draft: { label: "Draft", color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" },
  active: { label: "Active", color: "#0f766e", bg: "#ccfbf1", border: "#5eead4" },
  analysis: { label: "Analysis", color: "#c2410c", bg: "#ffedd5", border: "#fdba74" },
  archived: { label: "Archived", color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
}

function primaryAction(status?: StudyStatus): { label: string; href: string } {
  switch (status) {
    case "analysis":
      return { label: "Open Analysis", href: "/analysis/compare" }
    case "archived":
      return { label: "View Interpretation", href: "/analysis/interpretation" }
    case "active":
      return { label: "Continue Research", href: "/insilico/admet" }
    default:
      return { label: "Continue Research", href: "/research/formulation" }
  }
}

export default function DashboardPanel() {
  const { activeStudy, studies, loading, error } = useStudy()
  const action = primaryAction(activeStudy?.status)
  const status = activeStudy ? STATUS_META[activeStudy.status] : null

  return (
    <div className="nano-dash space-y-5 sm:space-y-6">
      {/* Hero */}
      <section
        className="nano-dash-in nano-dash-hero relative overflow-hidden rounded-2xl border"
        style={{ borderColor: "#b8e6d6" }}
      >
        <div className="nano-dash-hero-wash" aria-hidden />
        <div className="relative p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-teal-800 ring-1 ring-teal-200/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />
                  Study home
                </span>
                {status ? (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1"
                    style={{
                      color: status.color,
                      background: status.bg,
                      boxShadow: `inset 0 0 0 1px ${status.border}`,
                    }}
                  >
                    {status.label}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-[1.65rem] sm:text-3xl font-semibold tracking-[-0.03em] text-slate-900 leading-[1.15]">
                {loading ? "Loading study…" : activeStudy?.title ?? "No study selected"}
              </h1>

              {(activeStudy?.shortTitle || activeStudy?.fairYear) && (
                <p className="mt-1.5 text-sm font-medium text-slate-600">
                  {[activeStudy.shortTitle, activeStudy.fairYear].filter(Boolean).join(" · ")}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {activeStudy?.primaryCellLine ? (
                  <MetaChip icon={Microscope} label={activeStudy.primaryCellLine} tone="teal" />
                ) : null}
                <MetaChip
                  icon={Shield}
                  label={`Contract ${activeStudy?.contractVersion ?? "—"}`}
                  tone="slate"
                />
                <MetaChip icon={Leaf} label="NanoHepatoTea" tone="green" />
              </div>

              {activeStudy?.formulationSummary ? (
                <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-slate-600">
                  <span className="font-semibold text-slate-800">Formulation</span>
                  {" — "}
                  {activeStudy.formulationSummary}
                </p>
              ) : null}
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[15rem]">
              <Link href={action.href} className="nano-dash-cta group">
                <Play size={14} strokeWidth={2.25} className="opacity-90" aria-hidden />
                {action.label}
                <ArrowRight
                  size={15}
                  className="ml-auto transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link href="/analysis/interpretation" className="nano-dash-cta-secondary group">
                <BookOpen size={14} strokeWidth={1.75} aria-hidden />
                Interpretation
                <ChevronRight
                  size={14}
                  className="ml-auto text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-teal-700"
                  aria-hidden
                />
              </Link>
            </div>
          </div>

          <div className="nano-dash-notice mt-5 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-teal-600/10 text-teal-700">
              <Shield size={12} strokeWidth={2} aria-hidden />
            </span>
            <p className="text-[12px] leading-snug text-slate-600">
              Predictions support hypotheses; laboratory results test them. Every output carries an
              explicit evidence class.
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div
          className="nano-dash-in rounded-xl border px-4 py-3 text-sm"
          style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c", animationDelay: "40ms" }}
        >
          {error}
        </div>
      ) : null}

      {!loading && !activeStudy ? <EmptyStudyState studyCount={studies.length} /> : null}

      {/* Pipeline path */}
      <section className="nano-dash-in" style={{ animationDelay: "50ms" }}>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Research workflow</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              In-Silico → Laboratory → Analysis → Interpretation
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            <span className="ml-1">3 stages</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
          {WORKFLOW.map((stage, i) => {
            const Icon = stage.icon
            return (
              <div key={stage.title} className="contents">
                <Link
                  href={stage.href}
                  className="nano-dash-stage group"
                  style={{
                    ["--stage-accent" as string]: stage.accent,
                    ["--stage-soft" as string]: stage.soft,
                    ["--stage-border" as string]: stage.border,
                    animationDelay: `${70 + i * 55}ms`,
                  }}
                >
                  <div className="nano-dash-stage-rail" aria-hidden />
                  <div className="flex items-center gap-2.5">
                    <div className="nano-dash-stage-icon shrink-0">
                      <Icon size={18} strokeWidth={1.75} aria-hidden />
                    </div>
                    <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-900">
                      {stage.title}
                    </h3>
                    <span className="shrink-0 font-mono text-[10px] font-bold tracking-wider opacity-70">
                      {stage.stage}
                    </span>
                  </div>
                  <p className="mt-2.5 flex-1 text-[12.5px] leading-relaxed text-slate-600">
                    {stage.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {stage.modules.map((m) => (
                      <span key={m} className="nano-dash-stage-tag">
                        {m}
                      </span>
                    ))}
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold">
                    Open stage
                    <ArrowRight
                      size={13}
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>

                {i < WORKFLOW.length - 1 ? (
                  <div
                    className="nano-dash-connector hidden md:flex"
                    aria-hidden
                    style={{ animationDelay: `${95 + i * 55}ms` }}
                  >
                    <ChevronRight size={18} strokeWidth={2} />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* Research data */}
      <section className="nano-dash-in" style={{ animationDelay: "140ms" }}>
        <div className="mb-3">
          <h2 className="text-[15px] font-semibold text-slate-900">Research data</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Catalogs that ground predictions and experiments
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {RESEARCH_LINKS.map((item, i) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="nano-dash-tile group"
                style={{
                  ["--tile-accent" as string]: item.accent,
                  ["--tile-soft" as string]: item.soft,
                  animationDelay: `${160 + i * 35}ms`,
                }}
              >
                <span className="nano-dash-tile-icon shrink-0">
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 truncate text-[12.5px] font-semibold text-slate-800 leading-tight">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Formulation */}
      {activeStudy ? (
        <section className="nano-dash-in" style={{ animationDelay: "200ms" }}>
          <Link href="/research/formulation" className="nano-dash-formula group">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <EvidenceBadge type="REFERENCE" />
                <span className="text-[12px] font-semibold text-slate-800">Formulation reference</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                {activeStudy.formulationSummary}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-700 px-3 py-2 text-[12px] font-semibold text-white transition-[filter,transform] duration-200 group-hover:brightness-110">
              Open
              <ArrowRight size={13} aria-hidden />
            </span>
          </Link>
        </section>
      ) : null}
    </div>
  )
}

function MetaChip({
  icon: Icon,
  label,
  tone,
}: {
  icon: LucideIcon
  label: string
  tone: "teal" | "slate" | "green"
}) {
  const tones = {
    teal: { bg: "#ccfbf1", color: "#115e59", border: "#99f6e4" },
    slate: { bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" },
    green: { bg: "#dcfce7", color: "#166534", border: "#86efac" },
  }[tone]

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold"
      style={{ background: tones.bg, color: tones.color, boxShadow: `inset 0 0 0 1px ${tones.border}` }}
    >
      <Icon size={12} strokeWidth={2} aria-hidden />
      {label}
    </span>
  )
}

function EmptyStudyState({ studyCount }: { studyCount: number }) {
  return (
    <div
      className="nano-dash-in rounded-2xl border border-dashed bg-gradient-to-b from-teal-50/80 to-white px-5 py-10 text-center"
      style={{ borderColor: "#99f6e4", animationDelay: "40ms" }}
    >
      <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
        <Leaf size={20} aria-hidden />
      </div>
      <h2 className="text-[15px] font-semibold text-slate-900">Create or select a study</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] text-slate-600">
        {studyCount === 0
          ? "Use + in the top bar to create your first study."
          : "Choose an active study from the top bar to continue."}
      </p>
    </div>
  )
}
