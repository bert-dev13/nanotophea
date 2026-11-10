/**
 * Curated oxidative-stress protein targets for the ROS exploratory module.
 *
 * Selection is investigation context and study-record traceability only.
 * It must never drive ROS index math, invent PDB IDs/sequences, or present
 * docking affinity as ROS / expression measurements.
 */

import { profileSpecForProtein } from "@/lib/docking/profiles"
import { CATALOG_PROTEINS, type CatalogProtein } from "@/lib/catalog/reusableResearchCatalog"

export type RosStructureAvailability =
  | "curated_experimental_structure"
  | "study_protein_structure_claim"
  | "not_curated_in_hepatotea"

export type RosDockingSuitability =
  | "curated_docking_receptor"
  | "not_suitable_without_curated_profile"
  | "pathway_partner_not_receptor"

export interface RosOxidativeTargetDefinition {
  /** Stable catalog key used in selection / persistence. */
  key: string
  geneSymbol: string
  /** Alternate gene labels researchers may recognize. */
  aliases: string[]
  proteinName: string
  biologicalFunction: string
  pathway: string
  /** Human UniProt accessions already used or standard canonical references — not sequences. */
  uniprotIds: string[]
  /** Only filled when HEPATOTEA already curates a verified experimental structure. */
  curatedPdbId?: string
  structureAvailability: RosStructureAvailability
  dockingSuitability: RosDockingSuitability
  dockingNotes: string
  catalogKey?: string
}

export interface RosOxidativeTargetSelection {
  key: string
  geneSymbol: string
  proteinName: string
  studyProteinId?: string
  studyProteinName?: string
  curatedPdbId?: string
  structureAvailability: RosStructureAvailability
  dockingSuitability: RosDockingSuitability
  dockingProfileId?: string
  dockingAffinityKcalMol?: number
  dockingProteinId?: string
}

export interface RosOxidativeTargetView extends RosOxidativeTargetDefinition {
  selected: boolean
  inStudy: boolean
  studyProtein?: {
    id: string
    name: string
    gene?: string
    geneSymbol?: string
    pdbId?: string
    uniprotIds?: string[]
    structureContext?: string
    verificationSource?: string
    functionNotes?: string
  }
  dockingProfileId?: string
  dockingAffinityKcalMol?: number
  dockingProteinId?: string
  structureSummary: string
}

