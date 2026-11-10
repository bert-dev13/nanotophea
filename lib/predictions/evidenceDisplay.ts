import type { PredictionEndpoint, PredictionRun } from "@/lib/domain/models"
import { hasPredictionModel } from "@/lib/predictions/engine"
import { classifyPredictionProvenance } from "@/lib/predictions/provenanceClassification"

/** Researcher-facing badge classes for biological prediction assay UI. */
export type PredictionEvidenceDisplayClass =
  | "SIMULATION"
  | "PREDICTED"
  | "EXPERIMENTAL"
  | "NOT_AVAILABLE"

export interface PredictionEvidenceDisplay {
  class: PredictionEvidenceDisplayClass
  /** Compact title under the badge. */
  title: string
  /** One-sentence scientific framing. */
  summary: string
  /** Optional docking independence note for relevant assays. */
  dockingNote: string | null
  /** Link target for assumptions / limitations. */
  assumptionsHref: string
  showAssumptionsLink: boolean
  hasRegisteredModel: boolean
}

const ASSUMPTIONS_HREF = "#prediction-assumptions-limitations"

/** Endpoints where docking ΔG must not drive assay outputs. */
const DOCKING_INDEPENDENT: ReadonlySet<PredictionEndpoint> = new Set([
  "dpph",
  "mtt",
  "ldh",
  "ros",
  "bax",
])

export function dockingIndependenceNote(endpoint: PredictionEndpoint): string | null {
  if (DOCKING_INDEPENDENT.has(endpoint)) {
    return "Docking ΔG is not used as an MTT, LDH, ROS, BAX, or DPPH assay driver."
  }
  if (endpoint === "hippo_yap") {
    return "Hippo–YAP docking context is an exploratory pathway proxy only — not a wet-lab Western blot, qPCR, or microscopy measurement."
  }
  return null
}

/**
 * Resolve the UI evidence class without inventing validation.
 * PREDICTED requires a registered model and documented provenance identity.
 */
export function resolvePredictionEvidenceDisplay(
  endpoint: PredictionEndpoint,
  run?: Pick<
    PredictionRun,
    "endpoint" | "provenance" | "methodType" | "source" | "methodName" | "methodVersion" | "inputParameters"
  > | null,
  options?: { assumptionsHref?: string },
): PredictionEvidenceDisplay {
  const assumptionsHref = options?.assumptionsHref ?? ASSUMPTIONS_HREF
  const dockingNote = dockingIndependenceNote(endpoint)
  const registered = hasPredictionModel(endpoint)

  if (run?.provenance?.evidenceClass === "EXPERIMENTAL") {
    return {
      class: "EXPERIMENTAL",
      title: "Laboratory measurement",
      summary: "This value is an experimental laboratory measurement. It is not a computational prediction or simulation.",
      dockingNote,
      assumptionsHref,
      showAssumptionsLink: false,
      hasRegisteredModel: registered,
    }
  }

  const assessment = classifyPredictionProvenance(
    run
      ? run
      : {
          endpoint,
          provenance: { evidenceClass: "SIMULATION", recordedAt: "" },
          methodType: "exploratory_math",
          source: "Exploratory simulation",
          methodName: "",
          methodVersion: "",
          inputParameters: {},
        },
  )

  if (assessment.class === "documented_computational_prediction" && assessment.hasRegisteredModel) {
    return {
      class: "PREDICTED",
      title: "Documented computational prediction",
      summary:
        "Output comes from a registered predictive model with available method provenance. It is not an experimental laboratory measurement.",
      dockingNote,
      assumptionsHref,
      showAssumptionsLink: true,
      hasRegisteredModel: true,
    }
  }

  if (assessment.class === "exploratory_simulation" || (!run && !registered)) {
    return {
      class: "SIMULATION",
      title: "Exploratory Computational Result",
      summary:
        "Results are based on mathematical assumptions and are not scientifically validated predictions. Experimental measurements belong in Laboratory Validation.",
      dockingNote,
      assumptionsHref,
      showAssumptionsLink: true,
      hasRegisteredModel: registered,
    }
  }

  return {
    class: "NOT_AVAILABLE",
    title: "Evidence not available",
    summary:
      assessment.warning ??
      "No registered predictive model provenance is available for a PREDICTED classification, and this record is not an experimental measurement.",
    dockingNote,
    assumptionsHref,
    showAssumptionsLink: Boolean(run),
    hasRegisteredModel: registered,
  }
}
