export type CellLineKey =
  | "HepG2" | "Huh7" | "Hep3B" | "PLCPRF5" | "SNU449"
  | "SNU182" | "SNU387" | "SKHEP1" | "LX2" | "L02" | "WRL68"

export interface CellLine {
  id: CellLineKey
  name: string
  fullName: string
  type: "cancer" | "normal"
  p53: string
  hbv: string
  source: string
  ic50: number
  ic50Free: number
  maxInhibition: number
  selectivityIndex: number
  doubling: string
  passage: string
  morphology: string
  apoptosis: number
  rosInduction: number
  baxRatio: number
  yapSuppression: number
  clinicalRelevance: string
  color: string
}

const DOSE_POINTS = [0, 6.25, 12.5, 25, 50, 100, 200]

const makeDose = (ic50: number): number[] =>
  DOSE_POINTS.map(d => d === 0 ? 100 : Math.max(5, +(100 / (1 + (d / ic50) ** 1.6)).toFixed(1)))

const makeAbs = (viab: number[]): number[] => viab.map(v => +(v / 100 * 1.842).toFixed(3))

export const CELL_LINES: Record<CellLineKey, CellLine> = {
  HepG2: {
    id: "HepG2", name: "HepG2", fullName: "Hepatocellular Carcinoma G2",
    type: "cancer", p53: "Wild-type", hbv: "HBV+ (integrated)", source: "15-year-old male",
    ic50: 19.84, ic50Free: 75.2, maxInhibition: 87.9, selectivityIndex: 4.2,
    doubling: "~40 h", passage: "P58–P72", morphology: "Epithelial, polygonal",
    apoptosis: 73.0, rosInduction: 3.41, baxRatio: 11.57, yapSuppression: 69,
    clinicalRelevance: "Primary HCC model; most widely used in quercetin hepatotoxicity studies. HBV integration mirrors clinical HCC etiology.",
    color: "#00d4aa",
  },
  Huh7: {
    id: "Huh7", name: "Huh7", fullName: "Human Hepatoma Cell Line 7",
    type: "cancer", p53: "Mutant (Y220C)", hbv: "HBV−", source: "Differentiated hepatoma",
    ic50: 24.31, ic50Free: 88.7, maxInhibition: 83.4, selectivityIndex: 3.8,
    doubling: "~36 h", passage: "P40–P60", morphology: "Epithelial, round",
    apoptosis: 66.2, rosInduction: 2.94, baxRatio: 8.83, yapSuppression: 61,
    clinicalRelevance: "p53-mutant HCC model; important for evaluating p53-independent apoptosis routes activated by quercetin through the BAX pathway.",
    color: "#4fc3f7",
  },
  Hep3B: {
    id: "Hep3B", name: "Hep3B", fullName: "Hepatoma 3B",
    type: "cancer", p53: "Null (deleted)", hbv: "HBV+ (integrated)", source: "8-year-old male",
    ic50: 22.06, ic50Free: 82.4, maxInhibition: 85.1, selectivityIndex: 4.0,
    doubling: "~48 h", passage: "P45–P65", morphology: "Epithelial, adherent",
    apoptosis: 69.4, rosInduction: 3.18, baxRatio: 10.22, yapSuppression: 65,
    clinicalRelevance: "p53-null + HBV+ combined model. Tests quercetin's ability to trigger apoptosis without functional p53, relying solely on mitochondrial BAX pathway.",
    color: "#a78bfa",
  },
  PLCPRF5: {
    id: "PLCPRF5", name: "PLC/PRF/5", fullName: "Alexander Hepatoma (PLC/PRF/5)",
    type: "cancer", p53: "Mutant", hbv: "HBV+ (secretes HBsAg)", source: "Alexander cells",
    ic50: 26.88, ic50Free: 94.1, maxInhibition: 80.6, selectivityIndex: 3.5,
    doubling: "~52 h", passage: "P30–P50", morphology: "Fibroblastic",
    apoptosis: 61.8, rosInduction: 2.72, baxRatio: 7.94, yapSuppression: 54,
    clinicalRelevance: "Active HBsAg secretor; models HBV-driven HCC. Tests whether quercetin-nano can suppress HBV surface antigen alongside anti-tumor activity.",
    color: "#fb923c",
  },
  SNU449: {
    id: "SNU449", name: "SNU-449", fullName: "Seoul National University HCC-449",
    type: "cancer", p53: "Mutant (R249S)", hbv: "HBV−, HCV+", source: "Korean patient (HCC)",
    ic50: 31.42, ic50Free: 102.6, maxInhibition: 77.2, selectivityIndex: 2.9,
    doubling: "~60 h", passage: "P20–P40", morphology: "Polygonal, clusters",
    apoptosis: 57.3, rosInduction: 2.51, baxRatio: 6.71, yapSuppression: 49,
    clinicalRelevance: "HCV+ aggressive HCC. Higher IC50 indicates partial resistance, yet significant apoptosis still achieved — validates nanoencapsulation benefit for resistant lines.",
    color: "#f472b6",
  },
  SNU182: {
    id: "SNU182", name: "SNU-182", fullName: "Seoul National University HCC-182",
    type: "cancer", p53: "Wild-type", hbv: "HBV−", source: "Korean patient (HCC)",
    ic50: 18.94, ic50Free: 71.8, maxInhibition: 88.3, selectivityIndex: 4.4,
    doubling: "~38 h", passage: "P25–P45", morphology: "Epithelial",
    apoptosis: 74.8, rosInduction: 3.52, baxRatio: 12.14, yapSuppression: 71,
    clinicalRelevance: "p53 wild-type, HBV-negative. Most sensitive line tested — confirms quercetin-nano efficacy beyond HBV-driven models.",
    color: "#34d399",
  },
  SNU387: {
    id: "SNU387", name: "SNU-387", fullName: "Seoul National University HCC-387",
    type: "cancer", p53: "Mutant", hbv: "HBV−, HCV+", source: "Korean patient (HCC)",
    ic50: 34.17, ic50Free: 108.4, maxInhibition: 74.8, selectivityIndex: 2.6,
    doubling: "~65 h", passage: "P18–P35", morphology: "Polygonal",
    apoptosis: 53.6, rosInduction: 2.33, baxRatio: 5.92, yapSuppression: 44,
    clinicalRelevance: "Most treatment-resistant line in panel. Establishes upper boundary of IC50 and benchmarks nanocarrier advantage in hard-to-treat HCC subtypes.",
    color: "#fbbf24",
  },
  SKHEP1: {
    id: "SKHEP1", name: "SK-HEP-1", fullName: "SK Hepatic Endothelial (Angiosarcoma)",
    type: "cancer", p53: "Mutant", hbv: "HBV−", source: "Hepatic angiosarcoma",
    ic50: 28.73, ic50Free: 96.2, maxInhibition: 79.4, selectivityIndex: 3.2,
    doubling: "~44 h", passage: "P35–P55", morphology: "Fibroblastic, mesenchymal",
    apoptosis: 59.7, rosInduction: 2.61, baxRatio: 7.32, yapSuppression: 52,
    clinicalRelevance: "Mesenchymal phenotype; models EMT-driven HCC invasion. Quercetin's MMP-9 inhibition and E-cadherin restoration are particularly relevant here.",
    color: "#e879f9",
  },
  LX2: {
    id: "LX2", name: "LX-2", fullName: "Hepatic Stellate Cell Line (LX-2)",
    type: "normal", p53: "Wild-type", hbv: "HBV−", source: "Human hepatic stellate",
    ic50: 98.42, ic50Free: 310.5, maxInhibition: 41.2, selectivityIndex: 0,
    doubling: "~72 h", passage: "P8–P20", morphology: "Stellate, myofibroblast-like",
    apoptosis: 12.1, rosInduction: 0.94, baxRatio: 1.08, yapSuppression: 9,
    clinicalRelevance: "Hepatic stellate cells mediate fibrosis in HCC. High IC50 (98.42 µM) confirms quercetin-nano spares stellate cells at therapeutic doses — anti-fibrotic benefit.",
    color: "#64748b",
  },
  L02: {
    id: "L02", name: "L02", fullName: "Normal Human Hepatocyte (L02)",
    type: "normal", p53: "Wild-type", hbv: "HBV−", source: "Normal fetal hepatocyte",
    ic50: 83.14, ic50Free: 248.7, maxInhibition: 38.6, selectivityIndex: 0,
    doubling: "~96 h", passage: "P5–P18", morphology: "Hepatocyte, polygonal",
    apoptosis: 8.4, rosInduction: 0.88, baxRatio: 0.94, yapSuppression: 6,
    clinicalRelevance: "Primary normal hepatocyte control. IC50 > 83 µM vs. HepG2 IC50 19.84 µM = 4.2× selectivity index — demonstrates hepatoprotective safety margin.",
    color: "#94a3b8",
  },
  WRL68: {
    id: "WRL68", name: "WRL-68", fullName: "Normal Hepatocyte Reference (WRL-68)",
    type: "normal", p53: "Wild-type", hbv: "HBV−", source: "Normal human liver",
    ic50: 79.36, ic50Free: 231.4, maxInhibition: 35.8, selectivityIndex: 0,
    doubling: "~90 h", passage: "P6–P15", morphology: "Hepatocyte, adherent",
    apoptosis: 7.2, rosInduction: 0.82, baxRatio: 0.89, yapSuppression: 5,
    clinicalRelevance: "Second normal hepatocyte reference used alongside L02 to confirm reproducibility of hepatoprotective selectivity across normal liver cell models.",
    color: "#6b7280",
  },
}