/** Ordered curated list for the ROS assay (gene symbols as requested). */
export const ROS_OXIDATIVE_STRESS_TARGETS: RosOxidativeTargetDefinition[] = [
  {
    key: "keap1",
    geneSymbol: "KEAP1",
    aliases: ["KEAP1"],
    proteinName: "Kelch-like ECH-associated protein 1",
    biologicalFunction: "Redox-sensitive Cullin3 adaptor that targets Nrf2 for proteasomal degradation under basal conditions.",
    pathway: "Keap1–Nrf2 oxidative-stress signaling",
    uniprotIds: ["Q14145"],
    curatedPdbId: "8EJR",
    structureAvailability: "curated_experimental_structure",
    dockingSuitability: "curated_docking_receptor",
    dockingNotes:
      "HEPATOTEA curates KEAP1 Kelch (PDB 8EJR) as the docking receptor for the Keap1–Nrf2 axis. Docking ΔG is a separate molecular-docking outcome and must not be read as a ROS assay value.",
    catalogKey: "keap1",
  },
  {
    key: "nfe2l2",
    geneSymbol: "NFE2L2",
    aliases: ["NFE2L2", "NRF2"],
    proteinName: "Nuclear factor erythroid 2-related factor 2 (Nrf2)",
    biologicalFunction: "Master transcription factor inducing antioxidant-response-element genes under oxidative stress.",
    pathway: "Keap1–Nrf2 oxidative-stress signaling",
    uniprotIds: ["Q16236"],
    structureAvailability: "not_curated_in_hepatotea",
    dockingSuitability: "pathway_partner_not_receptor",
    dockingNotes:
      "Nrf2 is the pathway partner for curated KEAP1 docking (reference UniProt Q16236 on PDB 8EJR). HEPATOTEA does not treat Nrf2 itself as a curated small-molecule docking receptor.",
    catalogKey: "nfe2l2",
  },
  {
    key: "nqo1",
    geneSymbol: "NQO1",
    aliases: ["NQO1", "DT-DIAPHORASE"],
    proteinName: "NAD(P)H dehydrogenase [quinone] 1",
    biologicalFunction: "Nrf2-inducible quinone reductase that limits redox cycling of quinones.",
    pathway: "Antioxidant response / phase II detoxification",
    uniprotIds: ["P15559"],
    structureAvailability: "not_curated_in_hepatotea",
    dockingSuitability: "not_suitable_without_curated_profile",
    dockingNotes: "No HEPATOTEA AutoDock Vina profile is curated for NQO1. Do not invent a PDB ID for docking.",
    catalogKey: "nqo1",
  },
  {
    key: "hmox1",
    geneSymbol: "HMOX1",
    aliases: ["HMOX1", "HO-1", "HO1"],
    proteinName: "Heme oxygenase 1 (HO-1)",
    biologicalFunction: "Stress-inducible enzyme that catabolizes heme and contributes to cellular antioxidant defenses.",
    pathway: "Heme metabolism / antioxidant response",
    uniprotIds: ["P09601"],
    structureAvailability: "not_curated_in_hepatotea",
    dockingSuitability: "not_suitable_without_curated_profile",
    dockingNotes: "No HEPATOTEA AutoDock Vina profile is curated for HMOX1. Do not invent a PDB ID for docking.",
    catalogKey: "hmox1",
  },
  {
    key: "sod1",
    geneSymbol: "SOD1",
    aliases: ["SOD1", "CUZN-SOD"],
    proteinName: "Superoxide dismutase [Cu-Zn]",
    biologicalFunction: "Converts superoxide to hydrogen peroxide as a primary enzymatic antioxidant defense.",
    pathway: "Enzymatic ROS detoxification",
    uniprotIds: ["P00441"],
    structureAvailability: "not_curated_in_hepatotea",
    dockingSuitability: "not_suitable_without_curated_profile",
    dockingNotes: "No HEPATOTEA AutoDock Vina profile is curated for SOD1. Do not invent a PDB ID for docking.",
    catalogKey: "sod1",
  },
  {
    key: "cat",
    geneSymbol: "CAT",
    aliases: ["CAT", "CATALASE"],
    proteinName: "Catalase",
    biologicalFunction: "Decomposes hydrogen peroxide to water and oxygen, limiting peroxide-driven oxidative damage.",
    pathway: "Enzymatic ROS detoxification",
    uniprotIds: ["P04040"],
    structureAvailability: "not_curated_in_hepatotea",
    dockingSuitability: "not_suitable_without_curated_profile",
    dockingNotes: "No HEPATOTEA AutoDock Vina profile is curated for catalase. Do not invent a PDB ID for docking.",
    catalogKey: "cat",
  },
  {
    key: "gpx1",
    geneSymbol: "GPX1",
    aliases: ["GPX1"],
    proteinName: "Glutathione peroxidase 1",
    biologicalFunction: "Selenium-dependent peroxidase that reduces hydrogen peroxide and organic hydroperoxides using glutathione.",
    pathway: "Glutathione-dependent antioxidant defense",
    uniprotIds: ["P07203"],
    structureAvailability: "not_curated_in_hepatotea",
    dockingSuitability: "not_suitable_without_curated_profile",
    dockingNotes: "No HEPATOTEA AutoDock Vina profile is curated for GPX1. Do not invent a PDB ID for docking.",
    catalogKey: "gpx1",
  },
  {
    key: "nox4",
    geneSymbol: "NOX4",
    aliases: ["NOX4"],
    proteinName: "NADPH oxidase 4",
    biologicalFunction: "Constitutive ROS-generating NADPH oxidase that can elevate hydrogen peroxide tone in cells.",
    pathway: "ROS generation / redox signaling",
    uniprotIds: ["Q9NPH5"],
    structureAvailability: "not_curated_in_hepatotea",
    dockingSuitability: "not_suitable_without_curated_profile",
    dockingNotes: "No HEPATOTEA AutoDock Vina profile is curated for NOX4. Do not invent a PDB ID for docking.",
    catalogKey: "nox4",
  },
]

const TARGET_BY_KEY = new Map(ROS_OXIDATIVE_STRESS_TARGETS.map((row) => [row.key, row]))

export function rosOxidativeTargetByKey(key: string): RosOxidativeTargetDefinition | undefined {
  return TARGET_BY_KEY.get(key.trim().toLowerCase())
}

export function normalizeRosGeneToken(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "")
}

export function isRosOxidativeTargetProtein(protein: {
  name?: string | null
  gene?: string | null
  geneSymbol?: string | null
  pathway?: string | null
}): boolean {
  const haystack = normalizeRosGeneToken(
    [protein.geneSymbol, protein.gene, protein.name, protein.pathway].filter(Boolean).join(" "),
  )
  return ROS_OXIDATIVE_STRESS_TARGETS.some((target) =>
    target.aliases.some((alias) => haystack.includes(normalizeRosGeneToken(alias))),
  )
}

