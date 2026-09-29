"use client"

import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import type { PredictionRun } from "@/lib/domain/models"
import type { PredictionEndpointConfig } from "@/lib/insilico/predictionEndpoints"
import { ProvenanceCard } from "@/components/research/ProvenanceCard"
import { FieldGrid, MetaField } from "@/components/research/FormFields"

export function PredictionMethodCard({
  run,
  config,
}: {
  run: PredictionRun
  config: PredictionEndpointConfig
}) {
  return (
    <div className="rounded-lg border px-3 py-2.5 space-y-2" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
      <div className="flex flex-wrap items-center gap-2">
        <EvidenceBadge type={run.provenance.evidenceClass} />
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#94a3b8" }}>
          Method & provenance
        </span>
      </div>
      <FieldGrid>
        <MetaField label="Method" value={run.methodName} />
        <MetaField label="Version" value={run.methodVersion} />
        <MetaField label="Method type" value={run.methodType} />
        <MetaField label="Source" value={run.source} />
        <MetaField label="Date generated" value={run.dateGenerated} />
        <MetaField label="Operator" value={run.operatorName} />
        <MetaField label="Concentration unit" value={config.concentrationUnitLabel} />
      </FieldGrid>
      {run.assumptions && <MetaField label="Assumptions" value={run.assumptions} />}
      {run.limitations && <MetaField label="Limitations" value={run.limitations} />}
      <ProvenanceCard provenance={run.provenance} />
    </div>
  )
}

export function PredictionResultsTable({
  run,
  unitLabel,
}: {
  run: PredictionRun
  unitLabel: string
}) {
  if (!run.resultPoints.length) {
    return (
      <p className="text-sm" style={{ color: "#94a3b8" }}>
        No computational results recorded.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "#dde5ef" }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: "#f8fafc", color: "#546e8a" }}>
            <th className="text-left p-2 font-mono">Concentration ({unitLabel})</th>
            <th className="text-left p-2 font-mono">Metric</th>
            <th className="text-left p-2 font-mono">Value</th>
            <th className="text-left p-2 font-mono">Unit</th>
            <th className="text-left p-2 font-mono">Notes</th>
          </tr>
        </thead>
        <tbody>
          {[...run.resultPoints]
            .sort((a, b) => a.concentration - b.concentration)
            .map((p, i) => (
              <tr key={i} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td className="p-2 font-mono">{p.concentration}</td>
                <td className="p-2 font-mono">{p.metric}</td>
                <td className="p-2 font-mono font-semibold">{p.value}</td>
                <td className="p-2 font-mono">{p.valueUnit}</td>
                <td className="p-2" style={{ color: "#546e8a" }}>
                  {p.notes || "—"}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

export function PredictionChart({
  run,
  unitLabel,
}: {
  run: PredictionRun
  unitLabel: string
}) {
  if (!run.resultPoints.length) {
    return (
      <div
        className="rounded-lg border border-dashed px-4 py-10 text-center text-sm"
        style={{ borderColor: "#cbd5e1", color: "#94a3b8" }}
      >
        No computational results recorded.
      </div>
    )
  }

  const data = [...run.resultPoints]
    .sort((a, b) => a.concentration - b.concentration)
    .map((p) => ({
      concentration: p.concentration,
      value: p.value,
      metric: p.metric,
    }))

  const metric = data[0]?.metric ?? "value"

  return (
    <div className="h-64 w-full rounded-lg border p-2" style={{ borderColor: "#dde5ef", background: "#ffffff" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="concentration"
            tick={{ fontSize: 11, fill: "#546e8a" }}
            label={{ value: unitLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "#94a3b8" }}
          />
          <YAxis tick={{ fontSize: 11, fill: "#546e8a" }} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value: number) => [value, metric]}
            labelFormatter={(label) => `${label} ${unitLabel}`}
          />
          <Line type="monotone" dataKey="value" stroke="#00a882" strokeWidth={2} dot={{ r: 3 }} name={metric} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
