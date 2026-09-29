import type { ProteinTarget } from "@/types"

export type { ProteinTarget }

const PROTEINS: ProteinTarget[] = [
  {
    id: "YAP1", name: "YAP1", gene: "YAP1", pdb: "5YLH", pathway: "Hippo–YAP",
    role: "oncogene", bindingScore: -8.4, ki: "0.68 µM", rmsd: "1.12 Å", confidence: 94,
    interactions: [
      { type: "H-bond", residue: "Glu406", dist: "3.21 Å" },
      { type: "H-bond", residue: "His400", dist: "2.89 Å" },
      { type: "π–π Stack", residue: "Phe355", dist: "3.78 Å" },
      { type: "Hydrophobic", residue: "Leu398", dist: "4.12 Å" },
    ],
    function: "Transcriptional co-activator; nuclear YAP drives HCC proliferation via TEAD4",
    effect: "downregulated", foldChange: 0.31, color: "#4fc3f7",
  },
  {
    id: "BAX", name: "BAX", gene: "BAX", pdb: "4S0O", pathway: "Intrinsic Apoptosis",
    role: "apoptosis", bindingScore: -7.9, ki: "1.64 µM", rmsd: "0.89 Å", confidence: 91,
    interactions: [
      { type: "H-bond", residue: "Asp98", dist: "2.94 Å" },
      { type: "H-bond", residue: "Gly67", dist: "3.08 Å" },
      { type: "Hydrophobic", residue: "Ala46", dist: "4.02 Å" },
    ],
    function: "Pro-apoptotic pore-forming protein; triggers cytochrome c release from mitochondria",
    effect: "upregulated", foldChange: 3.24, color: "#fb923c",
  },
  {
    id: "BCL2", name: "BCL-2", gene: "BCL2", pdb: "2YIU", pathway: "Intrinsic Apoptosis",
    role: "oncogene", bindingScore: -7.6, ki: "2.73 µM", rmsd: "0.94 Å", confidence: 89,
    interactions: [
      { type: "H-bond", residue: "Arg105", dist: "3.14 Å" },
      { type: "Van der Waals", residue: "Val133", dist: "4.34 Å" },
      { type: "Hydrophobic", residue: "Phe101", dist: "3.92 Å" },
    ],
    function: "Anti-apoptotic; sequesters BAX and prevents mitochondrial outer membrane permeabilization",
    effect: "downregulated", foldChange: 0.28, color: "#f472b6",
  },
  {
    id: "CASP3", name: "Caspase-3", gene: "CASP3", pdb: "2XYG", pathway: "Intrinsic Apoptosis",
    role: "apoptosis", bindingScore: -7.2, ki: "4.82 µM", rmsd: "1.38 Å", confidence: 87,
    interactions: [
      { type: "H-bond", residue: "Cys163", dist: "3.02 Å" },
      { type: "H-bond", residue: "His121", dist: "2.98 Å" },
      { type: "Hydrophobic", residue: "Trp206", dist: "4.41 Å" },
    ],
    function: "Executioner caspase; cleaves PARP, lamin, and cytoskeletal proteins to execute apoptosis",
    effect: "upregulated", foldChange: 3.08, color: "#00d4aa",
  },
  {
    id: "NRF2", name: "Nrf2", gene: "NFE2L2", pdb: "4IS9", pathway: "Oxidative Stress",
    role: "antioxidant", bindingScore: -8.1, ki: "1.02 µM", rmsd: "1.05 Å", confidence: 92,
    interactions: [
      { type: "H-bond", residue: "Lys572", dist: "3.18 Å" },
      { type: "H-bond", residue: "Ser373", dist: "3.31 Å" },
      { type: "π–π Stack", residue: "Tyr572", dist: "3.62 Å" },
    ],
    function: "Master antioxidant transcription factor; activates HO-1, SOD, GPx, catalase genes",
    effect: "upregulated", foldChange: 2.18, color: "#a78bfa",
  },
  {
    id: "LATS1", name: "LATS1", gene: "LATS1", pdb: "5YLH", pathway: "Hippo–YAP",
    role: "tumor-suppressor", bindingScore: -6.8, ki: "9.22 µM", rmsd: "1.61 Å", confidence: 82,
    interactions: [
      { type: "H-bond", residue: "Asp1031", dist: "3.41 Å" },
      { type: "Hydrophobic", residue: "Ile948", dist: "4.22 Å" },
    ],
    function: "Tumor suppressor kinase; phosphorylates YAP at Ser127 causing cytoplasmic sequestration",
    effect: "upregulated", foldChange: 1.82, color: "#34d399",
  },
  {
    id: "TP53", name: "p53", gene: "TP53", pdb: "1TUP", pathway: "Cell Cycle / Apoptosis",
    role: "tumor-suppressor", bindingScore: -6.4, ki: "14.6 µM", rmsd: "1.74 Å", confidence: 78,
    interactions: [
      { type: "H-bond", residue: "Arg248", dist: "3.28 Å" },
      { type: "Van der Waals", residue: "Lys120", dist: "4.58 Å" },
    ],
    function: "Guardian of genome; transactivates BAX, PUMA, and p21 for apoptosis and cell cycle arrest",
    effect: "upregulated", foldChange: 1.64, color: "#fbbf24",
  },
  {
    id: "EGFR", name: "EGFR", gene: "EGFR", pdb: "1IVO", pathway: "PI3K/Akt/mTOR",
    role: "oncogene", bindingScore: -7.1, ki: "5.94 µM", rmsd: "1.29 Å", confidence: 85,
    interactions: [
      { type: "H-bond", residue: "Met793", dist: "3.05 Å" },
      { type: "H-bond", residue: "Lys745", dist: "3.12 Å" },
      { type: "Hydrophobic", residue: "Leu858", dist: "4.08 Å" },
    ],
    function: "Receptor tyrosine kinase; activates PI3K/Akt and RAS/MAPK pro-survival cascades",
    effect: "downregulated", foldChange: 0.44, color: "#e879f9",
  },
  {
    id: "CASP9", name: "Caspase-9", gene: "CASP9", pdb: "2AR9", pathway: "Intrinsic Apoptosis",
    role: "apoptosis", bindingScore: -6.9, ki: "7.41 µM", rmsd: "1.48 Å", confidence: 83,
    interactions: [
      { type: "H-bond", residue: "Asp315", dist: "3.21 Å" },
      { type: "Hydrophobic", residue: "Trp310", dist: "4.18 Å" },
    ],
    function: "Initiator caspase; activated by cytochrome c/Apaf-1 apoptosome; cleaves and activates CASP3",
    effect: "upregulated", foldChange: 2.51, color: "#06b6d4",
  },
  {
    id: "MMP9", name: "MMP-9", gene: "MMP9", pdb: "1GKC", pathway: "Invasion / Metastasis",
    role: "invasion", bindingScore: -7.3, ki: "4.11 µM", rmsd: "1.32 Å", confidence: 86,
    interactions: [
      { type: "H-bond", residue: "Glu402", dist: "3.08 Å" },
      { type: "Van der Waals", residue: "His401", dist: "4.22 Å" },
      { type: "Hydrophobic", residue: "Leu188", dist: "3.98 Å" },
    ],
    function: "Matrix metalloproteinase; degrades ECM to enable HCC invasion and metastasis",
    effect: "downregulated", foldChange: 0.36, color: "#f97316",
  },
  {
    id: "MTOR", name: "mTOR", gene: "MTOR", pdb: "4JSV", pathway: "PI3K/Akt/mTOR",
    role: "oncogene", bindingScore: -7.8, ki: "1.98 µM", rmsd: "1.18 Å", confidence: 90,
    interactions: [
      { type: "H-bond", residue: "Asp2357", dist: "3.19 Å" },
      { type: "H-bond", residue: "Lys2187", dist: "2.96 Å" },
      { type: "Hydrophobic", residue: "Phe2358", dist: "4.01 Å" },
    ],
    function: "Serine/threonine kinase; promotes HCC cell growth, protein synthesis, and autophagy resistance",
    effect: "downregulated", foldChange: 0.39, color: "#84cc16",
  },
  {
    id: "CCND1", name: "Cyclin D1", gene: "CCND1", pdb: "2W9Z", pathway: "Cell Cycle",
    role: "oncogene", bindingScore: -6.6, ki: "11.8 µM", rmsd: "1.52 Å", confidence: 80,
    interactions: [
      { type: "H-bond", residue: "Asp97", dist: "3.35 Å" },
      { type: "Hydrophobic", residue: "Ile19", dist: "4.28 Å" },
    ],
    function: "Cell cycle regulator; drives G1→S phase transition; frequently overexpressed in HCC",
    effect: "downregulated", foldChange: 0.47, color: "#ec4899",
  },
]

export { PROTEINS }
