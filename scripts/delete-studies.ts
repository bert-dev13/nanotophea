/**
 * Delete listed study records in MySQL (nanotophea_db).
 * Usage: npx tsx scripts/delete-studies.ts
 */
import { execute, query, closePool } from "../lib/db/mysql"

const TITLES = [
  "fsfd",
  "sdfsdf",
  "Access check",
  "bert",
  "tes",
  "NanoHepatoTea SIP 2026",
  "NanoHepatoTea Demo Study",
]

async function main() {
  console.log("=== DELETE STUDIES (MYSQL) ===")
  const studies = await query<any>("SELECT id, title, status FROM studies")
  console.log(`Studies in MySQL: ${studies.length}`)

  const wanted = new Set(TITLES)
  const matches = studies.filter((s) => wanted.has(s.title?.trim()))
  console.log(`Matching titles to delete: ${matches.length}`)

  for (const s of matches) {
    console.log(`Deleting study ${s.id} ("${s.title}")...`)
    await execute("DELETE FROM studies WHERE id = ?", [s.id])
    console.log(`✔ Deleted ${s.id}`)
  }

  const remaining = await query<any>("SELECT id, title FROM studies")
  console.log(`Remaining studies: ${remaining.length}`)
  await closePool()
}

main().catch((err) => {
  console.error("Delete error:", err)
  process.exit(1)
})
