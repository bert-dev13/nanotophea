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

export interface CatalogCompound {
  key: string
  name: string
  pubchemCid?: number
  smiles?: string
  formula?: string
  molecularWeight?: number
  chemicalClass?: string
  plantPart?: string
  source?: string
  notes?: string
}

export interface CatalogProtein {
  key: string
  name: string
  gene?: string
  pdbId?: string
  pathway?: string
  role?: string
  functionNotes?: string
  source?: string
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
    smiles: "C1=CC(=C(C=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O)O",
    formula: "C15H10O7",
    molecularWeight: 302.24,
    chemicalClass: "Flavonol",
    plantPart: "Leaves / stems (marker)",
    source: "PubChem CID 5280343",
    notes: "Optional catalog compound. Selecting a plant does not add this record.",
  },
]

export const CATALOG_PROTEINS: CatalogProtein[] = [
  {
    key: "yap1",
    name: "YAP1",
    gene: "YAP1",
    pdbId: "5YLH",
    pathway: "Hippo–YAP",
    role: "oncogene / transcriptional co-activator",
    functionNotes: "TEAD-associated transcriptional co-activator.",
    source: "RCSB PDB 5YLH",
  },
  {
    key: "bax",
    name: "BAX",
    gene: "BAX",
    pdbId: "4S0O",
    pathway: "Intrinsic apoptosis",
    role: "pro-apoptotic",
    source: "RCSB PDB 4S0O",
  },
  {
    key: "bcl2",
    name: "BCL-2",
    gene: "BCL2",
    pdbId: "2YIU",
    pathway: "Intrinsic apoptosis",
    role: "anti-apoptotic",
    source: "RCSB PDB 2YIU",
  },
  {
    key: "casp3",
    name: "Caspase-3",
    gene: "CASP3",
    pdbId: "2XYG",
    pathway: "Apoptosis execution",
    role: "executioner caspase",
    source: "RCSB PDB 2XYG",
  },
  {
    key: "nrf2",
    name: "Nrf2",
    gene: "NFE2L2",
    pdbId: "4IS9",
    pathway: "Oxidative stress / Keap1–Nrf2",
    role: "antioxidant regulator",
    source: "RCSB PDB 4IS9",
  },
  {
    key: "lats1",
    name: "LATS1",
    gene: "LATS1",
    pdbId: "5YLH",
    pathway: "Hippo–YAP",
    role: "tumor suppressor kinase",
    source: "RCSB PDB 5YLH",
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
  {
    key: "l02",
    name: "L02",
    fullName: "Normal human hepatocyte L02",
    organism: "Homo sapiens",
    tissueOrigin: "Liver",
    diseaseContext: "Normal hepatocyte reference",
    lineType: "normal",
    source: "Research protocol context catalog",
  },
]
