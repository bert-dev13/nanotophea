import { addIndexIfNotExists, type DbExecutor, type Migration } from "../lib/db/migration-helpers"

export const migration: Migration = {
  id: "002_performance_indexes",
  name: "Add targeted performance indexes for high-frequency queries",
  async up(conn: DbExecutor) {
    // 1. Studies
    await addIndexIfNotExists(conn, "studies", "idx_studies_owner_updated", "owner_id, updated_at")

    // 2. Study Members
    await addIndexIfNotExists(conn, "study_members", "idx_sm_user_study", "user_id, study_id")

    // 3. Docking Runs
    await addIndexIfNotExists(conn, "docking_runs", "idx_dr_study_completed", "study_id, completed_at, created_at")
    await addIndexIfNotExists(conn, "docking_runs", "idx_dr_study_pair", "study_id, pair_id")

    // 4. Docking Pairs
    await addIndexIfNotExists(conn, "docking_pairs", "idx_dp_study_status", "study_id, status")

    // 5. In-silico ADMET Runs
    await addIndexIfNotExists(conn, "admet_runs", "idx_admet_study_compound", "study_id, compound_id")

    // 6. Biological Predictions
    await addIndexIfNotExists(conn, "biological_predictions", "idx_pred_study_endpoint", "study_id, endpoint")

    // 7. Laboratory Datasets
    await addIndexIfNotExists(conn, "laboratory_datasets", "idx_lab_study_assay", "study_id, assay_type")

    // 8. Audit Logs (column is `at`, not `created_at`)
    await addIndexIfNotExists(conn, "audit_logs", "idx_audit_study_at", "study_id, at")
  },
}

export default migration
