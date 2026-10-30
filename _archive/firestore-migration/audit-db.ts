import { getAdminDb } from "../lib/firebase/admin"

async function audit() {
  const db = getAdminDb()

  console.log("=== TOP LEVEL COLLECTIONS ===")
  const topCollections = await db.listCollections()
  console.log("Top-level collections found:", topCollections.map(c => c.id))

  for (const col of topCollections) {
    const snap = await col.get()
    console.log(`\nCollection: ${col.id} (${snap.size} documents)`)
    
    if (col.id === "users") {
      for (const doc of snap.docs) {
        console.log(`  User: ${doc.id} -> ${JSON.stringify(doc.data())}`)
      }
    } else if (col.id === "studies") {
      for (const studyDoc of snap.docs) {
        const sData = studyDoc.data()
        console.log(`\n--- Study [${studyDoc.id}] : "${sData.title}" (owner: ${sData.ownerId}) ---`)
        const subCols = await studyDoc.ref.listCollections()
        console.log(`    Subcollections:`, subCols.map(c => c.id))

        for (const sub of subCols) {
          const subSnap = await sub.get()
          console.log(`      Subcollection ${sub.id}: ${subSnap.size} docs`)
          if (sub.id === "labDatasets") {
            for (const labDoc of subSnap.docs) {
              const repSnap = await labDoc.ref.collection("replicates").get()
              console.log(`        labDataset [${labDoc.id}] (${labDoc.data().assayType || labDoc.data().assay}) has ${repSnap.size} replicates`)
            }
          }
        }
      }
    } else {
      for (const doc of snap.docs.slice(0, 3)) {
        console.log(`  Doc: ${doc.id} -> keys:`, Object.keys(doc.data()))
      }
    }
  }
}

audit().catch(console.error)
