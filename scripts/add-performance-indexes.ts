import { execute, query } from "@/lib/db/mysql"

async function addIndexIfNotExists(table: string, indexName: string, columns: string) {
  try {
    const existing = await query<any>(`SHOW INDEX FROM ${table} WHERE Key_name = ?`, [indexName])
    if (existing.length > 0) {
      console.log(`Index ${indexName} already exists on ${table}.`)
      return
    }
    console.log(`Adding index ${indexName} ON ${table} (${columns})...`)
    await execute(`ALTER TABLE ${table} ADD INDEX ${indexName} (${columns})`)
    console.log(`✓ Index ${indexName} added successfully.`)
  } catch (err: any) {
    console.warn(`Note on ${indexName}:`, err.message)
  }
}

async function main() {
  console.log("=== APPLYING TARGETED DATABASE INDEXES ===")

  // 1. Studies
  await addIndexIfNotExists("studies", "idx_studies_owner_updated", "owner_id, updated_at")

  // 2. Study Members
  await addIndexIfNotExists("study_members", "idx_sm_user_study", "user_id, study_id")

  // 3. Docking Runs
  await addIndexIfNotExists("docking_runs", "idx_dr_study_completed", "study_id, completed_at, created_at")
  await addIndexIfNotExists("docking_runs", "idx_dr_study_pair", "study_id, pair_id")

  // 4. Docking Pairs
  await addIndexIfNotExists("docking_pairs", "idx_dp_study_status", "study_id, status")

  // 5. In-silico ADMET Runs
  await addIndexIfNotExists("admet_runs", "idx_admet_study_compound", "study_id, compound_id")

  // 6. Biological Predictions
  await addIndexIfNotExists("biological_predictions", "idx_pred_study_endpoint", "study_id, endpoint")

  // 7. Laboratory Datasets
  await addIndexIfNotExists("laboratory_datasets", "idx_lab_study_assay", "study_id, assay_type")

  // 8. Audit Logs
  await addIndexIfNotExists("audit_logs", "idx_audit_study_created", "study_id, created_at")

  console.log("=== INDEX APPLICATION COMPLETE ===")
  process.exit(0)
}

main().catch((err) => {
  console.error("Failed to add indexes:", err)
  process.exit(1)
})
