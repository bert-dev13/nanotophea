/**
 * Reusable research identities. These are not study records.
 * A study receives one only when the researcher explicitly adds it.
 */
import type { FormulationComponent } from "@/lib/domain/models"

export interface CatalogFormulation {
  key: string
  name: string
  plantMaterial: string
  scientificName?: string
  components: FormulationComponent[]
  methodNotes?: string
  storageNotes?: string
  notes?: string
  source?: string
}

export type CompoundFilter =
  | "flavonoids"
  | "phenolics"
  | "tannins"
  | "lignans"
  | "alkaloids"
  | "sterols"

export interface CatalogCompound {
  key: string
  name: string
  pubchemCid?: number
  smiles?: string
  formula?: string
  molecularWeight?: number
  chemicalClass?: string
  plantPart?: string
  filter?: CompoundFilter
  source?: string
  notes?: string
}

export type ProteinGroup =
  | "oncogene"
  | "tumor-suppressor"
  | "apoptosis"
  | "antioxidant"
  | "invasion"
  | "cell-cycle"
  | "signaling"

export interface CatalogProtein {
  key: string
  name: string
  gene?: string
  geneSymbol?: string
  proteinName?: string
  biologicalTarget?: string
  pdbId?: string
  structureId?: string
  structureSource?: "EXPERIMENTAL_STRUCTURE" | "PREDICTED_STRUCTURE"
  structureProtein?: string
  structureContext?: string
  uniprotIds?: string[]
  verificationSource?: "RCSB PDB" | "AlphaFold DB"
  pathway?: string
  role?: string
  group?: ProteinGroup
  functionNotes?: string
  source?: string
}

export function catalogProteinInput(item: CatalogProtein): Omit<import("@/lib/domain/models").Protein, "id" | "studyId" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"> {
  return {
    name: item.name,
    gene: item.gene,
    geneSymbol: item.geneSymbol ?? item.gene,
    proteinName: item.proteinName ?? item.name,
    biologicalTarget: item.biologicalTarget ?? item.name,
    pdbId: item.pdbId,
    pathway: item.pathway,
    role: item.role,
    functionNotes: item.functionNotes,
    source: item.source,
    structureProtein: item.structureProtein,
    structureContext: item.structureContext,
    uniprotIds: item.uniprotIds,
    verificationSource: item.verificationSource,
    referenceIds: [],
    provenance: {
      evidenceClass: "REFERENCE",
      source: item.source ?? "Catalog",
      recordedAt: new Date().toISOString(),
      operatorId: "system",
    },
  }
}

export interface CatalogCellLine {
  key: string
  name: string
  fullName?: string
  organism?: string
  tissueOrigin?: string
  diseaseContext?: string
  lineType: "cancer" | "normal" | "other"
  p53Status?: string
  hbvStatus?: string
  donor?: string
  doublingTime?: string
  morphology?: string
  source?: string
  notes?: string
}

export const CATALOG_FORMULATIONS: CatalogFormulation[] = [
  {
    key: "nanohepatotea",
    name: "NanoHepatoTea",
    plantMaterial: "Dried Phyllanthus niruri (Sampasampalukan) leaf",
    scientificName: "Phyllanthus niruri L.",
    components: [
      { name: "Dried Phyllanthus niruri leaf", amount: 2, unit: "g" },
      { name: "Chitosan–TPP nanocarrier", amount: 1, unit: "g" },
    ],
    methodNotes:
      "Chitosan–TPP nanocarrier prepared by ionic gelation; encapsulating aqueous P. niruri extract.",
    storageNotes: "Store finished tea bags in clean, dry, sealed packaging.",
    notes: "Optional catalog formulation. Not attached until this study selects it.",
    source: "Research protocol",
  },
]

