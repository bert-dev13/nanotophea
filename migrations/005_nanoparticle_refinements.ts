import type { DbExecutor, Migration } from "../lib/db/migration-helpers"

export const migration: Migration = {
  id: "005_nanoparticle_refinements",
  name: "Add record_type, units and characterization metadata to nanoparticle_formulations",
  async up(conn: DbExecutor) {
    const tableInfo: any[] = await conn.query("SHOW COLUMNS FROM `nanoparticle_formulations`")
    const columns = new Set(tableInfo.map((row) => row.Field))

    if (!columns.has("record_type")) {
      await conn.query(
        "ALTER TABLE `nanoparticle_formulations` ADD COLUMN `record_type` VARCHAR(32) NOT NULL DEFAULT 'research' AFTER `carrier_type`"
      )
    }
    if (!columns.has("chitosan_concentration_unit")) {
      await conn.query(
        "ALTER TABLE `nanoparticle_formulations` ADD COLUMN `chitosan_concentration_unit` VARCHAR(32) NULL DEFAULT 'mg/mL' AFTER `chitosan_concentration`"
      )
    }
    if (!columns.has("chitosan_mw_unit")) {
      await conn.query(
        "ALTER TABLE `nanoparticle_formulations` ADD COLUMN `chitosan_mw_unit` VARCHAR(32) NULL DEFAULT 'kDa' AFTER `chitosan_molecular_weight`"
      )
    }
    if (!columns.has("tpp_concentration_unit")) {
      await conn.query(
        "ALTER TABLE `nanoparticle_formulations` ADD COLUMN `tpp_concentration_unit` VARCHAR(32) NULL DEFAULT 'mg/mL' AFTER `tpp_concentration`"
      )
    }
    if (!columns.has("instrument")) {
      await conn.query(
        "ALTER TABLE `nanoparticle_formulations` ADD COLUMN `instrument` VARCHAR(128) NULL AFTER `loading_capacity_percent`"
      )
    }
    if (!columns.has("measurement_method")) {
      await conn.query(
        "ALTER TABLE `nanoparticle_formulations` ADD COLUMN `measurement_method` VARCHAR(128) NULL AFTER `instrument`"
      )
    }
    if (!columns.has("experiment_date")) {
      await conn.query(
        "ALTER TABLE `nanoparticle_formulations` ADD COLUMN `experiment_date` VARCHAR(64) NULL AFTER `measurement_method`"
      )
    }
    if (!columns.has("researcher")) {
      await conn.query(
        "ALTER TABLE `nanoparticle_formulations` ADD COLUMN `researcher` VARCHAR(128) NULL AFTER `experiment_date`"
      )
    }
    if (!columns.has("sample_batch_id")) {
      await conn.query(
        "ALTER TABLE `nanoparticle_formulations` ADD COLUMN `sample_batch_id` VARCHAR(128) NULL AFTER `researcher`"
      )
    }
  },
  async down() {},
}

