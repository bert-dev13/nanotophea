/**
 * Exploratory simulation acknowledgement contract.
 * Server stamps actor/time/version; clients must not invent actor identity.
 */

export const EXPLORATORY_ACKNOWLEDGEMENT_VERSION = "hepatotea-exploratory-ack-v1"

export const EXPLORATORY_ACKNOWLEDGEMENT_TEXT =
  "I understand this run is an exploratory simulation (evidence class SIMULATION). It is not a validated predictive model, not an experimental laboratory measurement, and must not be reported as assay truth."

export interface ExploratoryAcknowledgementRecord {
  acknowledgedExploratory: true
  acknowledgedAt: string
  acknowledgedBy: string
  endpoint: string
  acknowledgementVersion: typeof EXPLORATORY_ACKNOWLEDGEMENT_VERSION
  acknowledgementText: typeof EXPLORATORY_ACKNOWLEDGEMENT_TEXT
  /** Present after the biological_predictions row is created. */
  simulationRunId?: string
}

export function stampExploratoryAcknowledgement(input: {
  endpoint: string
  actorId: string
  acknowledgedAt?: string
  simulationRunId?: string
}): ExploratoryAcknowledgementRecord {
  return {
    acknowledgedExploratory: true,
    acknowledgedAt: input.acknowledgedAt ?? new Date().toISOString(),
    acknowledgedBy: input.actorId,
    endpoint: input.endpoint,
    acknowledgementVersion: EXPLORATORY_ACKNOWLEDGEMENT_VERSION,
    acknowledgementText: EXPLORATORY_ACKNOWLEDGEMENT_TEXT,
    ...(input.simulationRunId ? { simulationRunId: input.simulationRunId } : {}),
  }
}

/** Writes acknowledgement fields into prediction input_parameters (no schema migration). */
export function acknowledgementToInputParameters(
  ack: ExploratoryAcknowledgementRecord,
): Record<string, string | number | boolean | null> {
  return {
    "meta:acknowledgedExploratory": true,
    "meta:acknowledgedAt": ack.acknowledgedAt,
    "meta:acknowledgedBy": ack.acknowledgedBy,
    "meta:acknowledgementVersion": ack.acknowledgementVersion,
    "meta:acknowledgementText": ack.acknowledgementText,
    ...(ack.simulationRunId ? { "meta:simulationRunId": ack.simulationRunId } : {}),
  }
}

export function readAcknowledgementFromParameters(
  inputParameters?: Record<string, string | number | boolean | null> | null,
): {
  present: boolean
  historicalMissingConsent: boolean
  acknowledgedExploratory: boolean
  acknowledgedAt?: string
  acknowledgedBy?: string
  acknowledgementVersion?: string
  simulationRunId?: string
} {
  if (!inputParameters) {
    return { present: false, historicalMissingConsent: true, acknowledgedExploratory: false }
  }
  const flagged = inputParameters["meta:acknowledgedExploratory"] === true
  if (!flagged) {
    return { present: false, historicalMissingConsent: true, acknowledgedExploratory: false }
  }
  return {
    present: true,
    historicalMissingConsent: false,
    acknowledgedExploratory: true,
    acknowledgedAt:
      typeof inputParameters["meta:acknowledgedAt"] === "string"
        ? inputParameters["meta:acknowledgedAt"]
        : undefined,
    acknowledgedBy:
      typeof inputParameters["meta:acknowledgedBy"] === "string"
        ? inputParameters["meta:acknowledgedBy"]
        : undefined,
    acknowledgementVersion:
      typeof inputParameters["meta:acknowledgementVersion"] === "string"
        ? inputParameters["meta:acknowledgementVersion"]
        : undefined,
    simulationRunId:
      typeof inputParameters["meta:simulationRunId"] === "string"
        ? inputParameters["meta:simulationRunId"]
        : undefined,
  }
}

/** Ensures acknowledgement metadata references the actual persisted run id. */
export function bindAcknowledgementSimulationRunId(
  inputParameters: Record<string, string | number | boolean | null> | undefined,
  runId: string,
): Record<string, string | number | boolean | null> | undefined {
  if (!inputParameters) return inputParameters
  if (inputParameters["meta:acknowledgedExploratory"] !== true) return inputParameters
  return { ...inputParameters, "meta:simulationRunId": runId }
}

export function assertAcknowledgementActorIsServer(
  acknowledgement: ExploratoryAcknowledgementRecord,
  authenticatedActorId: string,
): void {
  if (!authenticatedActorId || acknowledgement.acknowledgedBy !== authenticatedActorId) {
    throw new Error("Acknowledgement actor does not match the authenticated session.")
  }
}
