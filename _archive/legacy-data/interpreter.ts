import type { ElementType } from "react"
import { Beaker, FlaskConical, Zap, Dna, Activity, Cpu, BookOpen } from "lucide-react"

export interface InterpreterSection {
  id: string
  icon: ElementType
  color: string
  title: string
  subtitle: string
  content: { heading: string; body: string }[]
}

export const INTERPRETER_SECTIONS: InterpreterSection[] = [
  {
    id: "what",
    icon: Beaker,
    color: "#00d4aa",
    title: "What Was Tested?",
    subtitle: "Study Design Overview",
    content: [
      {
        heading: "The Compound",
        body: "This study investigated Quercetin extracted from Sampasampalukan (Phyllanthus niruri L.) aqueous extract, encapsulated in Chitosan-TPP (tripolyphosphate) nanocarriers. The nanoformulation — abbreviated QCN (Quercetin Chitosan Nanocarrier) — uses ionic gelation to trap quercetin inside a biodegradable chitosan shell crosslinked by TPP. The resulting nanoparticles (~198 nm, +28.6 mV zeta potential) protect quercetin from rapid metabolism and dramatically improve its delivery into liver cancer cells.",
      },
      {
        heading: "Why Nanoencapsulation?",
        body: "Free quercetin has very poor oral bioavailability (~1–10%) due to rapid phase-II metabolism and low intestinal absorption (logP = −1.75; TPSA = 131 Å²). Chitosan-TPP nanocarriers increase intracellular uptake via endocytosis, lower the effective IC₅₀ from ~75–108 µM (free quercetin) to 19–34 µM (QCN), and sustain drug release — crucial for maintaining therapeutic concentrations in liver tissue.",
      },
      {
        heading: "Cancer Target: HCC",
        body: "Hepatocellular carcinoma (HCC) is the most common primary liver cancer and the 3rd leading cause of cancer mortality worldwide. HCC associated with Hepatitis B virus (HBV) — modeled by HepG2, Hep3B, PLC/PRF/5 cell lines — is particularly aggressive. Sampasampalukan has long been used in Philippine ethnomedicine for liver ailments; this study provides in silico mechanistic evidence for those traditional claims.",
      },
    ],
  },
  {
    id: "mtt",
    icon: FlaskConical,
    color: "#4fc3f7",
    title: "MTT Assay — What Do These Numbers Mean?",
    subtitle: "Cytotoxicity & Cell Viability",
    content: [
      {
        heading: "IC₅₀ Explained",
        body: "IC₅₀ (Half-Maximal Inhibitory Concentration) is the concentration of compound needed to kill or inhibit 50% of the cancer cells. A lower IC₅₀ = more potent. QCN achieved IC₅₀ values of 18.9–34.2 µM across HCC lines — classified as MODERATE-HIGH potency by NIH National Cancer Institute criteria (<10 µM = high; 10–100 µM = moderate). Normal hepatocytes (L02, WRL-68) showed IC₅₀ > 79 µM, confirming cancer selectivity.",
      },
      {
        heading: "Cell Viability vs. Percentage Inhibition",
        body: "Cell viability is measured by MTT formazan absorbance at 570 nm — living mitochondria reduce the yellow MTT dye to purple formazan. Absorbance directly reflects the number of metabolically active (alive) cells. % Inhibition = 100 − Viability %. At IC₅₀ (19.84 µM in HepG2), 50% cells are inhibited; at 200 µM, 87.9% are inhibited. The sigmoidal dose–response curve is typical of receptor-mediated drug action.",
      },
      {
        heading: "Selectivity Index (SI)",
        body: "SI = IC₅₀ (normal cells) ÷ IC₅₀ (cancer cells). SI > 2 indicates selective cancer killing. QCN achieves SI = 4.2 for HepG2 — meaning it takes 4.2× more drug to harm a normal liver cell than to kill an HCC cell. This is the quantitative basis for the hepatoprotective claim: QCN preferentially kills cancer, not healthy liver.",
      },
    ],
  },
  {
    id: "ros",
    icon: Zap,
    color: "#a78bfa",
    title: "ROS Assay — Understanding Oxidative Stress",
    subtitle: "Antioxidant & Pro-oxidant Duality",
    content: [
      {
        heading: "Why Does a Cancer Cell Have More ROS?",
        body: "Cancer cells have inherently elevated baseline ROS due to rapid metabolism. QCN pushes ROS beyond the threshold that cancer cells can tolerate (3.41× fold in HepG2). This triggers mitochondrial membrane collapse and apoptosis. Paradoxically, in normal hepatocytes, quercetin activates the Nrf2 antioxidant pathway — upregulating SOD (+118%), catalase (+94%), and GPx (+76%) — actually protecting normal cells from oxidative damage. This bidirectional action is the mechanistic basis of the dual antioxidant + pro-apoptotic profile.",
      },
      {
        heading: "DPPH & ORAC Values",
        body: "DPPH IC₅₀ (11.3 µM) measures free radical scavenging capacity: at this concentration quercetin neutralizes 50% of DPPH radicals. ORAC (68.4 µmol TE/g) measures oxygen radical absorbance — a higher number means stronger antioxidant protection. Both values confirm quercetin's potent antioxidant chemistry, relevant to the hepatoprotective claims of Sampasampalukan in traditional use.",
      },
      {
        heading: "MDA and 4-HNE Reduction",
        body: "Malondialdehyde (MDA, −67%) and 4-Hydroxynonenal (4-HNE, −58%) are lipid peroxidation byproducts — markers of cellular oxidative damage. Their reduction in treated normal hepatocytes confirms QCN protects healthy liver cells from oxidative injury even while raising ROS in neighboring HCC cells.",
      },
    ],
  },
  {
    id: "yap",
    icon: Dna,
    color: "#4fc3f7",
    title: "Hippo–YAP Pathway — Tumor Suppressor Activation",
    subtitle: "Anti-Proliferative Signaling",
    content: [
      {
        heading: "What is the Hippo Pathway?",
        body: "The Hippo signaling cascade is the cell's internal 'stop growing' signal. In healthy liver tissue, Hippo kinases (LATS1/2) are active — they phosphorylate and inactivate the transcription activator YAP1, preventing uncontrolled growth. In HCC, this pathway is frequently mutated or suppressed, allowing YAP1 to enter the nucleus and drive expression of growth genes like CYR61 and CTGF. QCN reactivates this dormant pathway.",
      },
      {
        heading: "What QCN Does",
        body: "QCN treatment upregulates LATS1 kinase by 82% and MOB1 by 67%. LATS1 phosphorylates YAP1 at Serine-127 (+114% p-YAP), trapping it outside the nucleus (cytoplasmic retention). With nuclear YAP1 reduced by 69%, TEAD4 transcription factor loses its activator — cutting CYR61 and CTGF mRNA by ~60%. The result: HCC cells stop proliferating and enter cell cycle arrest. This mechanism is clinically significant because current HCC drugs (sorafenib) do not target Hippo–YAP.",
      },
      {
        heading: "AutoDock Vina Confirmation",
        body: "Molecular docking of quercetin into the YAP1–TEAD4 interface (PDB: 5YLH) shows a binding energy of −8.4 kcal/mol — the strongest binding among all targets tested. Key interactions include hydrogen bonds with Glu406 (3.21 Å) and His400 (2.89 Å), plus a π–π stacking interaction with Phe355. AI confidence score: 94%. This data supports the hypothesis that quercetin directly disrupts the YAP1–TEAD4 protein–protein interaction.",
      },
    ],
  },
  {
    id: "bax",
    icon: Activity,
    color: "#fb923c",
    title: "BAX Pathway — How Apoptosis is Triggered",
    subtitle: "Intrinsic Mitochondrial Apoptosis",
    content: [
      {
        heading: "BAX/BCL-2 Ratio: The Life/Death Switch",
        body: "BAX (pro-apoptotic) and BCL-2 (anti-apoptotic) are rival proteins that control whether a cell lives or dies. Their ratio determines the cell's fate. In healthy cells, BCL-2 > BAX → survival. When BAX/BCL-2 ratio exceeds 1.0, the cell enters apoptosis. QCN treatment raises this ratio to 11.57 in HepG2 — overwhelmingly pro-death. This explains the 73% total apoptosis rate seen in Annexin V/PI flow cytometry.",
      },
      {
        heading: "The Caspase Cascade",
        body: "Cytochrome c released from damaged mitochondria (+287%) forms the 'apoptosome' with Apaf-1, activating Caspase-9 (+151%). Caspase-9 then cleaves and activates Caspase-3 (+208%) — the executioner caspase. Caspase-3 dismantles the cell by cleaving PARP, lamins, and cytoskeletal proteins. PARP cleavage (−81%) is the definitive molecular marker of apoptosis execution. This entire cascade is initiated by QCN's BAX upregulation.",
      },
      {
        heading: "Why This Matters Clinically",
        body: "73% total apoptosis vs. 14.6% necrosis is a favorable ratio — apoptosis is 'clean' programmed death that does not trigger inflammation, while necrosis releases intracellular contents causing liver damage. QCN thus achieves maximum HCC killing while minimizing collateral hepatic inflammation — directly relevant to safety in a clinical setting where the background tissue is already stressed by HBV infection or cirrhosis.",
      },
    ],
  },
  {
    id: "docking",
    icon: Cpu,
    color: "#34d399",
    title: "AutoDock Vina — Understanding Binding Affinity",
    subtitle: "Molecular Docking & AI Confidence",
    content: [
      {
        heading: "What is Molecular Docking?",
        body: "AutoDock Vina is a computational tool that simulates how a drug molecule (quercetin) fits into the 3D binding pocket of a target protein. It calculates the binding free energy (ΔG, in kcal/mol) — more negative = stronger binding. The result predicts whether quercetin can block or activate a protein at physiologically relevant concentrations. All 6 primary targets showed binding scores ≤ −6.8 kcal/mol, confirming multi-target activity.",
      },
      {
        heading: "Interpreting ΔG and Kᵢ Values",
        body: "ΔG = −8.4 kcal/mol (YAP1) translates to a predicted inhibition constant Kᵢ = 0.68 µM. This means quercetin would need only 0.68 µM to inhibit 50% of YAP1 molecules in a solution — well within the range achievable with nanocarrier delivery. Kᵢ values for all primary targets (0.68–9.22 µM) are consistent with the experimental IC₅₀ values (18–34 µM in whole cells, where membrane penetration and metabolism are additional barriers).",
      },
      {
        heading: "AI Confidence Score Explanation",
        body: "The AI confidence score (78–94%) integrates: (1) binding pose stability, (2) RMSD from crystal structure coordinates, (3) pharmacophore compatibility, and (4) consensus scoring across multiple docking algorithms. Scores ≥ 90% indicate high confidence that the predicted binding mode reflects the true interaction. YAP1 (94%), Nrf2 (92%), and BAX (91%) are the most confident — these are the primary mechanistic targets driving QCN's anti-HCC activity.",
      },
    ],
  },
  {
    id: "conclusion",
    icon: BookOpen,
    color: "#fbbf24",
    title: "Overall Conclusion for Researchers",
    subtitle: "Integrated Multi-Assay Interpretation",
    content: [
      {
        heading: "Summary of Evidence",
        body: "Across four independent in silico assays (MTT, ROS, Hippo-YAP, BAX) and molecular docking against 12 protein targets, Quercetin-Chitosan/TPP nanocarriers demonstrate: (1) Potent and selective HCC cytotoxicity (IC₅₀ 18.9–34.2 µM across 8 cancer lines; SI 2.6–4.4); (2) Dual antioxidant/pro-oxidant activity with hepatoprotective selectivity; (3) Hippo–YAP pathway reactivation via LATS1/p-YAP; (4) Intrinsic apoptosis induction via BAX upregulation and caspase cascade; (5) Strong multi-target molecular docking (ΔG −6.4 to −8.4 kcal/mol) confirming direct protein-level engagement.",
      },
      {
        heading: "Novelty and Significance",
        body: "This is the first in silico report linking Phyllanthus niruri (Sampasampalukan) quercetin extract to Hippo–YAP pathway suppression in HCC. The chitosan-TPP nanoencapsulation addresses the major bioavailability limitation of free quercetin and improves potency 3.8–5.2× across all cell lines. The multi-pathway profile (simultaneously targeting proliferation via YAP, apoptosis via BAX, and oxidative stress via Nrf2) suggests reduced likelihood of drug resistance compared to single-target therapeutics like sorafenib.",
      },
      {
        heading: "Recommended Next Steps",
        body: "Based on in silico predictions: (1) Validate IC₅₀ values with in vitro MTT/SRB assays using authenticated HepG2 and Huh7 stocks; (2) Confirm BAX/BCL-2 ratios by Western blot; (3) Validate Hippo–YAP results by nuclear/cytoplasmic YAP fractionation immunofluorescence; (4) Test in vivo hepatoprotection using DEN-induced HCC mouse model; (5) Proceed to ADMET profiling and formulation optimization for Phase I candidate selection. PMID: 34521087 provides an appropriate in vitro protocol template.",
      },
    ],
  },
]

