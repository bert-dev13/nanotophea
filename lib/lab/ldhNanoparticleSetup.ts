/**
 * Optional nanoparticle treatment context for experimental LDH.
 * Metadata only — does not alter LDH % cytotoxicity math or invent SI values.
 */

export type LdhNanoparticleChoice = "include" | "skip"

export interface LdhNanoparticleSetup {
  choice: LdhNanoparticleChoice
  /** Researcher-selected or free-text treatment description when choice === "include". */
  treatmentLabel?: string
  /** Study nanoparticle_formulations.id when linking the recorded Chitosan–TPP system. */
  nanoparticleRecordId?: string
  source: "study_record" | "researcher_specified" | "skipped"
}

export function emptyLdhNanoparticleSetup(): LdhNanoparticleSetup | null {
  return null
}

export function normalizeLdhNanoparticleSetup(
  value: unknown,
): LdhNanoparticleSetup | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (row.choice !== "include" && row.choice !== "skip") return null
  if (row.choice === "skip") {
    return { choice: "skip", source: "skipped" }
  }
  const treatmentLabel =
    typeof row.treatmentLabel === "string" && row.treatmentLabel.trim()
      ? row.treatmentLabel.trim()
      : undefined
  const nanoparticleRecordId =
    typeof row.nanoparticleRecordId === "string" && row.nanoparticleRecordId.trim()
      ? row.nanoparticleRecordId.trim()
      : undefined
  const source =
    row.source === "study_record" || row.source === "researcher_specified"
      ? row.source
      : nanoparticleRecordId
        ? "study_record"
        : "researcher_specified"
  return {
    choice: "include",
    source,
    ...(treatmentLabel ? { treatmentLabel } : {}),
    ...(nanoparticleRecordId ? { nanoparticleRecordId } : {}),
  }
}

export function validateLdhNanoparticleSetup(
  setup: LdhNanoparticleSetup | null | undefined,
): LdhNanoparticleSetup {
  if (!setup) {
    throw new Error("Choose whether to include a nanoparticle treatment for this LDH assay.")
  }
  if (setup.choice === "skip") {
    return { choice: "skip", source: "skipped" }
  }
  const label = setup.treatmentLabel?.trim()
  if (!label) {
    throw new Error("Specify the nanoparticle treatment used, or choose Skip.")
  }
  return {
    choice: "include",
    treatmentLabel: label,
    source: setup.nanoparticleRecordId ? "study_record" : "researcher_specified",
    ...(setup.nanoparticleRecordId ? { nanoparticleRecordId: setup.nanoparticleRecordId } : {}),
  }
}

export function ldhTreatmentSampleLabel(setup: LdhNanoparticleSetup | null | undefined): string {
  if (setup?.choice === "include" && setup.treatmentLabel?.trim()) {
    return `HepatoTea · ${setup.treatmentLabel.trim()}`
  }
  if (setup?.choice === "skip") return "HepatoTea (no nanoparticle)"
  return "HepatoTea"
}

export function ldhNanoparticleSetupSummary(setup: LdhNanoparticleSetup | null | undefined): string {
  if (!setup) return "Nanoparticle treatment not specified"
  if (setup.choice === "skip") return "Nanoparticle skipped — free / non-nanoparticle setup"
  return `Nanoparticle included — ${setup.treatmentLabel?.trim() || "treatment label not recorded"}`
}

/**
 * Selectivity Index is never invented from LDH absorbance alone.
 * Message reflects the recorded experimental setup only.
 */
export function ldhSelectivityIndexDisplay(input: {
  setup: LdhNanoparticleSetup | null | undefined
  ic50Value?: number | null
  ic50Method?: string | null
}): { label: string; value: string; note: string } {
  const setupLine = ldhNanoparticleSetupSummary(input.setup)
  if (input.setup?.choice === "skip") {
    return {
      label: "Selectivity Index",
      value: "Not calculated",
      note: `${setupLine}. SI is not derived from this single LDH setup. Paired IC50 values (e.g. cancer vs normal, or free extract vs nanoparticle) were not supplied for SI.`,
    }
  }
  if (input.setup?.choice === "include") {
    if (input.ic50Value != null && Number.isFinite(input.ic50Value) && input.ic50Method?.trim()) {
      return {
        label: "Selectivity Index",
        value: "Not calculated from LDH alone",
        note: `${setupLine}. Recorded IC50 ${input.ic50Value} (${input.ic50Method.trim()}) is shown with results when entered. SI still requires a paired comparator IC50 for the actual nanoparticle vs free (or normal vs cancer) design — not invented here.`,
      }
    }
    return {
      label: "Selectivity Index",
      value: "Not calculated",
      note: `${setupLine}. No paired IC50 comparator was recorded for this nanoparticle LDH setup. SI is not invented from absorbance or from nanoparticle inclusion alone.`,
    }
  }
  return {
    label: "Selectivity Index",
    value: "Not available",
    note: "Nanoparticle inclusion has not been recorded for this LDH run. SI is not assumed.",
  }
}
