import type { PredictionFeatures } from "@/lib/predictions/types"
import {
  clamp01,
  demonstrationFactor,
  hill,
  mix,
  round,
} from "@/lib/predictions/prototype/math"
import { finishPrototype, type PrototypePredictionResult } from "@/lib/predictions/prototype/types"

/** Formulation-oriented Hippo–YAP grid (µg/mL) per study design contract. */
const CONCENTRATIONS_UG_ML = [50, 100, 250, 500]

export const HIPPO_YAP_ASSUMPTIONS =
  "Exploratory SIMULATION of Hippo–YAP / YAP–TEAD pathway response from the selected Hippo-related target docking affinity and compound–target identity. Outputs are pathway proxies (YAP–TEAD residual activity, estimated suppression, p-YAP Ser127 heuristic, nuclear YAP residual). Not antioxidant DPPH radical-scavenging logic. Not Western blot, qPCR, or localization microscopy. Not a validated pathway model."

export type HippoTargetRole = "yap_tead" | "lats" | "other_hippo"

export function classifyHippoTargetRole(label: string): HippoTargetRole {
  if (/lats/i.test(label)) return "lats"
  if (/yap|tead|wwtr1|taz/i.test(label)) return "yap_tead"
  return "other_hippo"
}

/**
 * Pathway engagement 0–1 from Hippo-target docking + identity.
 * Stronger (more negative) affinity → higher engagement / suppression potential.
 */
export function hippoPathwayEngagement(features: PredictionFeatures): {
  engagement: number
  role: HippoTargetRole
  affinityKcalMol: number | undefined
  targetLabel: string
} {
  const dock = features.docking.find((row) => Number.isFinite(row.affinityKcalMol))
  const affinity = dock?.affinityKcalMol
  const targetLabel = [dock?.proteinName, features.targetProteinIds[0]].filter(Boolean).join(" ") || "Hippo target"
  const role = classifyHippoTargetRole(targetLabel)
  const affinityScore =
    affinity == null ? 0.34 : clamp01((-affinity - 3.5) / 7)
  const identity = demonstrationFactor([
    "hippo-yap-pathway",
    features.phytochemicalId,
    features.phytochemicalName,
    features.pubchemCid,
    features.targetProteinIds.join(","),
    targetLabel,
    affinity,
  ])
  // Role bias: LATS engagement favors phosphorylation / cytoplasmic retention proxies.
  const roleBias = role === "lats" ? 0.06 : role === "yap_tead" ? 0.04 : 0
  const engagement = clamp01(0.48 * affinityScore + 0.46 * identity + roleBias)
  return { engagement, role, affinityKcalMol: affinity, targetLabel }
}

export function simulateHippoYap(features: PredictionFeatures): PrototypePredictionResult {
  const { engagement, role, affinityKcalMol, targetLabel } = hippoPathwayEngagement(features)
  // Higher engagement → lower EC50 (µg/mL) and higher max suppression of YAP–TEAD activity.
  const ec50 = round(mix(1 - engagement, 70, 360), 2)
  const slope = round(mix(engagement, 0.95, 1.55), 2)
  const maxSuppression = round(mix(engagement, 18, 72), 2)

  const series = CONCENTRATIONS_UG_ML.map((concentration) => {
    const suppression = hill(concentration, ec50, slope, maxSuppression)
    return {
      concentration,
      concentrationUnit: "ug_per_mL",
      metric: "yap_tead_transcriptional_residual",
      value: round(Math.max(0, 100 - suppression)),
      unit: "%",
    }
  })

  const residual250 = series.find((point) => point.concentration === 250)?.value ?? 0
  const suppression250 = round(100 - residual250, 2)
  // Phospho-YAP rises as Hippo kinase axis engages / YAP is restrained.
  const phosphoProxy = round(
    mix(engagement, 12, 40) + suppression250 * (role === "lats" ? 0.55 : 0.35),
    2,
  )
  // Nuclear YAP residual falls as suppression rises (distinct from scavenging %).
  const nuclearResidual = round(Math.max(5, 100 - suppression250 * (role === "yap_tead" ? 0.9 : 0.7) - mix(engagement, 0, 8)), 2)
  const teadActivity = round(Math.max(5, residual250 * (role === "yap_tead" ? 0.92 : 0.8)), 2)

  const note =
    affinityKcalMol == null
      ? `No docking affinity was available for ${targetLabel}; pathway proxies use compound–target identity only.`
      : suppression250 >= 35
        ? `Simulated YAP–TEAD residual activity is reduced at higher µg/mL doses (engagement via ${targetLabel}).`
        : `Simulated pathway engagement remains modest across the 50–500 µg/mL grid for ${targetLabel}.`

  return finishPrototype({
    endpoint: "hippo_yap",
    modelName: "HEPATOTEA Hippo–YAP (exploratory)",
    features,
    series,
    assumptions: HIPPO_YAP_ASSUMPTIONS,
    note,
    outputs: {
      "YAP–TEAD residual activity": { value: residual250, unit: "% at 250 µg/mL" },
      "Estimated YAP suppression": { value: suppression250, unit: "% at 250 µg/mL" },
      "p-YAP Ser127 proxy": { value: phosphoProxy, unit: "score" },
      "Nuclear YAP residual proxy": { value: nuclearResidual, unit: "%" },
      "TEAD transcriptional proxy": { value: teadActivity, unit: "% at 250 µg/mL" },
    },
  })
}
