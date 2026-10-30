import { DEFAULT_BOX_PADDING, VINA_DEFAULTS } from "@/lib/docking/searchBox"

export type DockingReferenceType = "ligand" | "peptide" | "residue"

export type DockingSetupStatus = "READY" | "REFERENCE_REQUIRED" | "STRUCTURE_REQUIRED" | "PROFILE_INCOMPLETE"

/**
 * Open configuration for a target that does not yet have a docking profile.
 * Null scientific fields are not guesses. Search settings are the project
 * defaults and do not validate a binding site.
 */
export interface DockingTargetConfiguration {
  targetId: string
  pdbId: string | null
  receptorUniProt: string | null
  receptorChains: string[] | null
  referenceType: DockingReferenceType | null
  referenceIdentifier: string | null
  referenceChains: string[] | null
  preparationRule: string | null
  padding: number
  exhaustiveness: number
  numModes: number
  energyRange: number
  /** The assigned PDB is not a docking receptor. Distinct from a missing reference. */
  structureGap: "no_structure" | "wrong_domain" | null
  issue: string
}

export interface DockingSetupDescription {
  ready: boolean
  status: DockingSetupStatus
  label: string
  pdbId: string | null
  missing: string[]
  issue: string | null
}

const SEARCH_DEFAULTS = {
  padding: DEFAULT_BOX_PADDING,
  exhaustiveness: VINA_DEFAULTS.exhaustiveness,
  numModes: VINA_DEFAULTS.numModes,
  energyRange: VINA_DEFAULTS.energyRange,
} as const

const SETUP_LABEL: Record<DockingSetupStatus, string> = {
  READY: "✓ AutoDock Vina ready",
  REFERENCE_REQUIRED: "⚠ Binding-site reference required",
  STRUCTURE_REQUIRED: "⚠ Validated receptor structure required",
  PROFILE_INCOMPLETE: "⚠ Docking setup incomplete",
}

export function dockingSetupReason(status: DockingSetupStatus): string {
  switch (status) {
    case "READY":
      return "AutoDock Vina ready"
    case "REFERENCE_REQUIRED":
      return "Binding-site reference required"
    case "STRUCTURE_REQUIRED":
      return "Validated receptor structure required"
    case "PROFILE_INCOMPLETE":
      return "Docking setup incomplete"
  }
}

/** True when a selected target is not docking-ready and has not already been acknowledged. */
export function unsupportedTargetsNeedWarning(selectedNames: string[], acknowledgedNames: string[] | undefined): boolean {
  const known = new Set((acknowledgedNames ?? []).map((name) => name.trim().toLowerCase()).filter(Boolean))
  return selectedNames.some((name) => !known.has(name.trim().toLowerCase()))
}

function configuration(
  row: Omit<DockingTargetConfiguration, "padding" | "exhaustiveness" | "numModes" | "energyRange">,
): DockingTargetConfiguration {
  return { ...SEARCH_DEFAULTS, ...row }
}

/**
 * Incomplete targets only. YAP1 and KEAP1 are intentionally absent:
 * their readiness comes from DOCKING_PROFILE_SPECS.
 */
