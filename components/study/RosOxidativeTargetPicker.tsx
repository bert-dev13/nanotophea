"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import type { DockingRun, Protein } from "@/lib/domain/models"
import {
  resolveRosOxidativeTargetViews,
  type RosOxidativeTargetView,
} from "@/lib/predictions/rosOxidativeTargets"

export function RosOxidativeTargetPicker({
  selectedKeys,
  onChange,
  proteins,
  docking,
  compoundId,
  disabled = false,
}: {
  selectedKeys: string[]
  onChange: (keys: string[]) => void
  proteins: Protein[]
  docking: DockingRun[]
  compoundId?: string
  disabled?: boolean
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const views = useMemo(
    () =>
      resolveRosOxidativeTargetViews({
        selectedKeys,
        proteins,
        docking,
        compoundId,
      }),
    [selectedKeys, proteins, docking, compoundId],
  )
  const selectedCount = views.filter((row) => row.selected).length

  function toggle(key: string) {
    if (disabled) return
    onChange(
      selectedKeys.includes(key) ? selectedKeys.filter((item) => item !== key) : [...selectedKeys, key],
    )
  }

  return (
    <section className="phyto-block" style={{ marginTop: "1rem" }}>
      <h3>Oxidative stress protein targets</h3>
      <p className="phyto-caption">
        Select one or more curated oxidative-stress proteins as investigation context for this ROS exploratory
        simulation. Selection is stored for traceability. It does not change the ROS index formula, and docking
        affinity is not a ROS or expression measurement.
      </p>

      <div
        style={{
          marginTop: "0.65rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.45rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "12px", color: "#92400e" }}>
          {selectedCount ? `${selectedCount} selected` : "None selected"} · exploratory context only
        </span>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button
            type="button"
            className="phyto-select"
            data-on="false"
            disabled={disabled}
            onClick={() => onChange(views.map((row) => row.key))}
          >
            Select all
          </button>
          <button
            type="button"
            className="phyto-select"
            data-on="false"
            disabled={disabled || selectedCount === 0}
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
      </div>

      <ul className="ros-target-list" style={{ listStyle: "none", margin: "0.75rem 0 0", padding: 0, display: "grid", gap: "0.55rem" }}>
        {views.map((row) => (
          <RosTargetRow
            key={row.key}
            row={row}
            expanded={expandedKey === row.key}
            disabled={disabled}
            onToggle={() => toggle(row.key)}
            onExpand={() => setExpandedKey((current) => (current === row.key ? null : row.key))}
          />
        ))}
      </ul>
    </section>
  )
}

function RosTargetRow({
  row,
  expanded,
  disabled,
  onToggle,
  onExpand,
}: {
  row: RosOxidativeTargetView
  expanded: boolean
  disabled: boolean
  onToggle: () => void
  onExpand: () => void
}) {
  const dockingLabel =
    row.dockingSuitability === "curated_docking_receptor"
      ? row.dockingAffinityKcalMol != null
        ? `Docking on file (${row.dockingAffinityKcalMol.toFixed(2)} kcal/mol) — separate from ROS`
        : "Curated docking receptor available (run Molecular Docking separately)"
      : row.dockingSuitability === "pathway_partner_not_receptor"
        ? "Pathway partner — not a curated docking receptor"
        : "No curated docking profile"

  return (
    <li
      style={{
        border: row.selected ? "1px solid #f59e0b" : "1px solid #e2e8f0",
        borderRadius: "8px",
        background: row.selected ? "#fffbeb" : "#ffffff",
        padding: "0.7rem 0.8rem",
      }}
    >
      <div style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start" }}>
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-pressed={row.selected}
          aria-label={`${row.selected ? "Deselect" : "Select"} ${row.geneSymbol}`}
          style={{
            width: 22,
            height: 22,
            marginTop: 2,
            borderRadius: 4,
            border: row.selected ? "1px solid #d97706" : "1px solid #cbd5e1",
            background: row.selected ? "#f59e0b" : "#fff",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {row.selected ? <Check size={13} strokeWidth={3} aria-hidden /> : null}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem 0.7rem", alignItems: "baseline" }}>
            <strong style={{ fontSize: "14px", color: "#0f172a" }}>{row.proteinName}</strong>
            <code style={{ fontSize: "12px", color: "#b45309" }}>{row.geneSymbol}</code>
            {row.aliases.filter((alias) => alias !== row.geneSymbol).map((alias) => (
              <span key={alias} style={{ fontSize: "11px", color: "#64748b" }}>
                also {alias}
              </span>
            ))}
          </div>
          <p style={{ margin: "0.3rem 0 0", fontSize: "12.5px", lineHeight: 1.45, color: "#475569" }}>
            {row.biologicalFunction}
          </p>
          <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            <StatusChip
              label={row.inStudy ? `In study: ${row.studyProtein?.name ?? row.geneSymbol}` : "Not yet in study proteins"}
              tone={row.inStudy ? "ok" : "muted"}
            />
            <StatusChip
              label={
                row.structureAvailability === "curated_experimental_structure"
                  ? `Structure PDB ${row.curatedPdbId}`
                  : row.structureAvailability === "study_protein_structure_claim"
                    ? `Study structure claim ${row.studyProtein?.pdbId}`
                    : "No curated structure ID"
              }
              tone={row.structureAvailability === "curated_experimental_structure" ? "ok" : "warn"}
            />
            <StatusChip label={dockingLabel} tone={row.dockingSuitability === "curated_docking_receptor" ? "ok" : "muted"} />
          </div>

          <button
            type="button"
            onClick={onExpand}
            style={{
              marginTop: "0.45rem",
              border: "none",
              background: "transparent",
              color: "#92400e",
              fontSize: "12px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: 0,
              cursor: "pointer",
            }}
          >
            {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            {expanded ? "Hide protein details" : "View protein details & structures"}
          </button>

          {expanded ? (
            <div
              style={{
                marginTop: "0.55rem",
                padding: "0.65rem 0.75rem",
                borderRadius: 6,
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                fontSize: "12.5px",
                lineHeight: 1.5,
                color: "#7c2d12",
              }}
            >
              <p style={{ margin: 0 }}>
                <strong>Pathway:</strong> {row.pathway}
              </p>
              <p style={{ margin: "0.35rem 0 0" }}>
                <strong>UniProt:</strong> {row.uniprotIds.join(", ")}
              </p>
              <p style={{ margin: "0.35rem 0 0" }}>
                <strong>Structure:</strong> {row.structureSummary}
              </p>
              <p style={{ margin: "0.35rem 0 0" }}>
                <strong>Docking:</strong> {row.dockingNotes}
                {row.dockingProfileId ? ` Profile ${row.dockingProfileId}.` : ""}
              </p>
              {row.studyProtein?.structureContext ? (
                <p style={{ margin: "0.35rem 0 0" }}>
                  <strong>Study structure context:</strong> {row.studyProtein.structureContext}
                </p>
              ) : null}
              <p style={{ margin: "0.45rem 0 0", display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
                {row.uniprotIds.map((id) => (
                  <a
                    key={id}
                    href={`https://www.uniprot.org/uniprotkb/${id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#b45309", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    UniProt {id} <ExternalLink size={12} aria-hidden />
                  </a>
                ))}
                {row.curatedPdbId || row.studyProtein?.pdbId ? (
                  <a
                    href={`https://www.rcsb.org/structure/${(row.curatedPdbId || row.studyProtein?.pdbId || "").toUpperCase()}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#b45309", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    RCSB {(row.curatedPdbId || row.studyProtein?.pdbId || "").toUpperCase()}{" "}
                    <ExternalLink size={12} aria-hidden />
                  </a>
                ) : null}
              </p>
              <p style={{ margin: "0.45rem 0 0", fontSize: "11.5px", color: "#9a3412" }}>
                Not an experimentally measured biomarker unless Laboratory data are supplied. Add the protein in Research
                Setup to link a study record and available structures before docking.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function StatusChip({ label, tone }: { label: string; tone: "ok" | "warn" | "muted" }) {
  const styles =
    tone === "ok"
      ? { background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }
      : tone === "warn"
        ? { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" }
        : { background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }
  return (
    <span
      style={{
        ...styles,
        fontSize: "11px",
        padding: "0.15rem 0.45rem",
        borderRadius: 999,
        lineHeight: 1.3,
      }}
    >
      {label}
    </span>
  )
}
