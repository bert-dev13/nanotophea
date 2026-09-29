"use client"

import Link from "next/link"
import {
  LayoutDashboard, FlaskConical, Atom, Microscope,
  Shield, Cpu, Database, BookOpen, Zap, Beaker,
  AlertTriangle,
} from "lucide-react"
import { EvidenceBadge, EvidenceLegend } from "@/components/ui/EvidenceBadge"
import { NAV_GROUPS } from "@/data/navigation"
import { useStudy } from "@/components/providers/StudyProvider"
import { useAuth } from "@/components/providers/AuthProvider"

const PHASE_CARDS = [
  {
    title: "Phase 1 — In-Silico",
    desc: "ADMET, AutoDock Vina import, and documented predictions (DPPH, MTT, LDH, ROS, BAX, Hippo–YAP).",
    href: "/insilico/admet",
    color: "#0369a1",
  },
  {
    title: "Phase 2 — Laboratory",
    desc: "Experimental DPPH & LDH (HepG2; T1–T6; n=3) plus HPLC and characterization.",
    href: "/lab/dpph",
    color: "#047857",
  },
  {
    title: "Phase 3 — Analysis",
    desc: "Statistics, prediction vs experimental comparison, and researcher interpretation.",
    href: "/analysis/compare",
    color: "#b45309",
  },
]

export default function DashboardPanel() {
  const { profile } = useAuth()
  const { activeStudy, membership, studies, loading, error } = useStudy()

  return (
    <div className="space-y-6">
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#dde5ef" }}>
        <div className="px-5 py-6 sm:px-8" style={{ background: "linear-gradient(135deg, #e8f8f4 0%, #eef4ff 100%)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-white shadow-sm">
              <LayoutDashboard size={22} style={{ color: "#00a882" }} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black" style={{ color: "#0d1f3c" }}>Study Home</h1>
              <p className="text-sm font-semibold" style={{ color: "#00a882" }}>
                {activeStudy?.title ?? "No study selected"}
              </p>
            </div>
          </div>
          <p className="text-sm max-w-2xl leading-relaxed" style={{ color: "#2a5070" }}>
            Computational predictions support hypotheses; laboratory results test them.
            Signed in as <strong>{profile?.displayName}</strong>
            {membership?.role === "OWNER" ? <> · <strong>Administrator</strong></> : null}.
          </p>
          <div className="mt-4">
            <EvidenceLegend />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" }}>
          {error}
        </div>
      )}

      <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "#0d1f3c" }}>Active Firestore study</h2>
        {loading && <p className="text-xs" style={{ color: "#94a3b8" }}>Loading studies…</p>}
        {!loading && !activeStudy && (
          <p className="text-sm" style={{ color: "#546e8a" }}>
            Create a study from the toolbar above. The creator becomes <strong>OWNER</strong>.
          </p>
        )}
        {activeStudy && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              ["Title", activeStudy.title],
              ["Status", activeStudy.status],
              ["Primary cell line", activeStudy.primaryCellLine],
              ["Formulation", activeStudy.formulationSummary],
              ["Contract version", activeStudy.contractVersion],
              ["Studies available", String(studies.length)],
              ["Owner UID", activeStudy.ownerId],
              ["Updated", new Date(activeStudy.updatedAt).toLocaleString()],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] font-mono uppercase" style={{ color: "#94a3b8" }}>{k}</dt>
                <dd style={{ color: "#0d1f3c" }}>{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div
        className="rounded-xl border px-4 py-3 flex gap-3 items-start"
        style={{ background: "#fffbeb", borderColor: "#fcd34d" }}
      >
        <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: "#b45309" }} />
        <div className="text-sm" style={{ color: "#92400e" }}>
          <strong>Contract notice.</strong> Legacy demo scientific numbers remain quarantined and are{" "}
          <em>not</em> auto-migrated into Firestore. Firebase Storage is out of scope for this phase.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PHASE_CARDS.map((p) => (
          <Link
            key={p.title}
            href={p.href}
            className="rounded-xl border p-4 transition-shadow hover:shadow-md"
            style={{ background: "#ffffff", borderColor: "#dde5ef" }}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: p.color }}>
              Workflow
            </div>
            <h2 className="text-sm font-bold mb-1" style={{ color: "#0d1f3c" }}>{p.title}</h2>
            <p className="text-xs leading-relaxed" style={{ color: "#546e8a" }}>{p.desc}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "#0d1f3c" }}>Formulation (contract default)</h2>
        <div className="flex flex-wrap gap-2 mb-2">
          <EvidenceBadge type="REFERENCE" />
        </div>
        <p className="text-sm" style={{ color: "#2a5070" }}>
          {activeStudy?.formulationSummary ??
            "NanoHepatoTea tea bag: 2 g dried Phyllanthus niruri leaf + 1 g Chitosan–TPP."}
          {" "}Primary experimental cell line:{" "}
          <strong>{activeStudy?.primaryCellLine ?? "HepG2"}</strong>.
        </p>
        <Link href="/research/formulation" className="inline-block mt-3 text-xs font-semibold" style={{ color: "#00a882" }}>
          Open Formulation →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { href: "/research/phytochemicals", icon: FlaskConical, label: "Phytochemicals" },
          { href: "/research/proteins", icon: Atom, label: "Proteins" },
          { href: "/research/cell-lines", icon: Microscope, label: "Cell Lines" },
          { href: "/insilico/docking", icon: Cpu, label: "Docking" },
          { href: "/insilico/admet", icon: Shield, label: "ADMET" },
          { href: "/lab/dpph", icon: Zap, label: "Experimental DPPH" },
          { href: "/lab/characterization", icon: Database, label: "Characterization" },
          { href: "/analysis/interpretation", icon: BookOpen, label: "Interpretation" },
        ].map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border p-3 flex items-center gap-2 text-xs font-semibold hover:bg-slate-50"
              style={{ borderColor: "#dde5ef", color: "#1a3558" }}
            >
              <Icon size={14} style={{ color: "#00a882" }} />
              {item.label}
            </Link>
          )
        })}
      </div>

      <div className="rounded-xl border p-4" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
        <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#64748b" }}>
          Navigation map
        </h2>
        <ul className="text-xs space-y-1 font-mono" style={{ color: "#475569" }}>
          {NAV_GROUPS.map((g) => (
            <li key={g.id}>
              {g.label}: {g.links.map((l) => l.label).join(", ")}
              {g.children?.map((c) => ` · ${c.label} (${c.links.map((l) => l.label).join(", ")})`).join("")}
            </li>
          ))}
        </ul>
        <p className="text-xs mt-3 flex items-center gap-1" style={{ color: "#94a3b8" }}>
          <Beaker size={12} /> Firebase Auth + Firestore integrated · Storage deferred
        </p>
      </div>
    </div>
  )
}