export const DOCKING_TARGET_CONFIGURATIONS: DockingTargetConfiguration[] = [
  configuration({
    targetId: "bax",
    pdbId: "4S0O",
    receptorUniProt: "Q07812",
    receptorChains: null,
    referenceType: null,
    referenceIdentifier: null,
    referenceChains: null,
    preparationRule: null,
    structureGap: null,
    issue: "PDB 4S0O is the human BAX dimer. The deposit has no co-crystallized ligand or reference peptide, and no binding-site reference is configured.",
  }),
  configuration({
    targetId: "bcl2",
    pdbId: null,
    receptorUniProt: null,
    receptorChains: null,
    referenceType: null,
    referenceIdentifier: null,
    referenceChains: null,
    preparationRule: null,
    structureGap: "no_structure",
    issue: "No PDB is assigned. RCSB 2YIU is cytochrome bc1 from Paracoccus denitrificans, not BCL-2. A human BCL-2 structure has not been selected or validated.",
  }),
  configuration({
    targetId: "casp3",
    pdbId: "2XYG",
    receptorUniProt: "P42574",
    receptorChains: null,
    referenceType: null,
    referenceIdentifier: null,
    referenceChains: null,
    preparationRule: null,
    structureGap: null,
    issue: "PDB 2XYG is human caspase-3 p17/p12. The deposit contains TQ8. TQ8 has not been validated as the docking reference, so no grid or PDBQT rule is defined.",
  }),
  configuration({
    targetId: "lats1",
    pdbId: null,
    receptorUniProt: null,
    receptorChains: null,
    referenceType: null,
    referenceIdentifier: null,
    referenceChains: null,
    preparationRule: null,
    structureGap: "no_structure",
    issue: "No experimental 3D structure of the human LATS1 kinase domain exists in RCSB PDB (available deposits 5BRK and 4ZRK contain only regulatory binding fragments). Structure required for docking. RCSB 5YLH is GH113 beta-1,4-mannanase, not LATS1.",
  }),
  configuration({
    targetId: "tp53",
    pdbId: "1TUP",
    receptorUniProt: "P04637",
    receptorChains: null,
    referenceType: null,
    referenceIdentifier: null,
    referenceChains: null,
    preparationRule: null,
    structureGap: null,
    issue: "PDB 1TUP is human p53 complexed with DNA. Its only nonpolymer component is zinc, which this docking pipeline does not use as a reference. No binding-site reference is configured.",
  }),
  configuration({
    targetId: "egfr",
    pdbId: "1IVO",
    receptorUniProt: "P00533",
    receptorChains: null,
    referenceType: null,
    referenceIdentifier: null,
    referenceChains: null,
    preparationRule: null,
    structureGap: "wrong_domain",
    issue: "PDB 1IVO is the EGFR extracellular domains bound to EGF, not the kinase domain. It is not a validated receptor for this docking setup. NAG in the deposit is not a docking reference.",
  }),
  configuration({
    targetId: "casp9",
    pdbId: "2AR9",
    receptorUniProt: "P55211",
    receptorChains: null,
    referenceType: null,
    referenceIdentifier: null,
    referenceChains: null,
    preparationRule: null,
    structureGap: null,
    issue: "PDB 2AR9 is a human caspase-9 dimer. The deposit contains D-malate. That component has not been validated as a binding-site reference.",
  }),
  configuration({
    targetId: "mmp9",
    pdbId: "1GKC",
    receptorUniProt: "P14780",
    receptorChains: null,
    referenceType: null,
    referenceIdentifier: null,
    referenceChains: null,
    preparationRule: null,
    structureGap: null,
    issue: "PDB 1GKC is the MMP-9 catalytic domain, not full-length MMP-9. The deposit contains inhibitor NFH. NFH has not been validated as the docking reference, so no grid or PDBQT rule is defined.",
  }),
  configuration({
    targetId: "mtor",
    pdbId: "4JSV",
    receptorUniProt: "P42345",
    receptorChains: null,
    referenceType: null,
    referenceIdentifier: null,
    referenceChains: null,
    preparationRule: null,
    structureGap: null,
    issue: "PDB 4JSV is an mTOR kinase fragment bound to LST8, not full-length mTOR alone. ADP and trifluoromagnesate are in the deposit and have not been validated as docking references.",
  }),
  configuration({
    targetId: "ccnd1",
    pdbId: null,
    receptorUniProt: "P24385",
    receptorChains: null,
    referenceType: null,
    referenceIdentifier: null,
    referenceChains: null,
    preparationRule: null,
    structureGap: "no_structure",
    issue: "Cyclin D1 (CCND1) is an allosteric regulatory activating partner for CDK4/6 and lacks an intrinsic catalytic pocket or validated small-molecule binding site (small-molecule inhibitors target the CDK4 kinase cleft). Validated direct small-molecule docking site required. RCSB 2W9Z is cyclin D1 in complex with CDK4.",
  }),
]

const TARGET_NAMES: Record<string, string[]> = {
  bax: ["bax"],
  bcl2: ["bcl-2", "bcl2"],
  casp3: ["caspase-3", "casp3"],
  lats1: ["lats1"],
  tp53: ["p53", "tp53"],
  egfr: ["egfr"],
  casp9: ["caspase-9", "casp9"],
  mmp9: ["mmp-9", "mmp9"],
  mtor: ["mtor"],
  ccnd1: ["cyclin d1", "ccnd1"],
}

