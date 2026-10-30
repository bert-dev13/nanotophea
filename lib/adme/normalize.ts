/**
 * Maps numeric outputs of the configured ADME model onto display fields.
 * Physicochemical descriptors that the same run may also compute (molecular
 * weight, LogP, Lipinski, TPSA) are kept in the raw record and are not
 * presented as ADME results.
 */
import {
  ADME_CLASSIFICATION_THRESHOLD,
  ADME_MODEL_NAME,
  ADME_PROVIDER_NAME,
  type AdmePredictInput,
  type AdmeResult,
} from "@/lib/adme/types"

export type AdmeGroupId = "absorption" | "distribution" | "metabolism" | "excretion" | "toxicity"

export interface AdmeEndpoint {
  id: string
  modelKey: string
  group: AdmeGroupId
  label: string
  task: "classification" | "regression"
  units?: string
  positive?: string
  negative?: string
  aliases?: string[]
}

export const ADME_GROUP_LABEL: Record<AdmeGroupId, string> = {
  absorption: "Absorption",
  distribution: "Distribution",
  metabolism: "Metabolism",
  excretion: "Excretion",
  toxicity: "Toxicity",
}

export const ADME_GROUP_ORDER: AdmeGroupId[] = ["absorption", "distribution", "metabolism", "excretion", "toxicity"]