export function matchStudyProteinForRosTarget(
  target: RosOxidativeTargetDefinition,
  proteins: Array<{
    id: string
    name: string
    gene?: string | null
    geneSymbol?: string | null
    pdbId?: string | null
    uniprotIds?: string[] | null
    structureContext?: string | null
    verificationSource?: string | null
    functionNotes?: string | null
    pathway?: string | null
  }>,
) {
  const aliasTokens = target.aliases.map(normalizeRosGeneToken)
  const uniprotSet = new Set(target.uniprotIds.map((id) => id.toUpperCase()))
  return (
    proteins.find((protein) => {
      const tokens = [protein.geneSymbol, protein.gene, protein.name]
        .filter(Boolean)
        .map((value) => normalizeRosGeneToken(String(value)))
      if (tokens.some((token) => aliasTokens.some((alias) => token === alias || token.includes(alias)))) {
        return true
      }
      return (protein.uniprotIds ?? []).some((id) => uniprotSet.has(id.trim().toUpperCase()))
    }) ?? null
  )
}

export function resolveRosOxidativeTargetViews(input: {
  selectedKeys: string[]
  proteins: Array<{
    id: string
    name: string
    gene?: string | null
    geneSymbol?: string | null
    pdbId?: string | null
    uniprotIds?: string[] | null
    structureContext?: string | null
    verificationSource?: string | null
    functionNotes?: string | null
    pathway?: string | null
  }>
  docking?: Array<{
    compoundId: string
    proteinId: string
    bestBindingAffinityKcalMol?: number | null
  }>
  compoundId?: string
}): RosOxidativeTargetView[] {
  const selected = new Set(input.selectedKeys.map((key) => key.trim().toLowerCase()).filter(Boolean))
  return ROS_OXIDATIVE_STRESS_TARGETS.map((target) => {
    const studyProtein = matchStudyProteinForRosTarget(target, input.proteins)
    const profile =
      studyProtein != null
        ? profileSpecForProtein({
            pdbId: studyProtein.pdbId,
            uniprotIds: studyProtein.uniprotIds ?? undefined,
            name: studyProtein.name,
            targetId: target.key,
          })
        : target.curatedPdbId
          ? profileSpecForProtein({
              pdbId: target.curatedPdbId,
              uniprotIds: target.uniprotIds,
              name: target.proteinName,
              targetId: target.key,
            })
          : null
    const dockingRow =
      studyProtein && input.compoundId
        ? input.docking?.find(
            (row) => row.compoundId === input.compoundId && row.proteinId === studyProtein.id,
          )
        : undefined
    const structureAvailability: RosStructureAvailability =
      target.structureAvailability === "curated_experimental_structure"
        ? "curated_experimental_structure"
        : studyProtein?.pdbId
          ? "study_protein_structure_claim"
          : "not_curated_in_hepatotea"
    return {
      ...target,
      selected: selected.has(target.key),
      inStudy: Boolean(studyProtein),
      ...(studyProtein
        ? {
            studyProtein: {
              id: studyProtein.id,
              name: studyProtein.name,
              ...(studyProtein.gene ? { gene: studyProtein.gene } : {}),
              ...(studyProtein.geneSymbol ? { geneSymbol: studyProtein.geneSymbol } : {}),
              ...(studyProtein.pdbId ? { pdbId: studyProtein.pdbId } : {}),
              ...(studyProtein.uniprotIds ? { uniprotIds: studyProtein.uniprotIds.filter(Boolean) as string[] } : {}),
              ...(studyProtein.structureContext ? { structureContext: studyProtein.structureContext } : {}),
              ...(studyProtein.verificationSource ? { verificationSource: studyProtein.verificationSource } : {}),
              ...(studyProtein.functionNotes ? { functionNotes: studyProtein.functionNotes } : {}),
            },
          }
        : {}),
      ...(profile ? { dockingProfileId: profile.id } : {}),
      ...(dockingRow?.bestBindingAffinityKcalMol != null
        ? {
            dockingAffinityKcalMol: dockingRow.bestBindingAffinityKcalMol,
            dockingProteinId: dockingRow.proteinId,
          }
        : {}),
      structureSummary: describeRosStructure(target, studyProtein?.pdbId ?? undefined, structureAvailability),
      structureAvailability,
    }
  })
}

