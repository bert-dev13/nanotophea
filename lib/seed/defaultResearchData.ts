/**
 * Justified Research Data seed for new studies.
 * Only identity / REFERENCE fields — no LogP, IC50, ΔG, confidence, or activity claims.
 */
import type { UserProfile } from "@/lib/domain/models"
import * as research from "@/lib/repositories/researchDataRepository"

export async function seedDefaultResearchData(studyId: string, owner: UserProfile): Promise<void> {
  const actor = { id: owner.id }
  const existingFormulations = await research.listFormulations(studyId)
  if (existingFormulations.length > 0) return

  const retrievedAt = new Date().toISOString().slice(0, 10)

  const vinaRef = await research.createReference(studyId, actor, {
    title: "AutoDock Vina: improving the speed and accuracy of docking with a new scoring function, efficient optimization, and multithreading",
    authors: "Trott O, Olson AJ",
    year: "2010",
    journal: "Journal of Computational Chemistry",
    doi: "10.1002/jcc.21334",
    pmid: "19499576",
    url: "https://pubmed.ncbi.nlm.nih.gov/19499576/",
    retrievedAt,
    notes: "Method reference for future docking imports — not a docking result.",
    provenance: {
      evidenceClass: "LITERATURE",
      citation: "PMID:19499576",
      source: "PubMed",
      retrievedAt,
    },
  })

  const quercetin = await research.createCompound(studyId, actor, {
    name: "Quercetin",
    pubchemCid: 5280343,
    smiles: "C1=CC(=C(C=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O)O",
    formula: "C15H10O7",
    molecularWeight: 302.24,
    chemicalClass: "Flavonol",
    plantPart: "Leaves / stems (marker)",
    source: "PubChem CID 5280343",
    isPrimaryMarker: true,
    notes: "Primary marker compound for NanoHepatoTea. Physicochemical ADMET descriptors deferred to ADMET module.",
    referenceIds: [],
    provenance: {
      evidenceClass: "REFERENCE",
      source: "PubChem",
      retrievedAt,
    },
    evidenceClass: "REFERENCE",
  })

  await research.createFormulation(studyId, actor, {
    name: "NanoHepatoTea",
    plantMaterial: "Dried Phyllanthus niruri (Sampasampalukan) leaf",
    scientificName: "Phyllanthus niruri L.",
    leafMassG: 2,
    nanocarrierMassG: 1,
    totalMassG: 3,
    markerCompound: "Quercetin",
    markerCompoundId: quercetin.id,
    methodNotes:
      "Chitosan–TPP nanocarrier prepared by ionic gelation; encapsulating aqueous P. niruri extract. Tea bag: 2 g dried leaf + 1 g nanocarrier powder.",
    storageNotes: "Store finished tea bags in clean, dry, sealed packaging.",
    isCanonical: true,
    referenceIds: [vinaRef.id],
    notes: "Locked composition per STUDY_DESIGN_CONTRACT.md. Not a clinical dosage schedule.",
    provenance: {
      evidenceClass: "REFERENCE",
      source: "STUDY_DESIGN_CONTRACT.md / research protocol",
      recordedAt: new Date().toISOString(),
    },
  })

  await research.createCellLine(studyId, actor, {
    name: "HepG2",
    fullName: "Hepatocellular carcinoma HepG2",
    organism: "Homo sapiens",
    tissueOrigin: "Liver",
    diseaseContext: "Hepatocellular carcinoma",
    lineType: "cancer",
    p53Status: "Wild-type",
    hbvStatus: "HBV+ (integrated)",
    sourceDatabase: "Common HCC research model (identity only)",
    isPrimaryExperimental: true,
    notes: "Primary experimental cell line for LDH (and related wet-lab work) in this study.",
    referenceIds: [],
    provenance: {
      evidenceClass: "REFERENCE",
      source: "STUDY_DESIGN_CONTRACT.md",
      recordedAt: new Date().toISOString(),
    },
  })

  // Optional normal-context identity records (no IC50 / curves)
  for (const cl of [
    {
      name: "L02",
      fullName: "Normal human hepatocyte L02",
      organism: "Homo sapiens",
      tissueOrigin: "Liver",
      diseaseContext: "Normal hepatocyte reference",
      lineType: "normal" as const,
      notes: "Optional REFERENCE context only — not used for experimental LDH in this contract.",
    },
    {
      name: "WRL-68",
      fullName: "WRL-68 hepatocyte reference",
      organism: "Homo sapiens",
      tissueOrigin: "Liver",
      diseaseContext: "Normal hepatocyte reference",
      lineType: "normal" as const,
      notes: "Optional REFERENCE context only.",
    },
  ]) {
    await research.createCellLine(studyId, actor, {
      ...cl,
      isPrimaryExperimental: false,
      referenceIds: [],
      provenance: {
        evidenceClass: "REFERENCE",
        source: "Research protocol context catalog",
        recordedAt: new Date().toISOString(),
      },
    })
  }

  // Key target identities only (PDB/gene/pathway) — no ΔG / Ki / confidence / foldChange
  const proteins = [
    {
      name: "YAP1",
      gene: "YAP1",
      pdbId: "5YLH",
      pathway: "Hippo–YAP",
      role: "oncogene / transcriptional co-activator",
      functionNotes: "TEAD-associated transcriptional co-activator relevant to HCC proliferation.",
    },
    {
      name: "BAX",
      gene: "BAX",
      pdbId: "4S0O",
      pathway: "Intrinsic apoptosis",
      role: "pro-apoptotic",
      functionNotes: "BCL-2 family pore-forming protein.",
    },
    {
      name: "BCL-2",
      gene: "BCL2",
      pdbId: "2YIU",
      pathway: "Intrinsic apoptosis",
      role: "anti-apoptotic",
      functionNotes: "Anti-apoptotic BCL-2 family member.",
    },
    {
      name: "Caspase-3",
      gene: "CASP3",
      pdbId: "2XYG",
      pathway: "Apoptosis execution",
      role: "executioner caspase",
      functionNotes: "Executioner caspase in apoptosis cascade.",
    },
    {
      name: "Nrf2",
      gene: "NFE2L2",
      pdbId: "4IS9",
      pathway: "Oxidative stress / Keap1–Nrf2",
      role: "antioxidant regulator",
      functionNotes: "Master antioxidant transcription factor.",
    },
    {
      name: "LATS1",
      gene: "LATS1",
      pdbId: "5YLH",
      pathway: "Hippo–YAP",
      role: "tumor suppressor kinase",
      functionNotes: "Hippo pathway kinase that phosphorylates YAP.",
    },
  ]

  for (const p of proteins) {
    await research.createProtein(studyId, actor, {
      ...p,
      source: p.pdbId ? `RCSB PDB ${p.pdbId}` : "Research target catalog",
      referenceIds: [vinaRef.id],
      provenance: {
        evidenceClass: "REFERENCE",
        source: p.pdbId ? "RCSB PDB" : "Research protocol",
        retrievedAt,
      },
    })
  }
}
 