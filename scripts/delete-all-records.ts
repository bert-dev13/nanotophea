/**
 * Script to delete all study records in MySQL (nanotophea_db) while preserving user accounts.
 *
 * Usage:
 *   npx tsx scripts/delete-all-records.ts
 */
import { execute, query, closePool } from "../lib/db/mysql"

async function main() {
  console.log("==========================================")
  console.log("  HEPATOTEA MySQL Record Cleanup Tool")
  console.log("==========================================\n")

  // 1. Verify User Accounts
  const users = await query<any>("SELECT id, email, role, display_name FROM users")
  console.log(`[Users] Preserving ${users.length} user account(s):`)
  users.forEach((u) => {
    console.log(`  - Account ID: ${u.id} | Email: ${u.email} | Role: ${u.role}`)
  })
  console.log()

  // 2. Delete All Studies and Nested Records (CASCADE deletes all linked rows)
  const studies = await query<any>("SELECT id, title FROM studies")
  console.log(`[Studies] Found ${studies.length} study record(s) to delete.`)

  if (studies.length > 0) {
    await execute("DELETE FROM studies")
    console.log("  ✔ All studies and cascading sub-records deleted from nanotophea_db.")
  }

  // 3. Clear Literature Cache
  try {
    await execute("DELETE FROM literature_cache")
    console.log("  ✔ Literature cache cleared.")
  } catch {
    // Optional
  }

  console.log("\n==========================================")
  console.log("  Cleanup Complete!")
  console.log(`  - User Accounts: ${users.length} preserved`)
  console.log("  - Study Records: All deleted from MySQL")
  console.log("==========================================\n")

  await closePool()
}

main().catch(async (error: unknown) => {
  console.error("\nError executing cleanup script:", error instanceof Error ? error.message : error)
  await closePool().catch(() => {})
  process.exit(1)
})
