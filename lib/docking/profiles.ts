import type { RcsbPolymer } from "@/lib/scientific/types"
import { describeDockingSetup, dockingTargetConfiguration, type DockingSetupStatus } from "@/lib/docking/targetSetup"
import {
  boxContainsAtoms,
  calculateSearchBox,
  DEFAULT_BOX_PADDING,
  listReferenceEntities,
  referenceEntityAtoms,
  VINA_DEFAULTS,
} from "@/lib/docking/searchBox"

/**
 * Developer docking profiles.
 * Coordinates are not stored here. They are calculated from the downloaded
 * structure when a run starts. A target without an entry has no profile.
 */
export interface DockingProfileSpec {
  id: string
  targetId?: string
  version: string
  biologicalTarget: string
  pathway: string
  dockingReceptor: string
  pdbId: string
  receptorUniprotId: string
  referenceUniprotId?: string
  referenceLigand?: string
  referenceChain?: string
  /** Set when the site is a modified residue on the receptor, not a separate polymer. */
  referenceResidue?: string
  referenceEntityLabel?: string
  /** Standard residue written in place of the modified residue. Lipid or other extra atoms are omitted. */
  restoreAs?: string
  restoreAtomNames?: string[]
  structureSource?: "EXPERIMENTAL_STRUCTURE" | "PREDICTED_STRUCTURE"
  structureId?: string
  structureMethod?: string
  actualDockingReceptor?: string
  researchTarget?: string
  modelSource?: string
  modelVersion?: string
  modelConfidence?: string
  bindingSiteValidationMethod?: string
  referenceResidueNumbers?: number[]
  residueRange?: [number, number]
  bindingSiteSource?: string
  bindingSiteStrategy: "reference_ligand" | "binding_site_residues"
  bindingSiteLabel: string
  paddingAngstrom: number
  exhaustiveness: number
  numModes: number
  energyRange: number
  preparationMethod: string
  provenance: string
  verificationSource: "RCSB PDB" | "AlphaFold DB"
}

export interface ResolvedDockingProfile extends DockingProfileSpec {
  receptorChains: string[]
  referenceChain: string
  referenceEntity: string
  centerX: number
  centerY: number
  centerZ: number
  sizeX: number
  sizeY: number
  sizeZ: number
  calculationMethod: string
  verifiedAt: string
  verifiedBy: string
}

export const PROFILE_MISSING = "Docking profile not configured for this target."

export type { DockingSetupStatus }

export interface DockingProfileReport {
  ready: boolean
  status: DockingSetupStatus
  label: string
  pdbId: string | null
  missing: string[]
  issue: string | null
}

/** A profile can run only when it names a real reference and a preparation rule. Coordinates are not stored here. */
export function isCompleteDockingProfile(spec: DockingProfileSpec): boolean {
  const text = (value: string | undefined): value is string => Boolean(value?.trim())
  if (!text(spec.id) || !text(spec.version) || !text(spec.biologicalTarget) || !text(spec.pathway)) return false
  if (!text(spec.dockingReceptor) || !text(spec.pdbId) || !text(spec.receptorUniprotId)) return false
  if (!text(spec.bindingSiteLabel) || !text(spec.preparationMethod) || !text(spec.provenance)) return false
  if (spec.bindingSiteStrategy !== "reference_ligand" && spec.bindingSiteStrategy !== "binding_site_residues") return false
  if (spec.verificationSource !== "RCSB PDB" && spec.verificationSource !== "AlphaFold DB") return false
  if (![spec.paddingAngstrom, spec.exhaustiveness, spec.numModes, spec.energyRange].every((value) => Number.isFinite(value))) return false
  if (spec.paddingAngstrom < 0 || spec.exhaustiveness < 1 || spec.numModes < 1 || spec.energyRange < 0) return false
  if (spec.bindingSiteStrategy === "binding_site_residues") {
    return Boolean(spec.referenceResidueNumbers?.length)
  }
  const residue = spec.referenceResidue?.trim()
  if (residue) return text(spec.restoreAs) && Boolean(spec.restoreAtomNames?.length)
  if (text(spec.referenceLigand)) return true
  if (text(spec.referenceChain)) return true
  if (text(spec.referenceUniprotId)) {
    return spec.referenceUniprotId.trim().toUpperCase() !== spec.receptorUniprotId.trim().toUpperCase()
  }
  return false
}

export interface DockingSystemLabels {
  researchTarget: string
  structuralSystem: string | null
  pdbId: string
  dockingReceptor: string
  referenceSite: string | null
  receptorDiffers: boolean
  affinityNote: string | null
}