export function buildRosOxidativeTargetSelections(
  views: RosOxidativeTargetView[],
): RosOxidativeTargetSelection[] {
  return views
    .filter((row) => row.selected)
    .map((row) => ({
      key: row.key,
      geneSymbol: row.geneSymbol,
      proteinName: row.proteinName,
      ...(row.studyProtein?.id ? { studyProteinId: row.studyProtein.id } : {}),
      ...(row.studyProtein?.name ? { studyProteinName: row.studyProtein.name } : {}),
      ...(row.curatedPdbId ? { curatedPdbId: row.curatedPdbId } : {}),
      structureAvailability: row.structureAvailability,
      dockingSuitability: row.dockingSuitability,
      ...(row.dockingProfileId ? { dockingProfileId: row.dockingProfileId } : {}),
      ...(row.dockingAffinityKcalMol != null ? { dockingAffinityKcalMol: row.dockingAffinityKcalMol } : {}),
      ...(row.dockingProteinId ? { dockingProteinId: row.dockingProteinId } : {}),
    }))
}

/** Writes ROS target context into prediction input_parameters (traceability only). */
export function rosOxidativeTargetsToInputParameters(
  selections: RosOxidativeTargetSelection[],
): Record<string, string | number | boolean | null> {
  const params: Record<string, string | number | boolean | null> = {
    "meta:rosOxidativeTargetCount": selections.length,
    "meta:rosOxidativeTargetsDriveAssay": false,
    "meta:rosOxidativeTargetsNote":
      "Selected oxidative-stress proteins are investigation context only. They do not drive the exploratory ROS index and are not experimental biomarkers unless Laboratory data are supplied.",
  }
  if (!selections.length) {
    params["meta:rosOxidativeTargetKeys"] = ""
    params["meta:rosOxidativeTargetGenes"] = ""
    return params
  }
  params["meta:rosOxidativeTargetKeys"] = selections.map((row) => row.key).join(",")
  params["meta:rosOxidativeTargetGenes"] = selections.map((row) => row.geneSymbol).join(",")
  selections.forEach((row, index) => {
    const prefix = `meta:rosOxidativeTarget.${index}`
    params[`${prefix}.key`] = row.key
    params[`${prefix}.geneSymbol`] = row.geneSymbol
    params[`${prefix}.proteinName`] = row.proteinName
    params[`${prefix}.structureAvailability`] = row.structureAvailability
    params[`${prefix}.dockingSuitability`] = row.dockingSuitability
    if (row.studyProteinId) params[`${prefix}.studyProteinId`] = row.studyProteinId
    if (row.studyProteinName) params[`${prefix}.studyProteinName`] = row.studyProteinName
    if (row.curatedPdbId) params[`${prefix}.curatedPdbId`] = row.curatedPdbId
    if (row.dockingProfileId) params[`${prefix}.dockingProfileId`] = row.dockingProfileId
    if (row.dockingAffinityKcalMol != null) {
      params[`${prefix}.dockingAffinityKcalMol`] = row.dockingAffinityKcalMol
      params[`${prefix}.dockingVsRos`] =
        "Molecular docking affinity stored for context only — not a ROS measurement."
    }
  })
  return params
}

export function readRosOxidativeTargetKeysFromParameters(
  inputParameters?: Record<string, string | number | boolean | null> | null,
): string[] {
  if (!inputParameters) return []
  const raw = inputParameters["meta:rosOxidativeTargetKeys"]
  if (typeof raw !== "string" || !raw.trim()) return []
  return raw
    .split(",")
    .map((key) => key.trim().toLowerCase())
    .filter((key) => TARGET_BY_KEY.has(key))
}

export function catalogProteinForRosTarget(target: RosOxidativeTargetDefinition): CatalogProtein | undefined {
  if (!target.catalogKey) return undefined
  return CATALOG_PROTEINS.find((row) => row.key === target.catalogKey)
}

function describeRosStructure(
  target: RosOxidativeTargetDefinition,
  studyPdbId: string | undefined,
  availability: RosStructureAvailability,
): string {
  if (availability === "curated_experimental_structure" && target.curatedPdbId) {
    return `Curated experimental structure PDB ${target.curatedPdbId} (RCSB). UniProt ${target.uniprotIds.join(", ")}.`
  }
  if (availability === "study_protein_structure_claim" && studyPdbId) {
    return `Study protein claims structure ID ${studyPdbId}. Verification is performed in docking workflows against live RCSB/AlphaFold metadata — not assumed here.`
  }
  return `No HEPATOTEA-curated structure ID is assigned. UniProt ${target.uniprotIds.join(", ")}. Retrieve and verify structures via Research Setup / docking before treating any PDB as usable.`
}
