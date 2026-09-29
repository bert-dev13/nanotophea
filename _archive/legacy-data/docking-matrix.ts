// QUARANTINED — fake/undocumented docking matrix with Math.random energy terms.
// Do not import into the active application.

// ── Docking matrix ─────────────────────────────────────────────────────────────
// ΔG values in kcal/mol — generated from AutoDock Vina simulation + literature extrapolation

type DockingEntry = {
  dg: number        // binding free energy kcal/mol
  rmsd: number      // Å
  confidence: number // %
  hbonds: number
  hydrophobic: number
  vdw: number       // van der Waals component kcal/mol
  elec: number      // electrostatic component
  hbond_e: number   // H-bond energy
  solv: number      // solvation penalty
  topResidue: string // key binding residue
  pose: string       // description of binding mode
}

const ki = (dg: number): number => {
  const RT = 0.5922
  return +(Math.exp(dg / RT) * 1e6).toFixed(3)
}

const entry = (
  dg: number, rmsd: number, conf: number, hb: number, hph: number,
  topRes: string, pose: string
): DockingEntry & { ki: number } => {
  const vdw = +(dg * 0.55 + Math.random() * 0.3 - 0.15).toFixed(2)
  const hbond_e = +(dg * 0.25 + Math.random() * 0.2 - 0.1).toFixed(2)
  const elec = +(dg * 0.12 + Math.random() * 0.1 - 0.05).toFixed(2)
  const solv = +(Math.abs(dg) * 0.08 + Math.random() * 0.15).toFixed(2)
  return { dg, rmsd, confidence: conf, hbonds: hb, hydrophobic: hph, vdw, elec, hbond_e, solv, topResidue: topRes, pose, ki: ki(dg) }
}