/** Labels from an existing profile. Does not add a profile or a binding site. */
export function dockingSystemLabels(input: {
  name: string
  pathway?: string | null
  biologicalTarget?: string | null
  spec: DockingProfileSpec
}): DockingSystemLabels {
  const name = input.name.trim() || input.spec.biologicalTarget
  const pathway = (input.pathway?.trim() || input.spec.pathway).trim()
  const pathwayLabel = pathway === "Hippo–YAP" ? "Hippo–YAP signaling" : pathway
  const research = (input.biologicalTarget?.trim() || name).trim()
  const receptorHead = input.spec.dockingReceptor.trim().split(/\s+/)[0] ?? input.spec.dockingReceptor
  const receptorDiffers = !input.spec.dockingReceptor.trim().toLowerCase().startsWith(name.toLowerCase())
  const referenceSite = input.spec.referenceResidue?.trim()
    ? `${input.spec.referenceResidue.trim()} on ${receptorHead}`
    : input.spec.referenceLigand?.trim()
      ? `${input.spec.referenceLigand.trim()} on ${receptorHead}`
      : input.spec.referenceChain?.trim()
        ? `chain ${input.spec.referenceChain.trim()} on ${receptorHead}`
        : null
  const structuralSystem =
    input.spec.id === "CCND1_CDK_PROFILE"
      ? "Cyclin D1–CDK signaling complex"
      : input.spec.id === "LATS1_PROFILE"
        ? "LATS1 kinase domain (predicted AlphaFold model)"
        : receptorDiffers
          ? name.toUpperCase() === "YAP1" && receptorHead.toUpperCase() === "TEAD1"
            ? "YAP–TEAD1 complex"
            : `${name}–${receptorHead} complex`
          : null
  return {
    researchTarget: pathwayLabel ? `${research} / ${pathwayLabel}` : research,
    structuralSystem,
    pdbId: input.spec.pdbId,
    dockingReceptor: input.spec.dockingReceptor,
    referenceSite,
    receptorDiffers,
    affinityNote:
      input.spec.id === "CCND1_CDK_PROFILE"
        ? `This affinity is for CDK6 in PDB 5L2I. Cyclin D1 is the biological pathway target.`
        : input.spec.id === "LATS1_PROFILE"
          ? `This affinity is for the human LATS1 kinase domain (AlphaFold model AF-O95835-F1).`
          : receptorDiffers
            ? `This affinity is for ${input.spec.dockingReceptor} in PDB ${input.spec.pdbId}. It is not a measurement of direct binding to isolated ${name}.`
            : null,
  }
}

/**
 * Says which curated inputs are absent. Grid coordinates are calculated from a
 * reference ligand or residue at run time, so they are missing whenever no
 * profile names that reference. This does not invent a box.
 */
export function dockingProfileReport(protein: {
  pdbId?: string | null
  uniprotIds?: string[] | null
  name?: string | null
  targetId?: string | null
}): DockingProfileReport {
  const pdbId = protein.pdbId?.trim().toUpperCase() || null
  const spec = profileSpecForProtein(protein)
  return describeDockingSetup({
    pdbId: spec?.pdbId ?? pdbId,
    specComplete: Boolean(spec && isCompleteDockingProfile(spec)),
    configuration: dockingTargetConfiguration(protein),
  })
}

export function dockingUnavailableText(targetName: string): string {
  const name = targetName.trim() || "This target"
  return [
    `${name} docking unavailable`,
    "Required AutoDock Vina configuration is not currently available.",
  ].join("\n")
}

/** Logged when PDB 3KYS cannot be turned into a docking profile from its own coordinates. */
export const YAP1_PROFILE_UNAVAILABLE =
  "No scientifically supported YAP1 docking profile could be generated from the current structure."

/**
 * Profiles name the receptor and the reference atoms.
 * Center and size are calculated from the downloaded structure at run time.
 */
