"use client"

import {
  PHYTOCHEMICAL_ANALYSIS_VIEW_LABEL,
  type PhytochemicalAnalysisViewMode,
} from "@/lib/phytochemicals/analysisView"

export function PhytochemicalAnalysisViewToggle({
  mode,
  onChange,
  compoundCount,
}: {
  mode: PhytochemicalAnalysisViewMode
  onChange: (mode: PhytochemicalAnalysisViewMode) => void
  compoundCount: number
}) {
  return (
    <div
      className="phyto-analysis-view-toggle"
      role="group"
      aria-label="Phytochemical analysis view"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.45rem",
        alignItems: "center",
        margin: "0.75rem 0 0",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#64748b",
          marginRight: "0.15rem",
        }}
      >
        Analysis view
      </span>
      {(["individual", "combined"] as const).map((option) => (
        <button
          key={option}
          type="button"
          className="phyto-select"
          data-on={mode === option ? "true" : "false"}
          aria-pressed={mode === option}
          onClick={() => onChange(option)}
        >
          {option === "individual" ? "Individual phytochemicals" : "Combined tea formulation"}
        </button>
      ))}
      <span style={{ fontSize: "12px", color: "#64748b" }}>
        {PHYTOCHEMICAL_ANALYSIS_VIEW_LABEL[mode]}
        {compoundCount > 0 ? ` · ${compoundCount} selected` : ""}
      </span>
    </div>
  )
}