/** Endpoint catalog from ADMET-AI's TDC task table. Names describe that model, not SwissADME. */
export const ADME_ENDPOINTS: AdmeEndpoint[] = [
  { id: "giAbsorption", modelKey: "HIA_Hou", group: "absorption", label: "GI Absorption", task: "classification", positive: "Absorbed", negative: "Not absorbed", aliases: ["gi_absorption", "gi"] },
  { id: "pgpInhibition", modelKey: "Pgp_Broccatelli", group: "absorption", label: "P-gp Inhibitor", task: "classification", positive: "Yes", negative: "No" },
  { id: "oralBioavailability", modelKey: "Bioavailability_Ma", group: "absorption", label: "Oral Bioavailability", task: "classification", positive: "Yes", negative: "No" },
  { id: "aqueousSolubility", modelKey: "Solubility_AqSolDB", group: "absorption", label: "Aqueous Solubility", task: "regression", units: "log(mol/L)" },
  { id: "caco2Permeability", modelKey: "Caco2_Wang", group: "absorption", label: "Caco-2 Permeability", task: "regression", units: "log(10^-6 cm/s)" },
  { id: "pampaPermeability", modelKey: "PAMPA_NCATS", group: "absorption", label: "PAMPA Permeability", task: "classification", positive: "Yes", negative: "No" },
  { id: "lipophilicity", modelKey: "Lipophilicity_AstraZeneca", group: "absorption", label: "Lipophilicity", task: "regression", units: "log-ratio" },
  { id: "hydrationFreeEnergy", modelKey: "HydrationFreeEnergy_FreeSolv", group: "absorption", label: "Hydration Free Energy", task: "regression", units: "kcal/mol" },
  { id: "bbbPermeability", modelKey: "BBB_Martins", group: "distribution", label: "BBB Permeability", task: "classification", positive: "Yes", negative: "No", aliases: ["bbbPermeant", "bbb", "bbbPermeation", "bbb_permeability"] },
  { id: "plasmaProteinBinding", modelKey: "PPBR_AZ", group: "distribution", label: "Plasma Protein Binding", task: "regression", units: "%" },
  { id: "volumeOfDistribution", modelKey: "VDss_Lombardo", group: "distribution", label: "Volume of Distribution", task: "regression", units: "L/kg" },
  { id: "cyp1a2Inhibitor", modelKey: "CYP1A2_Veith", group: "metabolism", label: "CYP1A2 Inhibitor", task: "classification", positive: "Yes", negative: "No", aliases: ["cyp1a2", "CYP1A2"] },
  { id: "cyp2c19Inhibitor", modelKey: "CYP2C19_Veith", group: "metabolism", label: "CYP2C19 Inhibitor", task: "classification", positive: "Yes", negative: "No", aliases: ["cyp2c19", "CYP2C19"] },
  { id: "cyp2c9Inhibitor", modelKey: "CYP2C9_Veith", group: "metabolism", label: "CYP2C9 Inhibitor", task: "classification", positive: "Yes", negative: "No", aliases: ["cyp2c9", "CYP2C9"] },
  { id: "cyp2d6Inhibitor", modelKey: "CYP2D6_Veith", group: "metabolism", label: "CYP2D6 Inhibitor", task: "classification", positive: "Yes", negative: "No", aliases: ["cyp2d6", "CYP2D6"] },
  { id: "cyp3a4Inhibitor", modelKey: "CYP3A4_Veith", group: "metabolism", label: "CYP3A4 Inhibitor", task: "classification", positive: "Yes", negative: "No", aliases: ["cyp3a4", "CYP3A4"] },
  { id: "cyp2c9Substrate", modelKey: "CYP2C9_Substrate_CarbonMangels", group: "metabolism", label: "CYP2C9 Substrate", task: "classification", positive: "Yes", negative: "No" },
  { id: "cyp2d6Substrate", modelKey: "CYP2D6_Substrate_CarbonMangels", group: "metabolism", label: "CYP2D6 Substrate", task: "classification", positive: "Yes", negative: "No" },
  { id: "cyp3a4Substrate", modelKey: "CYP3A4_Substrate_CarbonMangels", group: "metabolism", label: "CYP3A4 Substrate", task: "classification", positive: "Yes", negative: "No" },
  { id: "halfLife", modelKey: "Half_Life_Obach", group: "excretion", label: "Half Life", task: "regression", units: "hr" },
  { id: "hepatocyteClearance", modelKey: "Clearance_Hepatocyte_AZ", group: "excretion", label: "Hepatocyte Clearance", task: "regression", units: "uL/min/10^6 cells" },
  { id: "microsomeClearance", modelKey: "Clearance_Microsome_AZ", group: "excretion", label: "Microsome Clearance", task: "regression", units: "uL/min/mg" },
  { id: "hergBlocking", modelKey: "hERG", group: "toxicity", label: "hERG Blocking", task: "classification", positive: "Yes", negative: "No" },
  { id: "clinicalToxicity", modelKey: "ClinTox", group: "toxicity", label: "Clinical Toxicity", task: "classification", positive: "Yes", negative: "No" },
  { id: "amesMutagenicity", modelKey: "AMES", group: "toxicity", label: "Mutagenicity", task: "classification", positive: "Yes", negative: "No" },
  { id: "drugInducedLiverInjury", modelKey: "DILI", group: "toxicity", label: "Drug-Induced Liver Injury", task: "classification", positive: "Yes", negative: "No" },
  { id: "carcinogenicity", modelKey: "Carcinogens_Lagunin", group: "toxicity", label: "Carcinogenicity", task: "classification", positive: "Yes", negative: "No" },
  { id: "acuteToxicityLd50", modelKey: "LD50_Zhu", group: "toxicity", label: "Acute Toxicity LD50", task: "regression", units: "log(1/(mol/kg))" },
  { id: "skinReaction", modelKey: "Skin_Reaction", group: "toxicity", label: "Skin Reaction", task: "classification", positive: "Yes", negative: "No" },
  { id: "androgenReceptor", modelKey: "NR-AR", group: "toxicity", label: "Androgen Receptor", task: "classification", positive: "Yes", negative: "No" },
  { id: "androgenReceptorLbd", modelKey: "NR-AR-LBD", group: "toxicity", label: "Androgen Receptor LBD", task: "classification", positive: "Yes", negative: "No" },
  { id: "arylHydrocarbonReceptor", modelKey: "NR-AhR", group: "toxicity", label: "Aryl Hydrocarbon Receptor", task: "classification", positive: "Yes", negative: "No" },
  { id: "aromatase", modelKey: "NR-Aromatase", group: "toxicity", label: "Aromatase", task: "classification", positive: "Yes", negative: "No" },
  { id: "estrogenReceptor", modelKey: "NR-ER", group: "toxicity", label: "Estrogen Receptor", task: "classification", positive: "Yes", negative: "No" },
  { id: "estrogenReceptorLbd", modelKey: "NR-ER-LBD", group: "toxicity", label: "Estrogen Receptor LBD", task: "classification", positive: "Yes", negative: "No" },
  { id: "pparGamma", modelKey: "NR-PPAR-gamma", group: "toxicity", label: "PPAR Gamma", task: "classification", positive: "Yes", negative: "No" },
  { id: "antioxidantResponse", modelKey: "SR-ARE", group: "toxicity", label: "Antioxidant Response", task: "classification", positive: "Yes", negative: "No" },
  { id: "atad5", modelKey: "SR-ATAD5", group: "toxicity", label: "ATAD5", task: "classification", positive: "Yes", negative: "No" },
  { id: "heatShockResponse", modelKey: "SR-HSE", group: "toxicity", label: "Heat Shock Response", task: "classification", positive: "Yes", negative: "No" },
  { id: "mitochondrialMembranePotential", modelKey: "SR-MMP", group: "toxicity", label: "Mitochondrial Membrane Potential", task: "classification", positive: "Yes", negative: "No" },
  { id: "tumorProteinP53", modelKey: "SR-p53", group: "toxicity", label: "Tumor Protein p53", task: "classification", positive: "Yes", negative: "No" },
]