export const DOCKING_PROFILE_SPECS: DockingProfileSpec[] = [
  {
    id: "KEAP1_NRF2_PROFILE",
    targetId: "keap1",
    version: "1",
    biologicalTarget: "Nrf2 pathway",
    pathway: "KEAP1–Nrf2 oxidative-stress signaling",
    dockingReceptor: "KEAP1 Kelch domain",
    pdbId: "8EJR",
    receptorUniprotId: "Q14145",
    referenceUniprotId: "Q16236",
    bindingSiteStrategy: "reference_ligand",
    bindingSiteLabel: "Curated KEAP1–Nrf2 interaction site",
    paddingAngstrom: DEFAULT_BOX_PADDING,
    exhaustiveness: VINA_DEFAULTS.exhaustiveness,
    numModes: VINA_DEFAULTS.numModes,
    energyRange: VINA_DEFAULTS.energyRange,
    preparationMethod: "KEAP1 polymer ATOM records only. The Nrf2 peptide, solvent, and terminal caps are removed before Meeko writes the receptor PDBQT.",
    provenance: "Search box is the axis-aligned extent of the co-crystallized Nrf2 peptide atoms in the downloaded PDB, expanded by the profile padding. Coordinates are calculated at run time.",
    verificationSource: "RCSB PDB",
  },
  {
    id: "YAP1_PROFILE",
    targetId: "yap1",
    version: "1",
    biologicalTarget: "YAP1",
    pathway: "Hippo–YAP",
    dockingReceptor: "TEAD1 YAP-binding domain",
    pdbId: "3KYS",
    receptorUniprotId: "P28347",
    referenceUniprotId: "P28347",
    referenceResidue: "P1L",
    referenceEntityLabel: "S-palmitoyl-L-cysteine",
    restoreAs: "CYS",
    restoreAtomNames: ["N", "CA", "C", "O", "CB", "SG"],
    bindingSiteStrategy: "reference_ligand",
    bindingSiteLabel: "Curated TEAD1 palmitate pocket",
    paddingAngstrom: DEFAULT_BOX_PADDING,
    exhaustiveness: VINA_DEFAULTS.exhaustiveness,
    numModes: VINA_DEFAULTS.numModes,
    energyRange: VINA_DEFAULTS.energyRange,
    preparationMethod: "One TEAD1 chain that contains S-palmitoyl-cysteine. The palmitoyl tail is removed and that residue is written as cysteine. Residues missing backbone atoms are omitted. YAP domain chains, additional TEAD copies, and solvent are not included.",
    provenance: "Search box is the axis-aligned extent of the S-palmitoyl-cysteine atoms in the downloaded PDB, expanded by the profile padding. The site is the TEAD lipid pocket occupied in this structure. It is not a pocket on the YAP domain.",
    verificationSource: "RCSB PDB",
  },
  {
    id: "CASP3_PROFILE",
    targetId: "casp3",
    version: "1",
    biologicalTarget: "Caspase-3",
    pathway: "Apoptosis execution",
    dockingReceptor: "Caspase-3 p17/p12 heterodimer",
    pdbId: "2XYG",
    receptorUniprotId: "P42574",
    referenceLigand: "TQ8",
    referenceEntityLabel: "Inhibitor TQ8",
    bindingSiteStrategy: "reference_ligand",
    bindingSiteLabel: "Caspase-3 catalytic active site (Cys163 dyad)",
    paddingAngstrom: DEFAULT_BOX_PADDING,
    exhaustiveness: VINA_DEFAULTS.exhaustiveness,
    numModes: VINA_DEFAULTS.numModes,
    energyRange: VINA_DEFAULTS.energyRange,
    preparationMethod: "Human Caspase-3 p17 (chain A) and p12 (chain B) ATOM records only. Co-crystallized inhibitor TQ8 and solvent are removed before Meeko receptor preparation.",
    provenance: "Search box is derived from the spatial extent of co-crystallized inhibitor TQ8 in PDB 2XYG, expanded by 5 Å padding.",
    verificationSource: "RCSB PDB",
  },
  {
    id: "EGFR_PROFILE",
    targetId: "egfr",
    version: "1",
    biologicalTarget: "EGFR",
    pathway: "PI3K/Akt/mTOR",
    dockingReceptor: "EGFR tyrosine kinase domain",
    pdbId: "1M17",
    receptorUniprotId: "P00533",
    referenceLigand: "AQ4",
    referenceEntityLabel: "Erlotinib (AQ4)",
    bindingSiteStrategy: "reference_ligand",
    bindingSiteLabel: "EGFR kinase ATP catalytic cleft",
    paddingAngstrom: DEFAULT_BOX_PADDING,
    exhaustiveness: VINA_DEFAULTS.exhaustiveness,
    numModes: VINA_DEFAULTS.numModes,
    energyRange: VINA_DEFAULTS.energyRange,
    preparationMethod: "Human EGFR tyrosine kinase domain (chain A, residues 696-1022) ATOM records only. Co-crystallized inhibitor erlotinib (AQ4) and solvent are removed before receptor PDBQT preparation.",
    provenance: "Search box is derived from co-crystallized ATP-competitive inhibitor erlotinib (AQ4) in PDB 1M17 with 5 Å padding. Replaces extracellular PDB 1IVO with the validated catalytic kinase domain.",
    verificationSource: "RCSB PDB",
  },
  {
    id: "MMP9_PROFILE",
    targetId: "mmp9",
    version: "1",
    biologicalTarget: "MMP-9",
    pathway: "Invasion",
    dockingReceptor: "MMP-9 catalytic domain",
    pdbId: "1GKC",
    receptorUniprotId: "P14780",
    referenceLigand: "NFH",
    referenceEntityLabel: "Hydroxamate inhibitor NFH",
    bindingSiteStrategy: "reference_ligand",
    bindingSiteLabel: "MMP-9 catalytic zinc active site",
    paddingAngstrom: DEFAULT_BOX_PADDING,
    exhaustiveness: VINA_DEFAULTS.exhaustiveness,
    numModes: VINA_DEFAULTS.numModes,
    energyRange: VINA_DEFAULTS.energyRange,
    preparationMethod: "Human MMP-9 catalytic domain ATOM records only (chains A and B). Co-crystallized inhibitor NFH, catalytic zinc, calcium, and solvent are removed before receptor preparation.",
    provenance: "Search box is derived from the spatial coordinates of co-crystallized hydroxamate inhibitor NFH in PDB 1GKC with 5 Å padding.",
    verificationSource: "RCSB PDB",
  },
  {
    id: "BCL2_PROFILE",
    targetId: "bcl2",
    version: "1",
    biologicalTarget: "BCL-2",
    pathway: "Intrinsic apoptosis",
    dockingReceptor: "BCL-2 BH3-binding groove",
    pdbId: "4LVT",
    receptorUniprotId: "P10415",
    referenceLigand: "1XJ",
    referenceEntityLabel: "Navitoclax (1XJ)",
    bindingSiteStrategy: "reference_ligand",
    bindingSiteLabel: "BCL-2 hydrophobic BH3-binding groove",
    paddingAngstrom: DEFAULT_BOX_PADDING,
    exhaustiveness: VINA_DEFAULTS.exhaustiveness,
    numModes: VINA_DEFAULTS.numModes,
    energyRange: VINA_DEFAULTS.energyRange,
    preparationMethod: "Human BCL-2 polymer ATOM records only (chains A and B). Co-crystallized inhibitor navitoclax (1XJ) and solvent are removed before Meeko receptor PDBQT preparation.",
    provenance: "Search box is derived from the coordinates of co-crystallized BH3-mimetic inhibitor navitoclax (1XJ) in PDB 4LVT, expanded by 5 Å padding. Replaces unassigned entry.",
    verificationSource: "RCSB PDB",
  },
  {
    id: "BAX_PROFILE",
    targetId: "bax",
    version: "1",
    biologicalTarget: "BAX",
    pathway: "Intrinsic apoptosis",
    dockingReceptor: "BAX trigger/activation domain",
    pdbId: "4ZIE",
    receptorUniprotId: "Q07812",
    referenceUniprotId: "O43521",
    referenceEntityLabel: "Bim-BH3 peptide (Chain C)",
    bindingSiteStrategy: "reference_ligand",
    bindingSiteLabel: "BAX alpha-1/alpha-6 trigger activation site",
    paddingAngstrom: DEFAULT_BOX_PADDING,
    exhaustiveness: VINA_DEFAULTS.exhaustiveness,
    numModes: VINA_DEFAULTS.numModes,
    energyRange: VINA_DEFAULTS.energyRange,
    preparationMethod: "Human BAX chain A ATOM records only. Co-crystallized Bim-BH3 trigger peptide (chain C) and solvent are removed before Meeko receptor PDBQT preparation.",
    provenance: "Search box is derived from the spatial extent of the co-crystallized Bim-BH3 activator peptide (chain C) in PDB 4ZIE with 5 Å padding. Replaces unliganded PDB 4S0O.",
    verificationSource: "RCSB PDB",
  },
  {
    id: "MTOR_PROFILE",
    targetId: "mtor",
    version: "1",
    biologicalTarget: "mTOR",
    pathway: "PI3K/Akt/mTOR",
    dockingReceptor: "mTOR kinase domain",
    pdbId: "4JT5",
    receptorUniprotId: "P42345",
    referenceLigand: "P2X",
    referenceEntityLabel: "PP242 (P2X)",
    bindingSiteStrategy: "reference_ligand",
    bindingSiteLabel: "mTOR catalytic ATP-binding cleft",
    paddingAngstrom: DEFAULT_BOX_PADDING,
    exhaustiveness: VINA_DEFAULTS.exhaustiveness,
    numModes: VINA_DEFAULTS.numModes,
    energyRange: VINA_DEFAULTS.energyRange,
    preparationMethod: "Human mTOR kinase domain (chains A and B) and mLST8 (chains C and D) polymer ATOM records only. Co-crystallized active-site inhibitor PP242 (P2X) is removed before receptor PDBQT preparation.",
    provenance: "Search box is calculated from the coordinates of co-crystallized ATP-competitive inhibitor PP242 (P2X) in PDB 4JT5, expanded by 5 Å padding.",
    verificationSource: "RCSB PDB",
  },
  {
    id: "CASP9_PROFILE",
    targetId: "casp9",
    version: "1",
    biologicalTarget: "Caspase-9",
    pathway: "Intrinsic apoptosis",
    dockingReceptor: "Caspase-9 catalytic heterodimer",
    pdbId: "1JXQ",
    receptorUniprotId: "P55211",
    referenceChain: "E",
    referenceEntityLabel: "z-VAD-FMK inhibitor (Chain E)",
    bindingSiteStrategy: "reference_ligand",
    bindingSiteLabel: "Caspase-9 catalytic active-site cleft",
    paddingAngstrom: DEFAULT_BOX_PADDING,
    exhaustiveness: VINA_DEFAULTS.exhaustiveness,
    numModes: VINA_DEFAULTS.numModes,
    energyRange: VINA_DEFAULTS.energyRange,
    preparationMethod: "Human Caspase-9 catalytic subunits (chains A and B) ATOM records only. Co-crystallized active-site peptide inhibitor z-VAD-FMK (chains E and F) and solvent are removed before receptor PDBQT preparation.",
    provenance: "Search box is derived from the spatial extent of co-crystallized active-site inhibitor z-VAD-FMK (chain E) in PDB 1JXQ with 5 Å padding. Replaces PDB 2AR9.",
    verificationSource: "RCSB PDB",
  },
  {
    id: "TP53_PROFILE",
    targetId: "tp53",
    version: "1",
    biologicalTarget: "p53",
    pathway: "Cell cycle",
    dockingReceptor: "p53 core domain (druggable crevice)",
    pdbId: "2VUK",
    receptorUniprotId: "P04637",
    referenceLigand: "P83",
    referenceEntityLabel: "PhiKan083 (P83)",
    bindingSiteStrategy: "reference_ligand",
    bindingSiteLabel: "p53 core domain small-molecule druggable pocket",
    paddingAngstrom: DEFAULT_BOX_PADDING,
    exhaustiveness: VINA_DEFAULTS.exhaustiveness,
    numModes: VINA_DEFAULTS.numModes,
    energyRange: VINA_DEFAULTS.energyRange,
    preparationMethod: "Human p53 core domain ATOM records only (chains A and B). Co-crystallized stabilizing small molecule PhiKan083 (P83), zinc, and solvent are removed before Meeko receptor PDBQT preparation.",
    provenance: "Search box is calculated from the coordinates of co-crystallized small-molecule stabilizer PhiKan083 (P83) in PDB 2VUK with 5 Å padding. Replaces DNA-complex PDB 1TUP.",
    verificationSource: "RCSB PDB",
  },
  {
    id: "CCND1_CDK_PROFILE",
    targetId: "ccnd1",
    version: "1",
    biologicalTarget: "Cyclin D1",
    pathway: "Cell cycle",
    dockingReceptor: "CDK6 cyclin-dependent kinase domain",
    actualDockingReceptor: "CDK6 catalytic kinase domain",
    researchTarget: "Cyclin D1–CDK signaling",
    structureSource: "EXPERIMENTAL_STRUCTURE",
    structureId: "5L2I",
    structureMethod: "X-ray (2.75 Å)",
    pdbId: "5L2I",
    receptorUniprotId: "Q00534",
    referenceLigand: "LQQ",
    referenceEntityLabel: "Palbociclib (LQQ)",
    bindingSiteStrategy: "reference_ligand",
    bindingSiteLabel: "CDK catalytic ATP-binding cleft",
    bindingSiteSource: "Co-crystallized inhibitor Palbociclib (PDB 5L2I)",
    paddingAngstrom: DEFAULT_BOX_PADDING,
    exhaustiveness: VINA_DEFAULTS.exhaustiveness,
    numModes: VINA_DEFAULTS.numModes,
    energyRange: VINA_DEFAULTS.energyRange,
    preparationMethod: "Human CDK6 catalytic domain (chain A, residues 1-300) ATOM records only. Co-crystallized inhibitor palbociclib (LQQ) and solvent are removed before receptor PDBQT preparation.",
    provenance: "Search box is derived from the spatial extent of co-crystallized Cyclin D1-CDK4/6 inhibitor palbociclib (LQQ) in PDB 5L2I with 5 Å padding.",
    verificationSource: "RCSB PDB",
  },
  {
    id: "LATS1_PROFILE",
    targetId: "lats1",
    version: "1",
    biologicalTarget: "LATS1",
    pathway: "Hippo–YAP",
    dockingReceptor: "LATS1 kinase domain (predicted)",
    actualDockingReceptor: "LATS1 kinase domain",
    researchTarget: "LATS1",
    structureSource: "PREDICTED_STRUCTURE",
    structureId: "AF-O95835-F1",
    structureMethod: "AlphaFold DB v4 (predicted structure)",
    modelSource: "AlphaFold DB",
    modelVersion: "v4",
    modelConfidence: "Average pLDDT 81.8 (catalytic core 98.3)",
    bindingSiteValidationMethod: "Homology mapping to conserved kinase ATP catalytic cleft (Gly-loop 711-719, Lys734, Asp828, Asp846) aligned with homologous NDR1 kinase domain (PDB 6BXI)",
    pdbId: "LATS1_AF",
    receptorUniprotId: "O95835",
    referenceResidueNumbers: [711, 712, 713, 714, 715, 716, 717, 718, 719, 734, 751, 828, 830, 846, 848],
    residueRange: [705, 1010],
    referenceEntityLabel: "ATP catalytic cleft residues (Gly-loop, Lys734, Asp828, Asp846)",
    bindingSiteStrategy: "binding_site_residues",
    bindingSiteLabel: "LATS1 ATP catalytic cleft (conserved kinase core)",
    bindingSiteSource: "Homology-mapped ATP catalytic cleft (Gly-loop 711-719, Lys734, DFG Asp846)",
    paddingAngstrom: DEFAULT_BOX_PADDING,
    exhaustiveness: VINA_DEFAULTS.exhaustiveness,
    numModes: VINA_DEFAULTS.numModes,
    energyRange: VINA_DEFAULTS.energyRange,
    preparationMethod: "Human LATS1 catalytic kinase domain (UniProt O95835, residues 705-1010) from AlphaFold DB model AF-O95835-F1. Non-catalytic regulatory N-terminal residues are omitted before Meeko parameterization.",
    provenance: "Search box is calculated from the spatial coordinates of conserved ATP-binding catalytic cleft residues (Gly-loop 711-719, Lys734, Asp828, Asp846) in the AlphaFold LATS1 kinase domain with 5 Å padding.",
    verificationSource: "AlphaFold DB",
  },
]