export function dockingTargetConfiguration(protein: {
  pdbId?: string | null
  name?: string | null
  targetId?: string | null
}): DockingTargetConfiguration | null {
  const targetId = protein.targetId?.trim().toLowerCase()
  if (targetId) {
    const byId = DOCKING_TARGET_CONFIGURATIONS.find((item) => item.targetId === targetId)
    if (byId) return byId
  }
  const name = protein.name?.trim().toLowerCase()
  if (name) {
    const byName = DOCKING_TARGET_CONFIGURATIONS.find((item) => TARGET_NAMES[item.targetId]?.includes(name))
    if (byName) return byName
  }
  const pdbId = protein.pdbId?.trim().toUpperCase()
  if (!pdbId) return null
  const byPdb = DOCKING_TARGET_CONFIGURATIONS.filter((item) => item.pdbId === pdbId)
  return byPdb.length === 1 ? byPdb[0] : null
}

function hasReference(configuration: DockingTargetConfiguration): boolean {
  return Boolean(configuration.referenceType && configuration.referenceIdentifier?.trim())
}

/**
 * READY is possible only when specComplete is true. A filled configuration
 * never promotes a target on its own.
 */
export function describeDockingSetup(input: {
  pdbId: string | null
  specComplete: boolean
  configuration: DockingTargetConfiguration | null
}): DockingSetupDescription {
  if (input.specComplete) {
    return {
      ready: true,
      status: "READY",
      label: SETUP_LABEL.READY,
      pdbId: input.pdbId,
      missing: [],
      issue: null,
    }
  }
  const configuration = input.configuration
  if (!configuration || configuration.structureGap || !configuration.pdbId) {
    return {
      ready: false,
      status: "STRUCTURE_REQUIRED",
      label: SETUP_LABEL.STRUCTURE_REQUIRED,
      pdbId: input.pdbId,
      missing: [
        configuration?.structureGap === "wrong_domain"
          ? "Validated receptor structure for the intended docking experiment"
          : "Validated human receptor structure",
        "DOCKING_PROFILE_SPECS entry",
      ],
      issue: configuration?.issue ?? "A validated human receptor structure is required.",
    }
  }
  if (!hasReference(configuration)) {
    return {
      ready: false,
      status: "REFERENCE_REQUIRED",
      label: SETUP_LABEL.REFERENCE_REQUIRED,
      pdbId: input.pdbId,
      missing: referenceGaps(configuration),
      issue: configuration.issue,
    }
  }
  return {
    ready: false,
    status: "PROFILE_INCOMPLETE",
    label: SETUP_LABEL.PROFILE_INCOMPLETE,
    pdbId: input.pdbId,
    missing: profileGaps(configuration),
    issue: configuration.issue,
  }
}

function referenceGaps(configuration: DockingTargetConfiguration): string[] {
  return [
    "Binding-site reference",
    ...sharedGaps(configuration),
  ]
}

function profileGaps(configuration: DockingTargetConfiguration): string[] {
  const missing: string[] = []
  if (!configuration.receptorUniProt) missing.push("Receptor UniProt")
  if (!configuration.receptorChains?.length) missing.push("Validated receptor chains")
  if (!configuration.referenceChains?.length) missing.push("Reference chain")
  if (!configuration.preparationRule?.trim()) missing.push("Receptor preparation rule")
  missing.push("Docking grid derived from reference atoms")
  missing.push("PDBQT preparation rule")
  missing.push("DOCKING_PROFILE_SPECS entry")
  return missing
}

function sharedGaps(configuration: DockingTargetConfiguration): string[] {
  const missing: string[] = []
  if (!configuration.receptorChains?.length) missing.push("Validated receptor chains")
  if (!configuration.referenceChains?.length) missing.push("Reference chain")
  if (!configuration.preparationRule?.trim()) missing.push("Receptor preparation rule")
  missing.push("Docking grid derived from reference atoms")
  missing.push("PDBQT preparation rule")
  missing.push("DOCKING_PROFILE_SPECS entry")
  return missing
}
