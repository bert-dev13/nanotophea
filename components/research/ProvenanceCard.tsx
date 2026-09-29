"use client"

import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import type { Provenance } from "@/lib/domain/provenance"

export function ProvenanceCard({ provenance }: { provenance: Provenance }) {
  const rows: [string, string | undefined][] = [
    ["Evidence", provenance.evidenceClass],
    ["Source", provenance.source],
    ["Citation", provenance.citation],
    ["Retrieved", provenance.retrievedAt],
    ["Recorded", provenance.recordedAt],
    ["Method", provenance.methodName
      ? `${provenance.methodName}${provenance.methodVersion ? ` ${provenance.methodVersion}` : ""}`
      : undefined],
    ["Protocol", provenance.protocolRef],
    ["Assumptions", provenance.assumptions],
    ["Limitations", provenance.limitations],
  ]

  return (
    <div
      className="rounded-lg border px-3 py-2.5 space-y-2"
      style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}
    >
      <div className="flex items-center gap-2">
        <EvidenceBadge type={provenance.evidenceClass} />
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#94a3b8" }}>
          Provenance
        </span>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="font-mono uppercase text-[9px]" style={{ color: "#94a3b8" }}>
                {k}
              </dt>
              <dd style={{ color: "#1a3558" }}>{v}</dd>
            </div>
          ))}
      </dl>
    </div>
  )
}