export const CATALOG_COMPOUNDS: CatalogCompound[] = [
  {
    key: "quercetin",
    name: "Quercetin",
    pubchemCid: 5280343,
    smiles: "O=c1c(O)c(-c2ccc(O)c(O)c2)oc2cc(O)cc(O)c12",
    formula: "C15H10O7",
    molecularWeight: 302.24,
    chemicalClass: "Flavonol",
    plantPart: "Leaves, stems (primary compound)",
    filter: "flavonoids",
    source: "PubChem CID 5280343",
    notes: "Primary bioactive flavonoid in Sampasampalukan. Inhibits YAP1–TEAD4, activates BAX/caspase cascade, and upregulates Nrf2 antioxidant defense.",
  },
  {
    key: "rutin",
    name: "Rutin",
    pubchemCid: 5280805,
    smiles: "O=c1c(OC2OC(CO)C(O)C(O)C2OC2OC(C)C(O)C(O)C2)c(-c2ccc(O)c(O)c2)oc2cc(O)cc(O)c12",
    formula: "C27H30O16",
    molecularWeight: 610.52,
    chemicalClass: "Flavonoid glycoside",
    plantPart: "Leaves, fruits",
    filter: "flavonoids",
    source: "PubChem CID 5280805",
    notes: "Quercetin-3-rutinoside. Demonstrates strong hepatoprotective profile, reducing ALT/AST in liver injury models.",
  },
  {
    key: "luteolin",
    name: "Luteolin",
    pubchemCid: 5280445,
    smiles: "O=c1cc(-c2ccc(O)c(O)c2)oc2cc(O)cc(O)c12",
    formula: "C15H10O6",
    molecularWeight: 286.24,
    chemicalClass: "Flavone",
    plantPart: "Whole plant",
    filter: "flavonoids",
    source: "PubChem CID 5280445",
    notes: "Flavone that inhibits EGFR/mTOR signaling and MMP-9 matrix metalloproteinase, suppressing HCC invasion and migration.",
  },
  {
    key: "kaempferol",
    name: "Kaempferol",
    pubchemCid: 5280863,
    smiles: "O=c1c(O)c(-c2ccc(O)cc2)oc2cc(O)cc(O)c12",
    formula: "C15H10O6",
    molecularWeight: 286.24,
    chemicalClass: "Flavonol",
    plantPart: "Leaves",
    filter: "flavonoids",
    source: "PubChem CID 5280863",
    notes: "Flavonol with 4'-mono-hydroxyl B-ring. Inhibits Cyclin D1 and induces G2/M cell cycle arrest in HCC.",
  },
  {
    key: "astragalin",
    name: "Astragalin",
    pubchemCid: 5318767,
    smiles: "O=c1c(OC2OC(CO)C(O)C(O)C2O)c(-c2ccc(O)cc2)oc2cc(O)cc(O)c12",
    formula: "C21H20O11",
    molecularWeight: 448.38,
    chemicalClass: "Flavonoid glycoside",
    plantPart: "Leaves",
    filter: "flavonoids",
    source: "PubChem CID 5318767",
    notes: "Kaempferol-3-O-glucoside with anti-invasive properties via MMP-9 inhibition; induces autophagy in HepG2 cells.",
  },
  {
    key: "gallicacid",
    name: "Gallic Acid",
    pubchemCid: 370,
    smiles: "OC(=O)c1cc(O)c(O)c(O)c1",
    formula: "C7H6O5",
    molecularWeight: 170.12,
    chemicalClass: "Phenolic acid",
    plantPart: "Whole plant",
    filter: "phenolics",
    source: "PubChem CID 370",
    notes: "Simple phenolic acid and precursor to ellagitannins. High free radical scavenging capacity (DPPH IC50 3.2 µM).",
  },
  {
    key: "ellagicacid",
    name: "Ellagic Acid",
    pubchemCid: 5281855,
    smiles: "O=c1oc2c(O)c(O)cc3c(=O)oc4cc(O)c(O)cc4c1c23",
    formula: "C14H6O8",
    molecularWeight: 302.19,
    chemicalClass: "Polyphenol / Tannin",
    plantPart: "Fruits, leaves",
    filter: "tannins",
    source: "PubChem CID 5281855",
    notes: "Planar polycyclic structure with strong Nrf2 activation and topoisomerase II inhibition, exhibiting dual action against HCC.",
  },
  {
    key: "corilagin",
    name: "Corilagin",
    pubchemCid: 73568,
    smiles: "O=C(OC1OC(OC(=O)c2cc(O)c(O)c(O)c2)C(O)C(O)C1O)c1cc(O)c(O)c(O)c1",
    formula: "C27H22O18",
    molecularWeight: 634.44,
    chemicalClass: "Ellagitannin",
    plantPart: "Whole plant (major tannin)",
    filter: "tannins",
    source: "PubChem CID 73568",
    notes: "Signature ellagitannin of Phyllanthus niruri. High molecular weight provides multipoint interactions; strong hepatoprotection against CCl4 injury.",
  },
  {
    key: "geraniin",
    name: "Geraniin",
    pubchemCid: 119084,
    smiles: "O=C1OC(OC(=O)c2cc(O)c(O)c(O)c2)C(OC(=O)c2cc(O)c(O)c(O)c2)C(OC(=O)c2cc(O)c(O)c(O)c2)C1O",
    formula: "C41H28O27",
    molecularWeight: 952.64,
    chemicalClass: "Ellagitannin",
    plantPart: "Leaves (abundant)",
    filter: "tannins",
    source: "PubChem CID 119084",
    notes: "Abundant complex ellagitannin in Sampasampalukan. Multiple galloyl groups enable exceptionally strong binding across Bcl-2 and VEGFR2.",
  },
  {
    key: "phyllanthin",
    name: "Phyllanthin",
    pubchemCid: 9908089,
    smiles: "COc1cc(CC(COc2cc(OC)c(OC)cc2CC)OC)ccc1OC",
    formula: "C24H34O6",
    molecularWeight: 418.52,
    chemicalClass: "Lignan",
    plantPart: "Whole plant (marker compound)",
    filter: "lignans",
    source: "PubChem CID 9908089",
    notes: "Chemotaxonomic marker lignan of Phyllanthus species. High lipophilicity gives membrane permeability; inhibits CYP2E1 hepatotoxicity.",
  },
  {
    key: "hypophyllanthin",
    name: "Hypophyllanthin",
    pubchemCid: 9979682,
    smiles: "COc1cc(CC(COc2cc(OC)c(OC)cc2CC)OC)ccc1OC",
    formula: "C24H34O7",
    molecularWeight: 434.52,
    chemicalClass: "Lignan",
    plantPart: "Whole plant (co-marker)",
    filter: "lignans",
    source: "PubChem CID 9979682",
    notes: "Structural analog of phyllanthin with an additional hydroxyl group. Demonstrated hepatoprotective properties and reduces HBsAg secretion.",
  },
  {
    key: "niranthin",
    name: "Niranthin",
    pubchemCid: 12303734,
    smiles: "COc1cc([C@@H]2OC[C@@H]3[C@@H]2CC(=C)[C@@H]3Cc2ccc(OC)c(OC)c2)ccc1OC",
    formula: "C24H32O6",
    molecularWeight: 416.50,
    chemicalClass: "Lignan",
    plantPart: "Roots, stems",
    filter: "lignans",
    source: "PubChem CID 12303734",
    notes: "Cyclolignan specific to Phyllanthus genus. Inhibits HBV DNA replication and shows selective cytotoxicity in HBV-associated HCC.",
  },
  {
    key: "securinine",
    name: "Securinine",
    pubchemCid: 10010,
    smiles: "O=C1OCC=C2CCCCN3CC=CC(=C1)[C@H]23",
    formula: "C13H15NO2",
    molecularWeight: 217.27,
    chemicalClass: "Alkaloid",
    plantPart: "Whole plant",
    filter: "alkaloids",
    source: "PubChem CID 10010",
    notes: "Unique securinega alkaloid that promotes cell differentiation in HCC models, providing a distinct complementary therapeutic mechanism.",
  },
  {
    key: "betasitosterol",
    name: "β-Sitosterol",
    pubchemCid: 222284,
    smiles: "CCC(CCC(C)C1CCC2C3CC=C4CC(O)CCC4(C)C3CCC12C)C",
    formula: "C29H50O",
    molecularWeight: 414.71,
    chemicalClass: "Phytosterol",
    plantPart: "Whole plant",
    filter: "sterols",
    source: "PubChem CID 222284",
    notes: "Plant sterol with high lipophilicity that inserts into and disrupts cancer cell membrane lipid rafts while modulating androgen receptor signaling.",
  },
]

