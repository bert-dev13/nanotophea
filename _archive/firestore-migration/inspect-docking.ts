import { getAdminDb } from "../lib/firebase/admin"

async function main() {
  const db = getAdminDb()
  const studiesSnap = await db.collection("studies").get()
  console.log(`Found ${studiesSnap.docs.length} studies:`)
  for (const sDoc of studiesSnap.docs) {
    const study = sDoc.data()
    console.log(`\nStudy: ${sDoc.id} - ${study.title}`)
    const compoundsSnap = await db.collection(`studies/${sDoc.id}/compounds`).get()
    console.log(`  Compounds (${compoundsSnap.docs.length}):`, compoundsSnap.docs.map(d => `${d.id} (${d.data().name})`))
    
    const proteinsSnap = await db.collection(`studies/${sDoc.id}/proteins`).get()
    console.log(`  Proteins (${proteinsSnap.docs.length}):`, proteinsSnap.docs.map(d => `${d.id} (${d.data().name}, pdb: ${d.data().pdbId})`))
    
    const dockingRunsSnap = await db.collection(`studies/${sDoc.id}/dockingRuns`).get()
    console.log(`  DockingRuns total in DB: ${dockingRunsSnap.docs.length}`)
    const runGroups: Record<string, any[]> = {}
    for (const rDoc of dockingRunsSnap.docs) {
      const data = rDoc.data()
      const key = `${data.compoundId} × ${data.proteinId}`
      if (!runGroups[key]) runGroups[key] = []
      runGroups[key].push({
        id: rDoc.id,
        affinity: data.bestBindingAffinityKcalMol,
        modesCount: data.modes?.length,
        status: data.status,
        dockingStatus: data.dockingStatus,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
    }
    for (const [key, list] of Object.entries(runGroups)) {
      console.log(`    Pair [${key}]: ${list.length} runs`)
      for (const r of list) {
        console.log(`      - id: ${r.id}, aff: ${r.affinity}, modes: ${r.modesCount}, created: ${r.createdAt}, updated: ${r.updatedAt}`)
      }
    }

    const dockingPairsSnap = await db.collection(`studies/${sDoc.id}/dockingPairs`).get()
    console.log(`  DockingPairs collection exists? count: ${dockingPairsSnap.docs.length}`)
  }
}

main().catch(console.error)
