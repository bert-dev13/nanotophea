/**
 * Optional Research Setup nanoparticle step.
 * Skip/configure choices are recorded on the study for traceability.
 * Missing nanoparticle configuration must not block In-Silico.
 */

export const NANOPARTICLE_SKIPPED_SUMMARY =
  "Nanoparticle formulation skipped (optional Research Setup step)"

export const NANOPARTICLE_CONFIGURED_PREFIX = "Nanoparticle formulation configured — "

export type NanoparticleFormulationChoiceStatus = "unresolved" | "skipped" | "configured"

export function nanoparticleChoiceFromStudy(input: {
  formulationSummary?: string | null
  nanoparticleConfigured?: boolean
}): NanoparticleFormulationChoiceStatus {
  if (input.nanoparticleConfigured) return "configured"
  const summary = (input.formulationSummary ?? "").trim()
  if (!summary) return "unresolved"
  if (summary === NANOPARTICLE_SKIPPED_SUMMARY || /^nanoparticle formulation skipped\b/i.test(summary)) {
    return "skipped"
  }
  if (summary.startsWith(NANOPARTICLE_CONFIGURED_PREFIX) || /^nanoparticle formulation configured\b/i.test(summary)) {
    return "configured"
  }
  return "unresolved"
}

export function skippedNanoparticleSummary(decidedAt = new Date().toISOString()): string {
  return `${NANOPARTICLE_SKIPPED_SUMMARY} · ${decidedAt.slice(0, 10)}`
}

export function configuredNanoparticleSummary(systemName?: string | null): string {
  const name = systemName?.trim() || "Chitosan–TPP nanoparticle system"
  return `${NANOPARTICLE_CONFIGURED_PREFIX}${name}`
}

export function nanoparticleChoiceLabel(status: NanoparticleFormulationChoiceStatus): string {
  if (status === "configured") return "Configured"
  if (status === "skipped") return "Skipped"
  return "Optional"
}