const ENDPOINT_BY_KEY = new Map(ADME_ENDPOINTS.map((endpoint) => [endpoint.modelKey, endpoint]))

export function finiteModelValue(value: unknown): number | undefined {
  if (typeof value === "boolean") return undefined
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(number) ? number : undefined
}

export function formatModelNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

export function formatEndpointValue(endpoint: AdmeEndpoint, value: number): string | undefined {
  if (endpoint.task === "classification") {
    if (value < 0 || value > 1) return undefined
    const shown = Math.round(value * 100) / 100
    const positive = shown >= ADME_CLASSIFICATION_THRESHOLD
    const label = positive ? endpoint.positive ?? "Yes" : endpoint.negative ?? "No"
    return `${label} (${formatModelNumber(value)})`
  }
  const units = endpoint.units ? ` ${endpoint.units}` : ""
  return `${formatModelNumber(value)}${units}`
}

export function normalizeAdmeValues(values: Record<string, unknown>): { descriptors: Record<string, string>; raw: Record<string, number> } | null {
  const raw: Record<string, number> = {}
  const descriptors: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    const number = finiteModelValue(value)
    if (number == null) continue
    raw[key] = number
    const endpoint = ENDPOINT_BY_KEY.get(key)
    if (!endpoint) continue
    const text = formatEndpointValue(endpoint, number)
    if (text) descriptors[endpoint.id] = text
  }
  return Object.keys(descriptors).length > 0 ? { descriptors, raw } : null
}

export function toAdmeResult(
  input: AdmePredictInput,
  values: Record<string, unknown>,
  engine: { name: string; version: string; method: string; model?: string },
): AdmeResult | null {
  const normalized = normalizeAdmeValues(values)
  if (!normalized) return null
  return {
    compoundId: input.compoundId,
    smiles: input.smiles,
    ...(input.pubchemCid != null ? { pubchemCid: input.pubchemCid } : {}),
    provider: engine.name || ADME_PROVIDER_NAME,
    providerVersion: engine.version,
    method: engine.method,
    model: engine.model || ADME_MODEL_NAME,
    evidenceClass: "PREDICTED",
    descriptors: normalized.descriptors,
    raw: normalized.raw,
  }
}

export function hasNormalizedAdmeDescriptor(descriptors: Record<string, unknown> | undefined): boolean {
  if (!descriptors) return false
  return ADME_ENDPOINTS.some((endpoint) => {
    const value = descriptors[endpoint.id]
    return typeof value === "string" && value.trim().length > 0
  })
}

export function endpointGroups(): Array<{ id: string; label: string; fields: Array<{ id: string; label: string; keys: string[] }> }> {
  return ADME_GROUP_ORDER.map((group) => ({
    id: group,
    label: ADME_GROUP_LABEL[group],
    fields: ADME_ENDPOINTS.filter((endpoint) => endpoint.group === group).map((endpoint) => ({
      id: endpoint.id,
      label: endpoint.label,
      keys: [endpoint.id, ...(endpoint.aliases ?? [])],
    })),
  }))
}
