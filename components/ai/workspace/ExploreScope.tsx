"use client"

import {
  Atom,
  ChartNoAxesCombined,
  FlaskConical,
  Layers,
  Scale,
  ScanSearch,
  TestTubes,
  type LucideIcon,
} from "lucide-react"
import {
  askingAbout,
  stageLabel,
  type AnalysisChoice,
  type AssistantCatalog,
  type DockingChoice,
  type EndpointChoice,
  type ExploreStage,
} from "@/lib/ai/explore"

const STAGE_ICON: Record<ExploreStage, LucideIcon> = {
  entire: Layers,
  setup: FlaskConical,
  insilico: ScanSearch,
  docking: Atom,
  predictions: ChartNoAxesCombined,
  laboratory: TestTubes,
  analysis: Scale,
}

const STAGE_HINT: Record<ExploreStage, string> = {
  entire: "Overall study questions",
  setup: "Phytochemicals, targets, cell lines, formulation",
  insilico: "ADME and screening results",
  docking: "Docking runs, targets and binding affinities",
  predictions: "DPPH, MTT, LDH, ROS, BAX and Hippo–YAP predictions",
  laboratory: "Experimental laboratory results",
  analysis: "Prediction-versus-laboratory comparison, statistics, limitations and conclusions",
}

export function ExploreScope({
  catalog,
  stage,
  detail,
  disabled,
  onStage,
  onDetail,
  onClear,
}: {
  catalog: AssistantCatalog
  stage: ExploreStage
  detail: string | null
  disabled: boolean
  onStage: (stage: ExploreStage) => void
  onDetail: (detail: string | null) => void
  onClear: () => void
}) {
  const sub = subOptions(catalog, stage)
  const label = askingAbout(stage, detail)
  return (
    <div className="ai-explore">
      <h2>What do you want to explore?</h2>
      <div className="ai-chips" role="radiogroup" aria-label="What do you want to explore?">
        {catalog.stages.map((item) => {
          const Icon = STAGE_ICON[item]
          const selected = item === stage
          return (
            <button
              key={item}
              type="button"
              className="ai-chip"
              role="radio"
              aria-checked={selected}
              data-on={selected ? "true" : "false"}
              title={STAGE_HINT[item]}
              disabled={disabled}
              onClick={() => onStage(item)}
            >
              <Icon size={14} strokeWidth={1.85} aria-hidden />
              {shortStage(item)}
            </button>
          )
        })}
      </div>
      {sub.length > 0 ? (
        <div className="ai-chips ai-sub" role="radiogroup" aria-label={`${stageLabel(stage)} results`}>
          {sub.map((item) => {
            const selected = item.id === (detail ?? "")
            return (
              <button
                key={item.id || "all"}
                type="button"
                className="ai-chip"
                role="radio"
                aria-checked={selected}
                data-on={selected ? "true" : "false"}
                disabled={disabled}
                onClick={() => onDetail(item.id || null)}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      ) : null}
      <p className="ai-asking">
        Asking about: <strong>{label}</strong>
        {stage !== "entire" ? (
          <button type="button" onClick={onClear} disabled={disabled}>Clear</button>
        ) : null}
      </p>
    </div>
  )
}

function shortStage(stage: ExploreStage): string {
  if (stage === "insilico") return "In-Silico"
  if (stage === "docking") return "Docking"
  if (stage === "predictions") return "Predictions"
  if (stage === "laboratory") return "Laboratory"
  if (stage === "analysis") return "Analysis"
  return stageLabel(stage)
}

function subOptions(catalog: AssistantCatalog, stage: ExploreStage): Array<{ id: string; label: string }> {
  if (stage === "docking" && catalog.docking.length > 0) {
    return [{ id: "", label: "All Docking Results" }, ...catalog.docking.map(choiceLabel)]
  }
  if (stage === "predictions" && catalog.predictions.length > 0) {
    return [{ id: "", label: "All Predictions" }, ...catalog.predictions.map(choiceLabel)]
  }
  if (stage === "laboratory" && catalog.laboratory.length > 0) {
    return [{ id: "", label: "All Laboratory Results" }, ...catalog.laboratory.map(choiceLabel)]
  }
  if (stage === "analysis" && catalog.analysis.length > 0) return catalog.analysis.map(analysisLabel)
  return []
}

function choiceLabel(item: DockingChoice | EndpointChoice): { id: string; label: string } {
  return { id: item.label, label: item.label }
}

function analysisLabel(item: AnalysisChoice): { id: string; label: string } {
  return { id: item.label, label: item.label }
}
