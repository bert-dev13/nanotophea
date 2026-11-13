import type { DbExecutor, Migration } from "../lib/db/migration-helpers"

export const migration: Migration = {
  id: "006_nanoparticle_preparation_protocol",
  name: "Add preparation_protocol JSON for Chitosan–TPP Steps 8–11 and ingredients",
  async up(conn: DbExecutor) {
    const tableInfo: any[] = await conn.query("SHOW COLUMNS FROM `nanoparticle_formulations`")
    const columns = new Set(tableInfo.map((row) => row.Field))

    if (!columns.has("preparation_protocol")) {
      await conn.query(
        "ALTER TABLE `nanoparticle_formulations` ADD COLUMN `preparation_protocol` JSON NULL AFTER `preparation_notes`"
      )
    }
  },
  async down() {},
}

export default migration