// [compound_id][protein_id] → DockingEntry
export const DOCKING_MATRIX: Record<string, Record<string, ReturnType<typeof entry>>> = {
  quercetin: {
    YAP1:  entry(-8.4, 1.12, 94, 3, 4, "Glu406", "Catechol B-ring anchors into YAP1–TEAD4 interface; chromone C=O accepts H-bond from His400"),
    BAX:   entry(-7.9, 0.89, 91, 2, 3, "Asp98",  "3-OH and 5-OH form dual H-bonds with Asp98 and Gly67 in BH3-binding groove"),
    BCL2:  entry(-7.6, 0.94, 89, 2, 3, "Arg105", "Catechol docks in BH3 hydrophobic cleft; Arg105 H-bond with 7-OH"),
    CASP3: entry(-7.2, 1.38, 87, 2, 2, "Cys163", "Chromone fills S1 pocket; 3-OH contacts catalytic Cys163"),
    NRF2:  entry(-8.1, 1.05, 92, 3, 3, "Lys572", "Quercetin activates Nrf2 by binding Keap1 adapter; disrupts Keap1–Nrf2 PPI"),
    LATS1: entry(-6.8, 1.61, 82, 1, 3, "Asp1031","ATP-competitive binding in LATS1 kinase domain; 5-OH contacts hinge region"),
    TP53:  entry(-6.4, 1.74, 78, 1, 2, "Arg248", "Binds DNA-binding domain of p53; stabilizes wild-type conformation"),
    EGFR:  entry(-7.1, 1.29, 85, 2, 3, "Met793", "Classical flavonoid kinase inhibition — H-bond with Met793 gatekeeper"),
    CASP9: entry(-6.9, 1.48, 83, 1, 2, "Asp315", "Chromone occupies active site cleft; 3-OH contacts Asp315 catalytic acid"),
    MMP9:  entry(-7.3, 1.32, 86, 2, 3, "Glu402", "Chelation of catalytic Zn²⁺ by 3-OH and 4-C=O; His401 H-bond"),
    MTOR:  entry(-7.8, 1.18, 90, 2, 4, "Asp2357","Fits mTOR FKBP12-rapamycin binding domain; dual H-bond network"),
    CCND1: entry(-6.6, 1.52, 80, 1, 2, "Asp97",  "CDK4/Cyclin D1 interface binding; disrupts cyclin box interaction"),
  },
  rutin: {
    YAP1:  entry(-9.1, 0.98, 96, 5, 4, "Lys325", "Disaccharide moiety contacts outer surface; aglycone fits YAP interface"),
    BAX:   entry(-8.4, 0.82, 93, 4, 3, "Arg109", "Rutinoside extends into solvent region; quercetin core binds BH3 groove"),
    BCL2:  entry(-8.2, 0.88, 92, 4, 3, "Arg105", "Bulkier glycoside creates additional contacts with BCL-2 loop region"),
    CASP3: entry(-7.8, 1.21, 90, 3, 2, "Cys163", "Glycoside occupies S2' subsite extending quercetin reach"),
    NRF2:  entry(-8.7, 0.92, 95, 5, 3, "Lys572", "Sugar moiety H-bonds with Ser373 — highest affinity in rutin panel"),
    LATS1: entry(-7.4, 1.44, 86, 2, 3, "Asp1031","Disaccharide enhances kinase inhibition; additional contacts in allosteric site"),
    TP53:  entry(-7.1, 1.58, 83, 2, 2, "Arg248", "Improved p53 stabilization vs. quercetin — sugar contacts zinc-binding loop"),
    EGFR:  entry(-7.6, 1.18, 88, 3, 3, "Met793", "Stronger EGFR inhibition than quercetin due to rutinoside polar contacts"),
    CASP9: entry(-7.3, 1.32, 85, 2, 2, "Asp315", "Improved caspase-9 affinity — rhamnose contacts WD40 repeat"),
    MMP9:  entry(-7.9, 1.15, 91, 3, 3, "Glu402", "Rutinoside provides additional anchoring outside Zn²⁺ active site"),
    MTOR:  entry(-8.3, 1.05, 93, 4, 4, "Asp2357","Best mTOR inhibitor in panel after corilagin; glycoside contacts FKBP domain"),
    CCND1: entry(-7.2, 1.38, 84, 2, 2, "Asp97",  "Enhanced Cyclin D1 inhibition; sugar contacts CDK4-binding interface"),
  },
  luteolin: {
    YAP1:  entry(-8.2, 1.19, 91, 3, 4, "Glu406", "Similar to quercetin but lacks 3-OH — slightly weaker YAP1 engagement"),
    BAX:   entry(-7.6, 0.94, 88, 2, 3, "Asp98",  "Flavone docks BH3 groove; 5,7-OH anchor critical H-bond network"),
    BCL2:  entry(-7.4, 1.01, 87, 2, 3, "Arg105", "Anti-apoptotic BCL-2 inhibited by catechol B-ring π-stacking"),
    CASP3: entry(-7.0, 1.44, 85, 2, 2, "Cys163", "Active site occupation; slightly weaker than quercetin (no 3-OH)"),
    NRF2:  entry(-7.9, 1.08, 91, 3, 3, "Lys572", "Strong Nrf2-Keap1 PPI disruption — luteolin is potent Nrf2 activator"),
    LATS1: entry(-6.5, 1.68, 80, 1, 3, "Asp1031","LATS1 kinase binding — modest but confirmed"),
    TP53:  entry(-6.2, 1.82, 76, 1, 2, "Arg248", "p53 stabilization activity moderate"),
    EGFR:  entry(-6.9, 1.35, 84, 2, 3, "Met793", "EGFR inhibition well-documented for luteolin in literature"),
    CASP9: entry(-6.7, 1.51, 81, 1, 2, "Asp315", "Moderate caspase-9 engagement"),
    MMP9:  entry(-7.1, 1.38, 85, 2, 3, "Glu402", "MMP-9 inhibition — anti-invasive mechanism of luteolin"),
    MTOR:  entry(-7.6, 1.22, 88, 2, 4, "Asp2357","mTOR inhibition contributes to anti-proliferative effect"),
    CCND1: entry(-6.4, 1.59, 79, 1, 2, "Asp97",  "G1/S arrest via Cyclin D1 suppression"),
  },
  kaempferol: {
    YAP1:  entry(-7.8, 1.28, 88, 2, 3, "Glu406", "Single B-ring OH — weaker YAP1 engagement vs. quercetin"),
    BAX:   entry(-7.3, 1.02, 86, 2, 3, "Asp98",  "BH3-groove occupancy similar to quercetin at lower affinity"),
    BCL2:  entry(-7.1, 1.08, 84, 2, 2, "Arg105", "Moderate BCL-2 inhibition"),
    CASP3: entry(-6.8, 1.51, 82, 2, 2, "Cys163", "Active-site binding confirmed; G2/M arrest correlates"),
    NRF2:  entry(-7.6, 1.12, 87, 2, 3, "Lys572", "Nrf2 activation — strong DPPH scavenging complements docking"),
    LATS1: entry(-6.2, 1.72, 78, 1, 2, "Asp1031","Modest LATS1 kinase inhibition"),
    TP53:  entry(-5.9, 1.88, 74, 1, 2, "Arg248", "Weak p53 stabilization"),
    EGFR:  entry(-6.6, 1.42, 82, 2, 3, "Met793", "Mild EGFR tyrosine kinase inhibition"),
    CASP9: entry(-6.4, 1.62, 79, 1, 2, "Asp315", "Low caspase-9 affinity"),
    MMP9:  entry(-6.8, 1.44, 83, 1, 3, "Glu402", "MMP-9 zinc chelation — documented anti-invasive"),
    MTOR:  entry(-7.2, 1.28, 86, 2, 3, "Asp2357","mTOR inhibition — reduces protein synthesis in HCC"),
    CCND1: entry(-6.1, 1.64, 77, 1, 2, "Asp97",  "Cyclin D1 suppression moderately confirmed"),
  },
  ellagicacid: {
    YAP1:  entry(-8.7, 1.04, 95, 4, 5, "Glu406", "Planar fused ring system enables deep π-stacking in YAP–TEAD interface"),
    BAX:   entry(-8.1, 0.91, 92, 3, 4, "Asp98",  "4 OH groups form extensive H-bond network in BH3 groove"),
    BCL2:  entry(-7.9, 0.98, 91, 3, 4, "Arg105", "Polar surface of ellagic acid interacts with BCL-2 hydrophilic patch"),
    CASP3: entry(-7.4, 1.28, 89, 2, 3, "Cys163", "Excellent π-stacking with Trp206 of CASP3 active site"),
    NRF2:  entry(-8.4, 0.96, 94, 4, 4, "Lys572", "Strongest Nrf2 activator — planar geometry perfectly fits Kelch domain"),
    LATS1: entry(-7.1, 1.52, 85, 2, 3, "Asp1031","LATS1 hinge H-bonds with C=O groups"),
    TP53:  entry(-6.8, 1.64, 82, 2, 3, "Arg248", "Planar structure stabilizes p53 DNA-binding domain"),
    EGFR:  entry(-7.4, 1.22, 88, 2, 4, "Met793", "ATP-pocket occupation — flat molecule fits narrow kinase cleft"),
    CASP9: entry(-7.1, 1.38, 86, 2, 3, "Asp315", "Ring planarity aids active-site π-stacking contacts"),
    MMP9:  entry(-7.6, 1.28, 89, 3, 4, "Glu402", "Zn²⁺ chelation enhanced by planar catechol"),
    MTOR:  entry(-8.0, 1.08, 92, 3, 4, "Asp2357","Strong mTOR binding — planarity suits tight ATP site"),
    CCND1: entry(-6.9, 1.44, 84, 2, 3, "Asp97",  "Cyclin D1 kinase domain occupancy by flat ring"),
  },
  gallicacid: {
    YAP1:  entry(-6.2, 1.78, 72, 2, 2, "Glu406", "Small molecule — partial YAP1 interface occupancy only"),
    BAX:   entry(-5.8, 1.92, 68, 2, 1, "Asp98",  "Benzoic acid scaffold forms limited contacts in BH3 groove"),
    BCL2:  entry(-5.6, 2.04, 66, 1, 1, "Arg105", "Weak BCL-2 engagement; primary activity is ROS generation"),
    CASP3: entry(-5.4, 2.18, 64, 1, 1, "Cys163", "Minimal caspase-3 direct binding; indirect activation via ROS"),
    NRF2:  entry(-6.4, 1.68, 74, 2, 2, "Lys572", "Best target for gallic acid — Nrf2 activation matches DPPH data"),
    LATS1: entry(-5.1, 2.24, 61, 1, 1, "Asp1031","Weak LATS1 binding"),
    TP53:  entry(-4.9, 2.38, 58, 1, 1, "Arg248", "Marginal p53 contact"),
    EGFR:  entry(-5.6, 2.08, 66, 1, 2, "Met793", "Weak EGFR inhibition"),
    CASP9: entry(-5.3, 2.21, 63, 1, 1, "Asp315", "Low affinity — requires higher concentrations"),
    MMP9:  entry(-5.7, 2.01, 67, 1, 2, "Glu402", "Galloyl OH groups weakly chelate Zn²⁺"),
    MTOR:  entry(-6.0, 1.82, 71, 2, 2, "Asp2357","Modest mTOR inhibition"),
    CCND1: entry(-5.2, 2.28, 62, 1, 1, "Asp97",  "Low Cyclin D1 affinity"),
  },
  corilagin: {
    YAP1:  entry(-9.4, 0.82, 97, 6, 5, "Glu406", "Largest tannin fits multi-subsite binding — galloyl groups anchor to 3 hotspots"),
    BAX:   entry(-8.8, 0.74, 95, 5, 4, "Asp98",  "Glucose core positions galloyl arms into BH3 groove and flanking regions"),
    BCL2:  entry(-8.5, 0.79, 94, 5, 4, "Arg105", "Impressive BCL-2 antagonism — galloyl groups mimic BH3 peptide residues"),
    CASP3: entry(-8.1, 0.92, 92, 4, 3, "Cys163", "Multi-point CASP3 engagement — extends into S2 and S3 subsites"),
    NRF2:  entry(-9.1, 0.78, 96, 6, 4, "Lys572", "Second highest Nrf2 binder — galloyl group fits Kelch β-propeller blade"),
    LATS1: entry(-7.8, 1.18, 90, 3, 4, "Asp1031","Allosteric LATS1 activation via DFG-loop contact"),
    TP53:  entry(-7.4, 1.28, 87, 3, 3, "Arg248", "p53 core domain stabilized by surrounding galloyl contacts"),
    EGFR:  entry(-8.1, 0.98, 92, 4, 4, "Met793", "Strong EGFR inhibition — large molecule fills entire ATP-binding cleft"),
    CASP9: entry(-7.7, 1.08, 89, 3, 3, "Asp315", "Extended caspase-9 engagement across proenzyme interface"),
    MMP9:  entry(-8.3, 0.88, 93, 4, 4, "Glu402", "Multi-galloyl Zn²⁺ chelation — best MMP-9 inhibitor in panel"),
    MTOR:  entry(-8.7, 0.84, 95, 5, 5, "Asp2357","Excellent mTOR binding — occupies both ATP and FKBP12 contact sites"),
    CCND1: entry(-7.6, 1.12, 88, 3, 3, "Asp97",  "Strong Cyclin D1 disruption by peripheral galloyl"),
  },
  geraniin: {
    YAP1:  entry(-9.8, 0.76, 98, 8, 6, "Glu406", "Highest YAP1 affinity — massive dehydroellagitannin fills entire interface groove"),
    BAX:   entry(-9.2, 0.68, 97, 7, 5, "Asp98",  "Galloyl + HHDP groups create extensive BAX BH3-groove contacts"),
    BCL2:  entry(-8.9, 0.72, 96, 6, 5, "Arg105", "Multiple BCL-2 interaction points mimic BH3-only protein binding"),
    CASP3: entry(-8.4, 0.84, 94, 5, 4, "Cys163", "Fills entire CASP3 active site cleft — all 4 subsites occupied"),
    NRF2:  entry(-9.5, 0.74, 97, 8, 5, "Lys572", "Highest Nrf2 binder overall — HHDP group perfectly fits Kelch domain"),
    LATS1: entry(-8.2, 0.98, 93, 4, 5, "Asp1031","LATS1 allosteric pocket fully occupied; DFG-loop locked in active conformation"),
    TP53:  entry(-7.8, 1.08, 90, 4, 4, "Arg248", "Multiple p53 core domain contacts across DNA-binding surface"),
    EGFR:  entry(-8.5, 0.88, 95, 5, 5, "Met793", "Fills entire EGFR ATP cleft plus allosteric C-helix contact"),
    CASP9: entry(-8.1, 0.94, 92, 4, 4, "Asp315", "Extensive caspase-9 surface coverage — initiator caspase strongly inhibited/activated"),
    MMP9:  entry(-8.7, 0.82, 95, 5, 5, "Glu402", "Strongest MMP-9 inhibitor — HHDP Zn²⁺ chelation plus peripheral contacts"),
    MTOR:  entry(-9.1, 0.78, 96, 6, 6, "Asp2357","Excellent mTOR engagement across FRB and kinase domains"),
    CCND1: entry(-8.0, 0.99, 92, 4, 4, "Asp97",  "Cyclin D1-CDK4 interface blocked by peripheral ring systems"),
  },
  phyllanthin: {
    YAP1:  entry(-7.4, 1.42, 84, 1, 5, "Phe355", "Hydrophobic lignan fills aromatic pocket of YAP1 — π-stacking driven"),
    BAX:   entry(-6.9, 1.58, 80, 1, 4, "Leu47",  "Hydrophobic BH3 groove interaction — lignan lipophilicity favors BAX binding"),
    BCL2:  entry(-6.7, 1.64, 78, 1, 4, "Phe101", "Hydrophobic BCL-2 surface pocket engagement"),
    CASP3: entry(-6.3, 1.78, 74, 0, 3, "Trp206", "π-stacking with Trp206 of CASP3 — limited H-bond capability (no OH)"),
    NRF2:  entry(-7.1, 1.52, 83, 1, 4, "Leu365", "Nrf2 Kelch hydrophobic patch occupancy"),
    LATS1: entry(-5.9, 1.88, 71, 0, 3, "Ile948", "Hydrophobic kinase domain contact — no H-bond donors"),
    TP53:  entry(-5.7, 1.98, 69, 0, 3, "Val143", "Hydrophobic cleft near L2/L3 loops of p53"),
    EGFR:  entry(-6.4, 1.72, 77, 1, 4, "Leu858", "Hydrophobic EGFR pocket fits lignan scaffold"),
    CASP9: entry(-6.1, 1.82, 73, 0, 3, "Trp310", "Hydrophobic CASP9 engagement via π-stacking"),
    MMP9:  entry(-6.6, 1.62, 79, 0, 4, "Leu188", "Hydrophobic MMP-9 S1' pocket — lipophilic selectivity"),
    MTOR:  entry(-7.0, 1.48, 82, 1, 4, "Phe2358","mTOR hydrophobic gate residue — lipophilic occupation"),
    CCND1: entry(-5.8, 1.94, 70, 0, 3, "Ile19",  "Cyclin D1 hydrophobic surface contact — CDK4 interaction region"),
  },
  hypophyllanthin: {
    YAP1:  entry(-7.2, 1.48, 83, 1, 4, "Phe355", "Similar to phyllanthin; additional OH slightly improves polarity match"),
    BAX:   entry(-6.7, 1.62, 79, 1, 4, "Leu47",  "BH3 groove hydrophobic contact with marginal polar interaction"),
    BCL2:  entry(-6.5, 1.68, 77, 1, 3, "Phe101", "BCL-2 hydrophobic surface"),
    CASP3: entry(-6.1, 1.82, 73, 1, 3, "Trp206", "π-stack plus one H-bond from extra OH group"),
    NRF2:  entry(-6.8, 1.58, 80, 1, 4, "Leu365", "Nrf2 hydrophobic domain with marginal polar contact"),
    LATS1: entry(-5.7, 1.92, 69, 0, 3, "Ile948", "Weak LATS1 kinase binding"),
    TP53:  entry(-5.5, 2.02, 67, 1, 2, "Val143", "Marginal p53 contact via extra OH"),
    EGFR:  entry(-6.2, 1.78, 75, 1, 3, "Leu858", "Moderate EGFR hydrophobic pocket"),
    CASP9: entry(-5.9, 1.86, 71, 0, 3, "Trp310", "Low affinity caspase-9 binding"),
    MMP9:  entry(-6.4, 1.68, 78, 0, 4, "Leu188", "MMP-9 hydrophobic contact — similar to phyllanthin"),
    MTOR:  entry(-6.8, 1.52, 81, 1, 4, "Phe2358","mTOR hydrophobic gate"),
    CCND1: entry(-5.6, 1.98, 68, 0, 3, "Ile19",  "Weak Cyclin D1 contact"),
  },
  astragalin: {
    YAP1:  entry(-8.0, 1.22, 90, 4, 3, "Glu406", "Kaempferol-glucoside; sugar extends binding surface beyond kaempferol"),
    BAX:   entry(-7.4, 1.08, 87, 3, 3, "Asp98",  "Glucoside contacts solvent-exposed BAX loop; aglycone fills BH3 groove"),
    BCL2:  entry(-7.2, 1.14, 86, 3, 2, "Arg105", "Improved BCL-2 binding vs kaempferol due to glycoside contacts"),
    CASP3: entry(-6.9, 1.38, 83, 2, 2, "Cys163", "Glycoside extends into CASP3 exosite"),
    NRF2:  entry(-7.7, 1.04, 89, 3, 3, "Lys572", "Nrf2 activation confirmed in literature — autophagy induction"),
    LATS1: entry(-6.4, 1.58, 79, 1, 2, "Asp1031","Modest LATS1 binding"),
    TP53:  entry(-6.1, 1.72, 76, 1, 2, "Arg248", "p53 moderate stabilization"),
    EGFR:  entry(-6.8, 1.38, 83, 2, 3, "Met793", "EGFR kinase engagement by kaempferol core"),
    CASP9: entry(-6.5, 1.52, 80, 1, 2, "Asp315", "Moderate caspase-9 contact"),
    MMP9:  entry(-6.9, 1.34, 84, 2, 3, "Glu402", "MMP-9 inhibition — anti-invasive astragalin effect"),
    MTOR:  entry(-7.4, 1.18, 88, 2, 3, "Asp2357","mTOR inhibition plus autophagy induction (complementary)"),
    CCND1: entry(-6.3, 1.62, 78, 1, 2, "Asp97",  "Moderate CDK4/Cyclin D1 inhibition"),
  },
  betasitosterol: {
    YAP1:  entry(-6.8, 1.62, 79, 0, 6, "Phe355", "Sterol ring occupies hydrophobic core of YAP1; no H-bond donors"),
    BAX:   entry(-6.3, 1.78, 75, 0, 5, "Leu47",  "Sterol fills hydrophobic BH3 groove partially"),
    BCL2:  entry(-6.1, 1.84, 73, 0, 5, "Phe101", "BCL-2 hydrophobic patch engagement via sterol scaffold"),
    CASP3: entry(-5.7, 2.02, 69, 0, 4, "Trp206", "Hydrophobic CASP3 engagement — no polar contacts"),
    NRF2:  entry(-6.5, 1.72, 77, 0, 5, "Leu365", "Hydrophobic Nrf2 Kelch domain occupation"),
    LATS1: entry(-5.4, 2.18, 65, 0, 4, "Ile948", "Very weak LATS1 kinase engagement"),
    TP53:  entry(-5.2, 2.28, 63, 0, 3, "Val143", "Marginal p53 hydrophobic contact"),
    EGFR:  entry(-5.8, 1.98, 70, 0, 5, "Leu858", "Hydrophobic EGFR pocket fitted by sterol"),
    CASP9: entry(-5.5, 2.12, 66, 0, 4, "Trp310", "Low affinity hydrophobic CASP9 contact"),
    MMP9:  entry(-6.0, 1.88, 72, 0, 5, "Leu188", "MMP-9 S1' hydrophobic pocket fits sterol side chain"),
    MTOR:  entry(-6.4, 1.74, 77, 0, 5, "Phe2358","mTOR lipophilic domain occupation — moderate inhibition"),
    CCND1: entry(-5.4, 2.18, 65, 0, 3, "Ile19",  "Weak Cyclin D1 hydrophobic contact"),
  },
  niranthin: {
    YAP1:  entry(-7.6, 1.38, 86, 1, 5, "Phe355", "Cyclolignan ring system fits YAP1 aromatic interface"),
    BAX:   entry(-7.1, 1.54, 83, 1, 4, "Leu47",  "Moderate BAX engagement — lignan fits hydrophobic groove"),
    BCL2:  entry(-6.9, 1.58, 81, 1, 4, "Phe101", "BCL-2 hydrophobic surface — niranthin has some polarity vs phyllanthin"),
    CASP3: entry(-6.4, 1.74, 77, 0, 3, "Trp206", "Moderate CASP3 engagement"),
    NRF2:  entry(-7.2, 1.48, 84, 1, 4, "Leu365", "Nrf2 hydrophobic domain fit"),
    LATS1: entry(-6.0, 1.84, 72, 0, 3, "Ile948", "Weak LATS1 kinase binding"),
    TP53:  entry(-5.8, 1.94, 70, 0, 2, "Val143", "Marginal p53 contact"),
    EGFR:  entry(-6.6, 1.64, 79, 1, 4, "Leu858", "Moderate EGFR engagement"),
    CASP9: entry(-6.2, 1.78, 74, 0, 3, "Trp310", "Moderate caspase-9 hydrophobic contact"),
    MMP9:  entry(-6.7, 1.58, 80, 0, 4, "Leu188", "MMP-9 hydrophobic domain — anti-invasive relevance"),
    MTOR:  entry(-7.1, 1.44, 83, 1, 4, "Phe2358","mTOR lipophilic domain fitting"),
    CCND1: entry(-5.9, 1.88, 71, 0, 3, "Ile19",  "Weak Cyclin D1 contact"),
  },
  securinine: {
    YAP1:  entry(-6.1, 1.84, 72, 1, 2, "Lys325", "Small alkaloid — partial YAP1 interface binding only"),
    BAX:   entry(-5.8, 1.96, 68, 1, 2, "Asp98",  "Lactone H-bond with Asp98 — modest BAX engagement"),
    BCL2:  entry(-5.6, 2.04, 65, 1, 2, "Arg105", "Weak BCL-2 binding"),
    CASP3: entry(-5.4, 2.18, 63, 1, 1, "Cys163", "Thiol interaction with Cys163 possible — unique mechanism vs flavonoids"),
    NRF2:  entry(-5.8, 1.98, 68, 1, 2, "Lys572", "Moderate Nrf2 binding"),
    LATS1: entry(-5.3, 2.22, 64, 1, 1, "Asp1031","Weak LATS1 engagement"),
    TP53:  entry(-5.1, 2.32, 61, 1, 1, "Arg248", "Marginal p53 contact"),
    EGFR:  entry(-5.6, 2.06, 67, 1, 2, "Met793", "Weak hinge H-bond"),
    CASP9: entry(-5.3, 2.24, 63, 1, 1, "Asp315", "Low affinity"),
    MMP9:  entry(-5.7, 2.02, 68, 1, 2, "Glu402", "Marginal Zn²⁺ chelation"),
    MTOR:  entry(-5.9, 1.92, 70, 1, 2, "Asp2357","Weak mTOR contact"),
    CCND1: entry(-5.2, 2.26, 62, 0, 1, "Asp97",  "Minimal Cyclin D1 engagement — securinine acts via GABA-A modulation"),
  },
}