const TARGET_ALIASES: Record<string, string[]> = {
  yap1: ["yap1", "yap"],
  keap1: ["keap1", "nrf2", "nrf2 pathway"],
  bax: ["bax"],
  bcl2: ["bcl-2", "bcl2"],
  casp3: ["caspase-3", "casp3"],
  egfr: ["egfr"],
  casp9: ["caspase-9", "casp9"],
  mmp9: ["mmp-9", "mmp9"],
  mtor: ["mtor"],
  tp53: ["p53", "tp53"],
  lats1: ["lats1", "lats"],
  ccnd1: ["cyclin d1", "ccnd1", "cyclin d1 / cdk", "cdk6", "cdk4"],
}

export function profileSpecForProtein(protein: {
  pdbId?: string | null
  uniprotIds?: string[] | null
  name?: string | null
  targetId?: string | null
}): DockingProfileSpec | null {
  const pdbId = protein.pdbId?.trim().toUpperCase()
  if (pdbId) {
    const matches = DOCKING_PROFILE_SPECS.filter((spec) => spec.pdbId === pdbId)
    if (matches.length) {
      const uniprotIds = protein.uniprotIds?.map((id) => id.trim().toUpperCase()).filter(Boolean) ?? []
      if (!uniprotIds.length) return matches[0] ?? null
      const matched = matches.find((spec) => uniprotIds.includes(spec.receptorUniprotId))
      return matched ?? matches[0] ?? null
    }
    return null
  }
  const targetId = protein.targetId?.trim().toLowerCase()
  if (targetId) {
    const byTarget = DOCKING_PROFILE_SPECS.find((spec) => spec.targetId === targetId)
    if (byTarget) return byTarget
  }
  const name = protein.name?.trim().toLowerCase()
  if (name) {
    const byName = DOCKING_PROFILE_SPECS.find(
      (spec) =>
        spec.biologicalTarget.toLowerCase() === name ||
        spec.targetId?.toLowerCase() === name ||
        TARGET_ALIASES[spec.targetId ?? ""]?.includes(name),
    )
    if (byName) return byName
  }
  const uniprotIds = protein.uniprotIds?.map((id) => id.trim().toUpperCase()).filter(Boolean) ?? []
  if (uniprotIds.length) {
    const byUniprot = DOCKING_PROFILE_SPECS.find((spec) => uniprotIds.includes(spec.receptorUniprotId))
    if (byUniprot) return byUniprot
  }
  return null
}