export const CATALOG_PROTEINS: CatalogProtein[] = [
  {
    key: "yap1",
    name: "YAP1",
    gene: "YAP1",
    geneSymbol: "YAP1",
    pdbId: "3KYS",
    uniprotIds: ["P28347", "P46937"],
    pathway: "Hippo–YAP",
    role: "oncogene / transcriptional co-activator",
    group: "oncogene",
    biologicalTarget: "YAP1",
    structureProtein: "TEAD1 YAP-binding domain",
    structureContext: "YAP–TEAD1 complex (PDB 3KYS)",
    verificationSource: "RCSB PDB",
    functionNotes: "TEAD-associated transcriptional co-activator in Hippo signaling.",
    source: "RCSB PDB 3KYS",
  },
  {
    key: "bax",
    name: "BAX",
    gene: "BAX",
    geneSymbol: "BAX",
    pdbId: "4ZIE",
    uniprotIds: ["Q07812", "O43521"],
    pathway: "Intrinsic apoptosis",
    role: "pro-apoptotic pore former",
    group: "apoptosis",
    biologicalTarget: "BAX",
    structureProtein: "BAX trigger/activation domain",
    structureContext: "BAX–Bim BH3 complex (PDB 4ZIE)",
    verificationSource: "RCSB PDB",
    functionNotes: "Pro-apoptotic Bcl-2 family member; executes mitochondrial outer membrane permeabilization.",
    source: "RCSB PDB 4ZIE",
  },
  {
    key: "bcl2",
    name: "BCL-2",
    gene: "BCL2",
    geneSymbol: "BCL2",
    pdbId: "4LVT",
    uniprotIds: ["P10415"],
    pathway: "Intrinsic apoptosis",
    role: "anti-apoptotic regulator",
    group: "apoptosis",
    biologicalTarget: "BCL-2",
    structureProtein: "BCL-2 BH3-binding groove",
    structureContext: "BCL-2 bound to Navitoclax 1XJ (PDB 4LVT)",
    verificationSource: "RCSB PDB",
    functionNotes: "Anti-apoptotic regulator sequestering pro-apoptotic BH3-only proteins.",
    source: "RCSB PDB 4LVT",
  },
  {
    key: "casp3",
    name: "Caspase-3",
    gene: "CASP3",
    geneSymbol: "CASP3",
    pdbId: "2XYG",
    uniprotIds: ["P42574"],
    pathway: "Apoptosis execution",
    role: "executioner caspase",
    group: "apoptosis",
    biologicalTarget: "Caspase-3",
    structureProtein: "Caspase-3 p17/p12 heterodimer",
    structureContext: "Caspase-3 catalytic cleft bound to TQ8 (PDB 2XYG)",
    verificationSource: "RCSB PDB",
    functionNotes: "Primary executioner caspase cleaving cellular substrates during apoptosis.",
    source: "RCSB PDB 2XYG",
  },
  {
    key: "keap1",
    name: "KEAP1",
    gene: "KEAP1",
    geneSymbol: "KEAP1",
    pdbId: "8EJR",
    uniprotIds: ["Q14145", "Q16236"],
    pathway: "Oxidative stress / Keap1–Nrf2",
    role: "sensor / Cullin3 E3 ligase adaptor",
    group: "antioxidant",
    biologicalTarget: "Nrf2 pathway",
    structureProtein: "KEAP1 Kelch domain",
    structureContext: "KEAP1 Kelch domain bound to Nrf2 ETGE motif (PDB 8EJR)",
    verificationSource: "RCSB PDB",
    functionNotes: "Redox sensor regulating proteasomal degradation of Nrf2.",
    source: "RCSB PDB 8EJR",
  },
  {
    key: "lats1",
    name: "LATS1",
    gene: "LATS1",
    geneSymbol: "LATS1",
    pdbId: "LATS1_AF",
    structureId: "AF-O95835-F1",
    structureSource: "PREDICTED_STRUCTURE",
    uniprotIds: ["O95835"],
    pathway: "Hippo–YAP",
    role: "tumor suppressor kinase (core Hippo signaling)",
    group: "tumor-suppressor",
    biologicalTarget: "LATS1",
    structureProtein: "LATS1 catalytic kinase domain (residues 705–1010)",
    structureContext: "Predicted kinase domain model (AlphaFold DB AF-O95835-F1)",
    verificationSource: "AlphaFold DB",
    functionNotes: "Core serine/threonine kinase in the Hippo pathway directly phosphorylating and inhibiting YAP1.",
    source: "AlphaFold DB AF-O95835-F1",
  },
  {
    key: "tp53",
    name: "p53",
    gene: "TP53",
    geneSymbol: "TP53",
    pdbId: "2VUK",
    uniprotIds: ["P04637"],
    pathway: "Cell cycle / DNA damage response",
    role: "tumor suppressor / transcription factor",
    group: "tumor-suppressor",
    biologicalTarget: "p53",
    structureProtein: "p53 core domain (druggable crevice)",
    structureContext: "p53 core domain stabilized by PhiKan083 P83 (PDB 2VUK)",
    verificationSource: "RCSB PDB",
    functionNotes: "Master tumor suppressor coordinating cell-cycle arrest, senescence, and apoptosis in response to DNA damage.",
    source: "RCSB PDB 2VUK",
  },
  {
    key: "egfr",
    name: "EGFR",
    gene: "EGFR",
    geneSymbol: "EGFR",
    pdbId: "1M17",
    uniprotIds: ["P00533"],
    pathway: "PI3K/Akt/mTOR & MAPK",
    role: "receptor tyrosine kinase / oncogene",
    group: "oncogene",
    biologicalTarget: "EGFR",
    structureProtein: "EGFR tyrosine kinase domain",
    structureContext: "EGFR kinase catalytic cleft bound to Erlotinib AQ4 (PDB 1M17)",
    verificationSource: "RCSB PDB",
    functionNotes: "Transmembrane receptor tyrosine kinase driving cell survival and proliferation signaling.",
    source: "RCSB PDB 1M17",
  },
  {
    key: "casp9",
    name: "Caspase-9",
    gene: "CASP9",
    geneSymbol: "CASP9",
    pdbId: "1JXQ",
    uniprotIds: ["P55211"],
    pathway: "Intrinsic apoptosis",
    role: "initiator caspase",
    group: "apoptosis",
    biologicalTarget: "Caspase-9",
    structureProtein: "Caspase-9 catalytic heterodimer",
    structureContext: "Caspase-9 catalytic subunits bound to z-VAD-FMK (PDB 1JXQ)",
    verificationSource: "RCSB PDB",
    functionNotes: "Apaf-1 apoptosome-activated initiator caspase that cleaves and activates downstream executioner Caspase-3.",
    source: "RCSB PDB 1JXQ",
  },
  {
    key: "mmp9",
    name: "MMP-9",
    gene: "MMP9",
    geneSymbol: "MMP9",
    pdbId: "1GKC",
    uniprotIds: ["P14780"],
    pathway: "Invasion & ECM degradation",
    role: "matrix metalloproteinase",
    group: "invasion",
    biologicalTarget: "MMP-9",
    structureProtein: "MMP-9 catalytic domain",
    structureContext: "MMP-9 catalytic zinc domain bound to NFH (PDB 1GKC)",
    verificationSource: "RCSB PDB",
    functionNotes: "Zinc-dependent endopeptidase degrading extracellular matrix and facilitating tumor invasion and metastasis.",
    source: "RCSB PDB 1GKC",
  },
  {
    key: "mtor",
    name: "mTOR",
    gene: "MTOR",
    geneSymbol: "MTOR",
    pdbId: "4JT5",
    uniprotIds: ["P42345"],
    pathway: "PI3K/Akt/mTOR",
    role: "serine/threonine kinase",
    group: "signaling",
    biologicalTarget: "mTOR",
    structureProtein: "mTOR kinase domain",
    structureContext: "mTOR-mLST8 kinase catalytic cleft bound to PP242 P2X (PDB 4JT5)",
    verificationSource: "RCSB PDB",
    functionNotes: "Central kinase integrator of nutrient sensing, cell growth, metabolism, and autophagy.",
    source: "RCSB PDB 4JT5",
  },
  {
    key: "ccnd1",
    name: "Cyclin D1",
    gene: "CCND1",
    geneSymbol: "CCND1",
    pdbId: "5L2I",
    uniprotIds: ["Q00534", "P24385"],
    pathway: "Cell cycle",
    role: "cell-cycle G1/S transition regulator",
    group: "cell-cycle",
    biologicalTarget: "Cyclin D1",
    structureProtein: "CDK6 cyclin-dependent kinase domain",
    structureContext: "Cyclin D1–CDK signaling complex (CDK6 bound to Palbociclib LQQ, PDB 5L2I)",
    verificationSource: "RCSB PDB",
    functionNotes: "Regulatory subunit forming active holoenzyme complexes with CDK4/6 to promote G1 to S phase cell cycle progression.",
    source: "RCSB PDB 5L2I",
  },
]

export const CATALOG_CELL_LINES: CatalogCellLine[] = [
  {
    key: "hepg2",
    name: "HepG2",
    fullName: "Hepatocellular carcinoma HepG2",
    organism: "Homo sapiens",
    tissueOrigin: "Liver",
    diseaseContext: "Hepatocellular carcinoma",
    lineType: "cancer",
    p53Status: "Wild-type",
    hbvStatus: "HBV+ (integrated)",
    source: "Common HCC research model",
    notes: "Optional experimental model. Not attached until this study selects it.",
  },
]
