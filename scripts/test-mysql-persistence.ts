import type { RowDataPacket } from "mysql2"
import { execute, query, queryOne } from "../lib/db/mysql"

interface CountRow extends RowDataPacket {
  count: number
}
import {
  createStudy,
  getStudy,
  updateStudy,
  listStudiesForUser,
  deleteStudy,
} from "../lib/repositories/studyRepository"
import {
  createCompound,
  listCompounds,
  createProtein,
  listProteins,
  createCellLine,
  listCellLines,
} from "../lib/repositories/researchDataRepository"
import {
  createDockingRun,
  listDockingPairs,
  listDockingRuns,
  listAllDockingRuns,
  savePrototypeAdmeRun,
  listAdmetRuns,
  createPredictionRun,
  listPredictionRuns,
} from "../lib/repositories/scientificRunRepository"
import {
  createLabDataset,
  listLabDatasets,
  saveLabReplicate,
  listLabReplicates,
} from "../lib/repositories/labRepository"
import {
  createInterpretation,
  listInterpretations,
} from "../lib/repositories/interpretationRepository"
import { loadStudyAISlice } from "../lib/ai/context"
import { defaultProvenance } from "../lib/domain/provenance"

async function runTests() {
  console.log("=== STARTING NANOTOPHEA MYSQL PERSISTENCE VERIFICATION ===")

  const testUser = {
    id: "test_user_mysql_mig",
    email: "test_mysql@nanotophea.test",
    displayName: "Test Researcher",
    defaultRole: "OWNER" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Ensure clean slate
  await execute(`DELETE FROM studies WHERE owner_id = ?`, [testUser.id])
  await execute(`DELETE FROM users WHERE id = ?`, [testUser.id])

  // Ensure test user in DB
  await execute(
    `INSERT INTO users (id, email, display_name, photo_url, default_role, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
    [testUser.id, testUser.email, testUser.displayName, testUser.defaultRole, testUser.createdAt, testUser.updatedAt]
  )
  console.log("✔ User record created/verified in users table")

  // 1. Studies
  const study = await createStudy(testUser, {
    title: "Test Antineoplastic Study MySQL",
    shortTitle: "MySQL Study",
    description: "Testing end-to-end MySQL persistence and unique constraints",
    fairYear: "2026",
    researcherNames: ["Researcher 1"],
    adviserNames: ["Adviser 1"],
  })
  console.log(`✔ Study created: ${study.id}`)

  const fetchedStudy = await getStudy(study.id)
  if (!fetchedStudy || fetchedStudy.title !== "Test Antineoplastic Study MySQL") {
    throw new Error("Failed to fetch created study from MySQL")
  }
  console.log("✔ Study fetched and verified")

  const updatedStudy = await updateStudy(study.id, testUser.id, {
    primaryCellLine: "HepG2",
    status: "active",
  })
  if (updatedStudy.primaryCellLine !== "HepG2") {
    throw new Error("Failed to update study in MySQL")
  }
  console.log("✔ Study updated in MySQL")

  // 2. Research Setup: Phytochemicals, Target Proteins, Cell Lines
  const compound = await createCompound(study.id, testUser, {
    name: "Quercetin",
    pubchemCid: 5280343,
    smiles: "C1=CC(=C(C=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O)O",
    formula: "C15H10O7",
    molecularWeight: 302.24,
    chemicalClass: "Flavonoid",
    provenance: defaultProvenance("REFERENCE", {
      operatorId: testUser.id,
      source: "PubChem",
    }),
  })
  console.log(`✔ Phytochemical created: ${compound.id} (${compound.name})`)

  const protein = await createProtein(study.id, testUser, {
    name: "BAX",
    proteinName: "Apoptosis regulator BAX",
    pdbId: "1F16",
    geneSymbol: "BAX",
    provenance: defaultProvenance("REFERENCE", {
      operatorId: testUser.id,
      source: "RCSB PDB",
    }),
  })
  console.log(`✔ Target protein created: ${protein.id} (${protein.name})`)

  const cellLine = await createCellLine(study.id, testUser, {
    name: "HepG2",
    organism: "Homo sapiens",
    diseaseContext: "Hepatocellular carcinoma",
    lineType: "cancer",
    isPrimaryExperimental: true,
    provenance: defaultProvenance("REFERENCE", {
      operatorId: testUser.id,
      source: "ATCC",
    }),
  })
  console.log(`✔ Cell line created: ${cellLine.id} (${cellLine.name})`)

  // Verify list functions
  const compounds = await listCompounds(study.id)
  const proteins = await listProteins(study.id)
  const cellLines = await listCellLines(study.id)
  if (compounds.length !== 1 || proteins.length !== 1 || cellLines.length !== 1) {
    throw new Error("Research setup lists do not match expected count")
  }
  console.log("✔ Research setup records verified in MySQL")

  // 3. In-Silico Screening (ADMET)
  const adme = await savePrototypeAdmeRun(study.id, testUser, {
    compoundId: compound.id,
    compoundName: compound.name,
    pubchemCid: 5280343,
    smiles: compound.smiles,
    pubchemRetrieved: true,
    lipinskiOverall: "pass",
    descriptors: {
      molecularWeight: 302.24,
      logP: 1.5,
      hBondDonors: 5,
      hBondAcceptors: 7,
      rotatableBonds: 1,
    },
  })
  console.log(`✔ In-Silico ADMET run created: ${adme.id}`)
  const admeList = await listAdmetRuns(study.id)
  if (!admeList.length) throw new Error("ADMET run not retrieved")
  console.log("✔ ADMET run retrieved from MySQL")

  // 4. Molecular Docking
  console.log("--- Testing Molecular Docking: 1 Pair -> Multiple Runs ---")
  const run1 = await createDockingRun(study.id, testUser, {
    compoundId: compound.id,
    proteinId: protein.id,
    runName: "Quercetin x BAX Run 1",
    vinaVersion: "1.2.5",
    receptorPdbId: "1F16",
    modes: [
      { mode: 1, affinityKcalMol: -8.4, rmsdLowerBound: 0, rmsdUpperBound: 0 },
      { mode: 2, affinityKcalMol: -7.9, rmsdLowerBound: 1.2, rmsdUpperBound: 1.8 },
    ],
    bestBindingAffinityKcalMol: -8.4,
    searchBox: { centerX: 10, centerY: 20, centerZ: 30, sizeX: 20, sizeY: 20, sizeZ: 20 },
    provenance: defaultProvenance("PREDICTED", {
      operatorId: testUser.id,
      methodName: "AutoDock Vina",
      source: "AutoDock Vina 1.2.5",
      recordedAt: new Date().toISOString(),
    }),
  })
  console.log(`✔ Docking Run 1 created: ${run1.id}`)

  let pairs = await listDockingPairs(study.id)
  let runs = await listDockingRuns(study.id)
  if (pairs.length !== 1 || runs.length !== 1) {
    throw new Error(`Expected 1 pair and 1 run, got ${pairs.length} pairs and ${runs.length} runs`)
  }
  if (pairs[0]!.runsCount !== 1) {
    throw new Error(`Expected pair runsCount to be 1, got ${pairs[0]!.runsCount}`)
  }
  console.log("✔ After Run 1: 1 docking pair, 1 docking run, runsCount = 1")

  // Re-run the same pair (Run 2)
  const run2 = await createDockingRun(study.id, testUser, {
    compoundId: compound.id,
    proteinId: protein.id,
    runName: "Quercetin x BAX Run 2",
    vinaVersion: "1.2.5",
    receptorPdbId: "1F16",
    modes: [
      { mode: 1, affinityKcalMol: -8.6, rmsdLowerBound: 0, rmsdUpperBound: 0 },
      { mode: 2, affinityKcalMol: -8.1, rmsdLowerBound: 1.1, rmsdUpperBound: 1.7 },
    ],
    bestBindingAffinityKcalMol: -8.6,
    searchBox: { centerX: 10, centerY: 20, centerZ: 30, sizeX: 20, sizeY: 20, sizeZ: 20 },
    provenance: defaultProvenance("PREDICTED", {
      operatorId: testUser.id,
      methodName: "AutoDock Vina",
      source: "AutoDock Vina 1.2.5",
      recordedAt: new Date().toISOString(),
    }),
  })
  console.log(`✔ Docking Run 2 created: ${run2.id}`)

  pairs = await listDockingPairs(study.id)
  runs = await listAllDockingRuns(study.id)
  const dbRunCount = await queryOne<CountRow>(
    "SELECT COUNT(*) as count FROM docking_runs WHERE study_id = ?",
    [study.id]
  )
  const dbPairCount = await queryOne<CountRow>(
    "SELECT COUNT(*) as count FROM docking_pairs WHERE study_id = ?",
    [study.id]
  )
  if (pairs.length !== 1 || runs.length !== 2) {
    throw new Error(`Expected exactly 1 pair and 2 runs, got ${pairs.length} pairs and ${runs.length} runs`)
  }
  if (dbPairCount?.count !== 1 || dbRunCount?.count !== 2) {
    throw new Error(`Expected DB counts (1 pair, 2 runs), got (${dbPairCount?.count} pairs, ${dbRunCount?.count} runs)`)
  }
  if (pairs[0]!.runsCount !== 2) {
    throw new Error(`Expected pair runsCount to be 2, got ${pairs[0]!.runsCount}`)
  }
  if (pairs[0]!.latestBindingAffinity !== -8.6) {
    throw new Error(`Expected pair latestBindingAffinity to be -8.6, got ${pairs[0]!.latestBindingAffinity}`)
  }
  console.log("✔ After Run 2: Exactly 1 docking pair, 2 docking runs, runsCount = 2, latest affinity = -8.6")

  // Test database unique constraint directly
  let caughtDup = false
  try {
    await execute(
      `INSERT INTO docking_pairs (
        id, study_id, compound_id, protein_id, status, runs_count, archived,
        provenance, created_at, updated_at, created_by, updated_by
      ) VALUES (?, ?, ?, ?, 'PENDING', 0, 0, '{}', '2026-01-01', '2026-01-01', 'test', 'test')`,
      ["duplicate_pair_test_id", study.id, compound.id, protein.id]
    )
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      caughtDup = true
    }
  }
  if (!caughtDup) {
    throw new Error("Database UNIQUE constraint uq_docking_pair did not catch duplicate pair insertion!")
  }
  console.log("✔ Database UNIQUE constraint (study_id, compound_id, protein_id) verified!")

  // 5. Biological Predictions
  const pred = await createPredictionRun(study.id, testUser, {
    endpoint: "dpph",
    module: "dpph",
    runName: "DPPH Antioxidant Model",
    compoundId: compound.id,
    summaryIc50: 12.5,
    summaryIc50Unit: "uM",
    methodName: "Documented In-Silico Regression",
    methodType: "documented_model",
    source: "NANOTOPHEA In-Silico Engine",
    concentrationUnit: "uM",
    resultPoints: [
      { concentration: 10, concentrationUnit: "uM", metric: "inhibition", value: 45.2, valueUnit: "%" },
      { concentration: 20, concentrationUnit: "uM", metric: "inhibition", value: 78.4, valueUnit: "%" },
    ],
    dateGenerated: new Date().toISOString(),
    provenance: defaultProvenance("PREDICTED", {
      operatorId: testUser.id,
      methodName: "DPPH Model",
      source: "NANOTOPHEA In-Silico Engine",
      recordedAt: new Date().toISOString(),
    }),
  })
  console.log(`✔ Biological prediction created: ${pred.id}`)
  const predList = await listPredictionRuns(study.id)
  if (!predList.length) throw new Error("Biological predictions not found")
  console.log("✔ Biological predictions verified in MySQL")

  // 6. Laboratory Validation
  const labDataset = await createLabDataset(study.id, testUser, {
    assayType: "dpph",
    datasetName: "DPPH Experimental Validation Assay",
    compoundId: compound.id,
    datePerformed: "2026-10-18",
    protocolReference: "Standard DPPH Protocol v1",
    treatmentSummaries: [
      { treatmentCode: "T1", metric: "absorbance", mean: 0.852, sd: 0.012, n: 3, dataClass: "DERIVED_FROM_EXPERIMENTAL" },
      { treatmentCode: "T2", metric: "absorbance", mean: 0.421, sd: 0.015, n: 3, dataClass: "DERIVED_FROM_EXPERIMENTAL" },
    ],
    observations: [],
    provenance: defaultProvenance("EXPERIMENTAL", {
      operatorId: testUser.id,
      source: "Bench experiment",
      recordedAt: new Date().toISOString(),
    }),
  })
  console.log(`✔ Laboratory dataset created: ${labDataset.id}`)

  const rep = await saveLabReplicate(study.id, labDataset.id, testUser, {
    treatmentCode: "T1",
    replicateCode: "R1",
    replicateN: 1,
    concentration: 10,
    concentrationUnit: "ug_per_mL",
    measurements: { absorbance: 0.852, scavenging: 48.6 },
  })
  console.log(`✔ Laboratory replicate created: ${rep.id}`)

  const reps = await listLabReplicates(study.id, labDataset.id)
  if (reps.length !== 1) throw new Error("Lab replicate not found")
  console.log("✔ Laboratory validation records verified in MySQL")

  // 7. Analysis & Interpretation
  const interp = await createInterpretation(study.id, testUser, {
    title: "Overall Antineoplastic Phytochemical Interpretation",
    researchQuestion: "Does Quercetin exhibit target affinity against BAX?",
    hypothesisText: "Quercetin demonstrates high binding affinity against BAX in hepatocellular carcinoma.",
    linkedEvidence: [
      {
        sourceType: "dockingRun",
        sourceId: run2.id,
        label: "Quercetin x BAX (-8.6 kcal/mol)",
        evidenceClass: "PREDICTED",
        updatedAt: run2.updatedAt,
      },
    ],
    interpretationText: "Docking results demonstrate favorable binding affinity of -8.6 kcal/mol.",
    conclusion: "Quercetin is a viable candidate for further in-vitro validation.",
    hypothesisAssessment: "supported",
    status: "final",
    provenance: defaultProvenance("INTERPRETATION", {
      operatorId: testUser.id,
      recordedAt: new Date().toISOString(),
    }),
  })
  console.log(`✔ Interpretation created: ${interp.id}`)
  const interpList = await listInterpretations(study.id)
  if (!interpList.length) throw new Error("Interpretation not found in MySQL")
  console.log("✔ Interpretation verified in MySQL")

  // 8. AI Research Assistant Data Retrieval from MySQL
  const aiSlice = await loadStudyAISlice(study.id)
  if (!aiSlice || !aiSlice.title || aiSlice.compounds.length !== 1 || aiSlice.docking.length < 1) {
    throw new Error("AI research slice failed to retrieve MySQL study data")
  }
  console.log("✔ AI research assistant context slice retrieved successfully from MySQL")

  // Cleanup test study
  await execute(`DELETE FROM studies WHERE owner_id = ?`, [testUser.id])
  await execute(`DELETE FROM users WHERE id = ?`, [testUser.id])
  console.log("✔ Test study and user cleaned up successfully")

  console.log("=== ALL PERSISTENCE TESTS PASSED ===")
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err)
    process.exit(1)
  })