export function materializeDockingProfile(
  spec: DockingProfileSpec,
  pdb: string,
  polymers: RcsbPolymer[],
  verifiedAt: string,
): { ok: true; profile: ResolvedDockingProfile } | { ok: false; reason: string } {
  if (spec.referenceResidue) return materializeModifiedResidue(spec, pdb, polymers, verifiedAt)
  if (spec.bindingSiteStrategy === "binding_site_residues" && spec.referenceResidueNumbers?.length) {
    const wanted = new Set(spec.referenceResidueNumbers)
    const atoms: Array<{ residue: string; chain: string; sequence: string; x: number; y: number; z: number }> = []
    for (const line of pdb.split(/\r?\n/)) {
      if (line.slice(0, 6).trim() !== "ATOM" || line.length < 54) continue
      const seq = parseInt(line.slice(22, 26).trim(), 10)
      if (!wanted.has(seq)) continue
      const x = Number(line.slice(30, 38))
      const y = Number(line.slice(38, 46))
      const z = Number(line.slice(46, 54))
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
      atoms.push({
        residue: line.slice(17, 20).trim().toUpperCase(),
        chain: line[21]?.trim() || "A",
        sequence: String(seq),
        x,
        y,
        z,
      })
    }
    const label = spec.bindingSiteLabel
    const box = calculateSearchBox(atoms, spec.paddingAngstrom, label)
    if (!box || !boxContainsAtoms(box, atoms)) {
      return { ok: false, reason: `Search box for ${spec.id} does not contain ${label}` }
    }
    return {
      ok: true,
      profile: {
        ...spec,
        receptorChains: ["A"],
        referenceChain: "A",
        referenceEntity: spec.referenceEntityLabel ?? "ATP binding site residues",
        centerX: box.centerX,
        centerY: box.centerY,
        centerZ: box.centerZ,
        sizeX: box.sizeX,
        sizeY: box.sizeY,
        sizeZ: box.sizeZ,
        calculationMethod: box.method,
        verifiedAt,
        verifiedBy: spec.id,
      },
    }
  }
  if (spec.bindingSiteStrategy === "binding_site_residues" && spec.referenceResidueNumbers?.length) {
    const wanted = new Set(spec.referenceResidueNumbers)
    const atoms: Array<{ residue: string; chain: string; sequence: string; x: number; y: number; z: number }> = []
    for (const line of pdb.split(/\r?\n/)) {
      if (line.slice(0, 6).trim() !== "ATOM" || line.length < 54) continue
      const seq = parseInt(line.slice(22, 26).trim(), 10)
      if (!wanted.has(seq)) continue
      const x = Number(line.slice(30, 38))
      const y = Number(line.slice(38, 46))
      const z = Number(line.slice(46, 54))
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
      atoms.push({
        residue: line.slice(17, 20).trim().toUpperCase(),
        chain: line[21]?.trim() || "A",
        sequence: String(seq),
        x,
        y,
        z,
      })
    }
    const label = spec.bindingSiteLabel
    const box = calculateSearchBox(atoms, spec.paddingAngstrom, label)
    if (!box || !boxContainsAtoms(box, atoms)) {
      return { ok: false, reason: `Search box for ${spec.id} does not contain ${label}` }
    }
    return {
      ok: true,
      profile: {
        ...spec,
        receptorChains: ["A"],
        referenceChain: "A",
        referenceEntity: spec.referenceEntityLabel ?? "ATP binding site residues",
        centerX: box.centerX,
        centerY: box.centerY,
        centerZ: box.centerZ,
        sizeX: box.sizeX,
        sizeY: box.sizeY,
        sizeZ: box.sizeZ,
        calculationMethod: box.method,
        verifiedAt,
        verifiedBy: spec.id,
      },
    }
  }
  const receptorChains = chainsForUniprot(polymers, spec.receptorUniprotId)
  if (!receptorChains.length) return { ok: false, reason: `No receptor chains for ${spec.receptorUniprotId} in ${spec.pdbId}` }

  const allEntities = listReferenceEntities(pdb, polymers)

  if (spec.referenceLigand) {
    const ligName = spec.referenceLigand.trim().toUpperCase()
    const entity = allEntities.find((item) => item.kind === "ligand" && item.name.toUpperCase() === ligName && (receptorChains.includes(item.chain) || !item.chain))
      ?? allEntities.find((item) => item.kind === "ligand" && item.name.toUpperCase() === ligName)
    if (!entity) return { ok: false, reason: `No reference ligand ${spec.referenceLigand} in ${spec.pdbId}` }
    const atoms = referenceEntityAtoms(pdb, entity)
    const box = calculateSearchBox(atoms, spec.paddingAngstrom, `${entity.name} chain ${entity.chain}`)
    if (!box || !boxContainsAtoms(box, atoms)) {
      return { ok: false, reason: `Search box for ${spec.id} does not contain reference ligand ${spec.referenceLigand}` }
    }
    return {
      ok: true,
      profile: {
        ...spec,
        receptorChains,
        referenceChain: entity.chain,
        referenceEntity: spec.referenceEntityLabel ?? entity.name,
        centerX: box.centerX,
        centerY: box.centerY,
        centerZ: box.centerZ,
        sizeX: box.sizeX,
        sizeY: box.sizeY,
        sizeZ: box.sizeZ,
        calculationMethod: box.method,
        verifiedAt,
        verifiedBy: spec.id,
      },
    }
  }

  if (spec.referenceChain) {
    const entity = allEntities.find((item) => item.chain === spec.referenceChain)
    if (!entity) return { ok: false, reason: `No reference entity on chain ${spec.referenceChain} in ${spec.pdbId}` }
    const atoms = referenceEntityAtoms(pdb, entity)
    const box = calculateSearchBox(atoms, spec.paddingAngstrom, `${entity.name} chain ${entity.chain}`)
    if (!box || !boxContainsAtoms(box, atoms)) {
      return { ok: false, reason: `Search box for ${spec.id} does not contain reference entity on chain ${spec.referenceChain}` }
    }
    const dockingChains = receptorChains.filter((chain) => chain !== entity.chain)
    if (!dockingChains.length) return { ok: false, reason: `Reference chain ${entity.chain} is the only polymer chain in ${spec.pdbId}` }
    return {
      ok: true,
      profile: {
        ...spec,
        receptorChains: dockingChains,
        referenceChain: entity.chain,
        referenceEntity: spec.referenceEntityLabel ?? entity.name,
        centerX: box.centerX,
        centerY: box.centerY,
        centerZ: box.centerZ,
        sizeX: box.sizeX,
        sizeY: box.sizeY,
        sizeZ: box.sizeZ,
        calculationMethod: box.method,
        verifiedAt,
        verifiedBy: spec.id,
      },
    }
  }

  if (spec.referenceUniprotId) {
    const referenceChains = chainsForUniprot(polymers, spec.referenceUniprotId)
      .filter((chain) => !receptorChains.includes(chain))
    if (!referenceChains.length) return { ok: false, reason: `No reference chains for ${spec.referenceUniprotId} in ${spec.pdbId}` }
    const entity = allEntities.find((item) => referenceChains.includes(item.chain))
    if (!entity) return { ok: false, reason: `No reference ligand or peptide atoms for ${spec.referenceUniprotId} in ${spec.pdbId}` }
    const atoms = referenceEntityAtoms(pdb, entity)
    const box = calculateSearchBox(atoms, spec.paddingAngstrom, `${entity.name} chain ${entity.chain}`)
    if (!box || !boxContainsAtoms(box, atoms)) {
      return { ok: false, reason: `Search box for ${spec.id} does not contain the reference entity` }
    }
    const dockingChains = receptorChains.filter((chain) => chain !== entity.chain)
    if (!dockingChains.length) return { ok: false, reason: `Reference chain ${entity.chain} is the only polymer chain in ${spec.pdbId}` }
    return {
      ok: true,
      profile: {
        ...spec,
        receptorChains: dockingChains,
        referenceChain: entity.chain,
        referenceEntity: spec.referenceEntityLabel ?? entity.name,
        centerX: box.centerX,
        centerY: box.centerY,
        centerZ: box.centerZ,
        sizeX: box.sizeX,
        sizeY: box.sizeY,
        sizeZ: box.sizeZ,
        calculationMethod: box.method,
        verifiedAt,
        verifiedBy: spec.id,
      },
    }
  }

  return { ok: false, reason: `No reference ligand or peptide defined for ${spec.id}` }
}

