import { getAdminDb } from "../lib/firebase/admin"

async function main() {
  const db = getAdminDb()
  const studiesSnap = await db.collection("studies").get()
  for (const sDoc of studiesSnap.docs) {
    const study = sDoc.data()
    console.log(`\nStudy: ${sDoc.id} - ${study.title}`)
    const proteinsSnap = await db.collection(`studies/${sDoc.id}/proteins`).get()
    for (const p of proteinsSnap.docs) {
      console.log(`  Protein ${p.id}: name=${p.data().name}, pdbId=${p.data().pdbId}, biologicalTarget=${p.data().biologicalTarget}, selected=${p.data().selected}, archived=${p.data().archived}, status=${p.data().status}`)
    }
    const compoundsSnap = await db.collection(`studies/${sDoc.id}/compounds`).get()
    for (const c of compoundsSnap.docs) {
      console.log(`  Compound ${c.id}: name=${c.data().name}, cid=${c.data().pubchemCid}, selected=${c.data().selected}, archived=${c.data().archived}, status=${c.data().status}`)
    }
  }
}

main().catch(console.error)
