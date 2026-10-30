import { getAdminDb } from "../lib/firebase/admin"
import { canonicalDockingPairDocId } from "../lib/domain/models"
import { profileSpecForProtein, dockingSystemLabels } from "../lib/docking/profiles"

async function run() {
  console.log("=== VERIFYING DOCKING WORKSPACE ON STUDY 2WldMm0VQyKS6e98iPiY ===")
  const db = getAdminDb()
  const studyDoc = await db.collection("studies").doc("2WldMm0VQyKS6e98iPiY").get()
  if (!studyDoc.exists) {
    console.error("Study does not exist!")
    process.exit(1)
  }
  const study = studyDoc.data()!
  console.log("Study Title:", study.title)
  console.log("Study ID: 2WldMm0VQyKS6e98iPiY")

  const compounds = await db.collection("studies/2WldMm0VQyKS6e98iPiY/compounds").get()
  console.log(`Compounds (${compounds.size}):`, compounds.docs.map((d) => d.data().name).join(", "))

  const proteins = await db.collection("studies/2WldMm0VQyKS6e98iPiY/proteins").get()
  console.log(`Target proteins (${proteins.size}):`, proteins.docs.map((d) => d.data().name).join(", "))

  const pairs = await db.collection("studies/2WldMm0VQyKS6e98iPiY/dockingPairs").get()
  console.log(`Canonical pairs in database: ${pairs.size}`)

  const runs = await db.collection("studies/2WldMm0VQyKS6e98iPiY/dockingRuns").get()
  console.log(`Total historical runs in database: ${runs.size}`)

  console.log("\n--- PAIR STATUSES & CANONICAL KEYS ---")
  for (const doc of pairs.docs) {
    const p = doc.data()
    console.log(`Pair [${p.id}]: ${p.compoundName} × ${p.targetName}`)
    console.log(`  Status: ${p.status}, Latest Run: ${p.latestRunId}, Affinity: ${p.latestBindingAffinity} kcal/mol, Total runs: ${p.runsCount}`)
  }

  console.log("\n--- TARGET VERIFICATION & SPECIAL HANDLING ---")
  for (const doc of proteins.docs) {
    const prot = doc.data()
    const spec = profileSpecForProtein(prot as any)
    const labels = spec ? dockingSystemLabels({ name: prot.name, spec }) : null
    console.log(`Target: ${prot.name}`)
    console.log(`  Receptor: ${spec?.dockingReceptor}`)
    console.log(`  Structure source: ${spec?.structureSource ?? "EXPERIMENTAL_STRUCTURE"}`)
    console.log(`  Structure ID / PDB: ${spec?.structureId ?? spec?.pdbId}`)
    console.log(`  Binding site: ${spec?.bindingSiteLabel}`)
    if (prot.name === "LATS1") {
      console.log(`  [LATS1 CHECK] Is Predicted: ${spec?.structureSource === "PREDICTED_STRUCTURE"}, Structure: ${spec?.structureId}`)
    }
    if (prot.name === "YAP1") {
      console.log(`  [YAP1 CHECK] Receptor differs from target: ${labels?.receptorDiffers}, Receptor: ${labels?.dockingReceptor}, PDB: ${labels?.pdbId}`)
    }
  }

  console.log("\n=== VERIFICATION COMPLETE ===")
}

run().catch((e) => {
  console.error("Verification error:", e)
  process.exit(1)
})
