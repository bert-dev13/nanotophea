"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { ProvenanceCard } from "@/components/research/ProvenanceCard"
import { FieldGrid, MetaField } from "@/components/research/FormFields"
import type { LabAssayConfig } from "@/lib/lab/labAssayConfig"
import {
  chartPointsFromSummaries,
  numericMeasurement,
} from "@/lib/lab/labCalculations"
import type { LabDataset, LabReplicate, LabTreatmentSummary } from "@/lib/domain/models"

export function LabBanner({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider"
      style={{ background: "#ecfdf5", borderColor: "#6ee7b7", color: "#047857" }}
    >
      {text} · <EvidenceBadge type="EXPERIMENTAL" size="md" className="ml-1 align-middle" />
    </div>
  )
}

export function TreatmentDesignCard({ config, dataset }: { config: LabAssayConfig; dataset?: LabDataset }) {
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#dde5ef" }}>
      <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider" style={{ background: "#f8fafc", color: "#546e8a" }}>
        Treatment design (locked)
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: "#546e8a" }}>
            <th className="text-left p-2 font-mono">Code</th>
            <th className="text-left p-2 font-mono">Treatment</th>
            <th className="text-left p-2 font-mono">Concentration</th>
          </tr>
        </thead>
        <tbody>
          {config.treatments.map((t) => (
            <tr key={t.code} style={{ borderTop: "1px solid #e2e8f0" }}>
              <td className="p-2 font-mono font-semibold">{t.code}</td>
              <td className="p-2">
                {t.label}
                {t.code === "T1" && dataset?.controlT1Detail ? (
                  <span className="block text-[10px]" style={{ color: "#64748b" }}>
                    Protocol: {dataset.controlT1Detail}
                  </span>
                ) : null}
                {t.code === "T2" && dataset?.controlT2Detail ? (
                  <span className="block text-[10px]" style={{ color: "#64748b" }}>
                    Protocol: {dataset.controlT2Detail}
                  </span>
                ) : null}
              </td>
              <td className="p-2 font-mono">
                {t.concentrationUgPerMl != null
                  ? `${t.concentrationUgPerMl} ${config.concentrationUnitLabel}`
                  : "— (per protocol)"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[10px]" style={{ color: "#94a3b8", background: "#f8fafc" }}>
        Replicates R1–R3 · Unit {config.concentrationUnitLabel} only · Evidence EXPERIMENTAL
      </p>
    </div>
  )
}

export function RawReplicatesTable({
  config,
  replicates,
}: {
  config: LabAssayConfig
  replicates: LabReplicate[]
}) {
  if (!replicates.length) {
    return (
      <p className="text-sm" style={{ color: "#94a3b8" }}>
        No raw experimental replicates recorded.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
          style={{ color: "#047857", background: "#ecfdf5", borderColor: "#6ee7b7" }}
        >
          RAW EXPERIMENTAL DATA
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "#dde5ef" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "#f8fafc", color: "#546e8a" }}>
              <th className="text-left p-2 font-mono">Treatment</th>
              <th className="text-left p-2 font-mono">Conc.</th>
              <th className="text-left p-2 font-mono">Rep</th>
              {config.measurementKeys.map((m) => (
                <th key={m.key} className="text-left p-2 font-mono">
                  {m.label}
                </th>
              ))}
              <th className="text-left p-2 font-mono">Notes</th>
            </tr>
          </thead>
          <tbody>
            {replicates.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td className="p-2 font-mono font-semibold">{r.treatmentCode}</td>
                <td className="p-2 font-mono">
                  {r.concentration != null
                    ? `${r.concentration} ${config.concentrationUnitLabel}`
                    : "—"}
                </td>
                <td className="p-2 font-mono">{r.replicateCode}</td>
                {config.measurementKeys.map((m) => {
                  const v = numericMeasurement(r, m.key)
                  return (
                    <td key={m.key} className="p-2 font-mono">
                      {v !== undefined ? v : "—"}
                    </td>
                  )
                })}
                <td className="p-2" style={{ color: "#546e8a" }}>
                  {r.notes || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DerivedSummaryPanel({
  config,
  summaries,
  ic50,
}: {
  config: LabAssayConfig
  summaries: LabTreatmentSummary[]
  ic50?: LabDataset["ic50"]
}) {
  const primary = summaries.filter((s) => s.metric === config.primaryMetricKey)
  const hasAny = primary.some((s) => s.mean !== undefined) || ic50

  if (!hasAny) {
    return (
      <p className="text-sm" style={{ color: "#94a3b8" }}>
        No derived summaries yet — enter raw replicates to compute mean ± SD.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
          style={{ color: "#b45309", background: "#fffbeb", borderColor: "#fcd34d" }}
        >
          DERIVED FROM EXPERIMENTAL DATA
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "#dde5ef" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "#f8fafc", color: "#546e8a" }}>
              <th className="text-left p-2 font-mono">Treatment</th>
              <th className="text-left p-2 font-mono">Metric</th>
              <th className="text-left p-2 font-mono">Mean</th>
              <th className="text-left p-2 font-mono">SD</th>
              <th className="text-left p-2 font-mono">n</th>
            </tr>
          </thead>
          <tbody>
            {primary.map((s) => (
              <tr key={`${s.treatmentCode}-${s.metric}`} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td className="p-2 font-mono font-semibold">{s.treatmentCode}</td>
                <td className="p-2 font-mono">{config.primaryMetricLabel}</td>
                <td className="p-2 font-mono">
                  {s.mean !== undefined ? s.mean.toFixed(4) : "—"}
                </td>
                <td className="p-2 font-mono">
                  {s.sd !== undefined ? s.sd.toFixed(4) : "—"}
                </td>
                <td className="p-2 font-mono">{s.n ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ic50 && (
        <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "#fcd34d", background: "#fffbeb" }}>
          <p className="font-semibold" style={{ color: "#92400e" }}>
            IC₅₀ (externally calculated — DERIVED FROM EXPERIMENTAL DATA)
          </p>
          <p style={{ color: "#78350f" }}>
            {ic50.value} {ic50.unit} · Method: {ic50.method}
            {ic50.calculatedBy ? ` · By: ${ic50.calculatedBy}` : ""}
          </p>
          {ic50.notes && <p style={{ color: "#a16207" }}>{ic50.notes}</p>}
        </div>
      )}
    </div>
  )
}

export function LabAssayChart({
  config,
  summaries,
}: {
  config: LabAssayConfig
  summaries: LabTreatmentSummary[]
}) {
  const concentrationByCode: Partial<
    Record<"T1" | "T2" | "T3" | "T4" | "T5" | "T6", number | undefined>
  > = Object.fromEntries(
    config.treatments
      .filter((t) => t.concentrationUgPerMl != null)
      .map((t) => [t.code, t.concentrationUgPerMl])
  )

  const primary = summaries.filter((s) => s.metric === config.primaryMetricKey)
  const data = chartPointsFromSummaries(primary, concentrationByCode).map((p) => {
    const row = primary.find((s) => s.treatmentCode === p.treatmentCode)
    return {
      ...p,
      sd: row?.sd ?? 0,
    }
  })

  if (!data.length) {
    return (
      <div
        className="rounded-lg border border-dashed px-4 py-10 text-center text-sm"
        style={{ borderColor: "#cbd5e1", color: "#94a3b8" }}
      >
        No laboratory results recorded for charting.
      </div>
    )
  }

  return (
    <div className="h-64 w-full rounded-lg border p-2" style={{ borderColor: "#dde5ef", background: "#ffffff" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="concentration"
            tick={{ fontSize: 11, fill: "#546e8a" }}
            label={{
              value: config.concentrationUnitLabel,
              position: "insideBottom",
              offset: -2,
              fontSize: 10,
              fill: "#94a3b8",
            }}
          />
          <YAxis tick={{ fontSize: 11, fill: "#546e8a" }} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value: number) => [value, config.primaryMetricLabel]}
            labelFormatter={(label) => `${label} ${config.concentrationUnitLabel}`}
          />
          <Bar dataKey="mean" fill="#00a882" name={config.primaryMetricLabel}>
            <ErrorBar dataKey="sd" width={4} stroke="#0d1f3c" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LabProvenanceCard({ dataset }: { dataset: LabDataset }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border px-3 py-2.5 space-y-2" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
        <div className="flex flex-wrap items-center gap-2">
          <EvidenceBadge type="EXPERIMENTAL" />
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#94a3b8" }}>
            Laboratory provenance
          </span>
        </div>
        <FieldGrid>
          <MetaField label="Laboratory" value={dataset.laboratoryName} />
          <MetaField label="Date performed" value={dataset.datePerformed} />
          <MetaField label="Protocol" value={dataset.protocolReference} />
          <MetaField label="Operator" value={dataset.operatorName} />
          <MetaField label="Outsourced lab" value={dataset.outsourcedLab ? "Yes" : "No"} />
          <MetaField label="Kit" value={[dataset.kitName, dataset.kitManufacturer].filter(Boolean).join(" / ") || undefined} />
          <MetaField label="Instrument" value={dataset.instrument} />
          <MetaField
            label="Wavelength"
            value={dataset.wavelengthNm != null ? `${dataset.wavelengthNm} nm` : undefined}
          />
          <MetaField label="Cell line" value={dataset.cellLineName} />
          <MetaField label="Status" value={dataset.status} />
        </FieldGrid>
        {dataset.notes && <MetaField label="Notes / limitations" value={dataset.notes} />}
      </div>
      <ProvenanceCard provenance={dataset.provenance} />
    </div>
  )
}
