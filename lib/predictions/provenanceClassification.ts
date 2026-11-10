import type { PredictionRun } from "@/lib/domain/models"
import { hasPredictionModel } from "@/lib/predictions/engine"
import { readAcknowledgementFromParameters } from "@/lib/predictions/acknowledgement"

/**
 * Researcher-facing provenance classes for prediction/lab-adjacent records.
 * PREDICTED evidenceClass alone is NOT proof of a registered validated model.
 */
export type PredictionProvenanceClass =
  | "experimental_laboratory"
  | "exploratory_simulation"
  | "documented_computational_prediction"
  | "historical_unverified_provenance"

export interface PredictionProvenanceAssessment {
  class: PredictionProvenanceClass
  label: string
  warning: string | null
  hasRegisteredModel: boolean
  acknowledgementPresent: boolean
  historicalMissingConsent: boolean
  reasons: string[]
}

export function classifyPredictionProvenance(
  run?: Pick<
    PredictionRun,
    "endpoint" | "provenance" | "methodType" | "source" | "methodName" | "methodVersion" | "inputParameters"
  > | null,
): PredictionProvenanceAssessment {
  if (!run) {
    return {
      class: "historical_unverified_provenance",
      label: "No prediction record",
      warning: "No prediction provenance is available.",
      hasRegisteredModel: false,
      acknowledgementPresent: false,
      historicalMissingConsent: true,
      reasons: ["missing_run"],
    }
  }

  const evidence = run.provenance?.evidenceClass
  const registered = hasPredictionModel(run.endpoint)
  const ack = readAcknowledgementFromParameters(run.inputParameters)
  const reasons: string[] = []

  if (evidence === "SIMULATION" || run.methodType === "exploratory_math" || /exploratory simulation/i.test(run.source ?? "")) {
    reasons.push("evidence_or_method_marks_simulation")
    if (!ack.present) reasons.push("historical_missing_acknowledgement")
    return {
      class: "exploratory_simulation",
      label: "Exploratory simulation (SIMULATION)",
      warning: ack.present
        ? null
        : "Historical run: exploratory acknowledgement metadata is missing. Result is preserved but consent was not recorded under the current audit format.",
      hasRegisteredModel: registered,
      acknowledgementPresent: ack.present,
      historicalMissingConsent: ack.historicalMissingConsent,
      reasons,
    }
  }

  if (evidence === "PREDICTED" || run.methodType === "documented_model" || run.methodType === "external_tool") {
    const hasIdentity = Boolean(run.methodName?.trim() && run.source?.trim())
    const hasVersion = Boolean(run.methodVersion?.trim())
    if (registered && hasIdentity) {
      reasons.push("registered_model_and_method_identity")
      return {
        class: "documented_computational_prediction",
        label: "Documented computational prediction (PREDICTED)",
        warning: hasVersion ? null : "Model version is missing; treat method identity as incomplete.",
        hasRegisteredModel: true,
        acknowledgementPresent: ack.present,
        historicalMissingConsent: ack.historicalMissingConsent,
        reasons,
      }
    }
    reasons.push(registered ? "missing_method_identity" : "no_registered_model")
    if (!hasIdentity) reasons.push("incomplete_method_fields")
    return {
      class: "historical_unverified_provenance",
      label: "Historical / unverified computational record",
      warning:
        "This record is labeled PREDICTED or documented_model, but no registered validated model is available (or method identity is incomplete). Do not treat it as validated scientific evidence.",
      hasRegisteredModel: registered,
      acknowledgementPresent: ack.present,
      historicalMissingConsent: ack.historicalMissingConsent,
      reasons,
    }
  }

  reasons.push("unrecognized_provenance")
  return {
    class: "historical_unverified_provenance",
    label: "Historical / unverifiable provenance",
    warning: "Provenance fields are incomplete or unrecognized. Preserve the record; do not present it as validated science.",
    hasRegisteredModel: registered,
    acknowledgementPresent: ack.present,
    historicalMissingConsent: ack.historicalMissingConsent,
    reasons,
  }
}