function materializeModifiedResidue(
  spec: DockingProfileSpec,
  pdb: string,
  polymers: RcsbPolymer[],
  verifiedAt: string,
): { ok: true; profile: ResolvedDockingProfile } | { ok: false; reason: string } {
  const residue = spec.referenceResidue?.trim().toUpperCase()
  if (!residue) return { ok: false, reason: `${spec.id} has no reference residue` }
  const allowed = new Set(chainsForUniprot(polymers, spec.receptorUniprotId))
  if (!allowed.size) return { ok: false, reason: `No receptor chains for ${spec.receptorUniprotId} in ${spec.pdbId}` }
  const byChain = new Map<string, Array<{ residue: string; chain: string; sequence: string; x: number; y: number; z: number }>>()
  for (const line of pdb.split(/\r?\n/)) {
    if (line.slice(0, 6).trim() !== "HETATM" || line.length < 54) continue
    if (line.slice(17, 20).trim().toUpperCase() !== residue) continue
    const chain = line[21]?.trim()
    if (!chain || !allowed.has(chain)) continue
    const x = Number(line.slice(30, 38))
    const y = Number(line.slice(38, 46))
    const z = Number(line.slice(46, 54))
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
    const group = byChain.get(chain) ?? []
    group.push({ residue, chain, sequence: line.slice(22, 26).trim(), x, y, z })
    byChain.set(chain, group)
  }
  const chain = [...byChain.keys()].sort().find((item) => (byChain.get(item)?.length ?? 0) >= 2)
  const atoms = chain ? byChain.get(chain) ?? [] : []
  if (!chain || atoms.length < 2) {
    return { ok: false, reason: `No ${residue} atoms on ${spec.receptorUniprotId} in ${spec.pdbId}` }
  }
  const label = `${spec.referenceEntityLabel ?? residue} chain ${chain}`
  const box = calculateSearchBox(atoms, spec.paddingAngstrom, label)
  if (!box || !boxContainsAtoms(box, atoms)) {
    return { ok: false, reason: `Search box for ${spec.id} does not contain ${label}` }
  }
  return {
    ok: true,
    profile: {
      ...spec,
      receptorChains: [chain],
      referenceChain: chain,
      referenceEntity: spec.referenceEntityLabel ?? residue,
      centerX: box.centerX,
      centerY: box.centerY,
      centerZ: box.centerZ,
      sizeX: box.sizeX,
      sizeY: box.sizeY,
      sizeZ: box.sizeZ,
      calculationMethod: box.method,
      verifiedAt,
      verifiedBy: spec.id,
    },
  }
}

function chainsForUniprot(polymers: RcsbPolymer[], uniprotId: string): string[] {
  const id = uniprotId.trim().toUpperCase()
  const chains = polymers
    .filter((polymer) => polymer.uniprotIds.some((item) => item.trim().toUpperCase() === id))
    .flatMap((polymer) => polymer.chains)
  return [...new Set(chains.map((chain) => chain.trim()).filter(Boolean))].sort()
}
