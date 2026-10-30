import type { DbExecutor, Migration } from "../lib/db/migration-helpers"
import { CATALOG_COMPOUNDS } from "../lib/catalog/reusableResearchCatalog"

export const migration: Migration = {
  id: "003_global_phytochemicals",
  name: "Create and initialize global_phytochemicals library",
  async up(conn: DbExecutor) {
    // 1. Ensure table structure
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`global_phytochemicals\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`pubchem_cid\` INT NULL,
        \`smiles\` TEXT NULL,
        \`formula\` VARCHAR(128) NULL,
        \`molecular_weight\` DOUBLE NULL,
        \`chemical_class\` VARCHAR(128) NULL,
        \`plant_part\` VARCHAR(128) NULL,
        \`filter_category\` VARCHAR(64) NULL,
        \`source\` VARCHAR(255) NULL,
        \`notes\` TEXT NULL,
        \`created_at\` VARCHAR(64) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // 2. Check if already seeded to preserve existing data
    const [rows]: any = await conn.query("SELECT COUNT(*) as count FROM `global_phytochemicals`")
    const count = Number(rows?.[0]?.count || 0)

    if (count === 0 && Array.isArray(CATALOG_COMPOUNDS) && CATALOG_COMPOUNDS.length > 0) {
      const now = new Date().toISOString()
      for (const c of CATALOG_COMPOUNDS) {
        await conn.query(
          `INSERT INTO \`global_phytochemicals\` (
            \`id\`, \`name\`, \`pubchem_cid\`, \`smiles\`, \`formula\`, \`molecular_weight\`,
            \`chemical_class\`, \`plant_part\`, \`filter_category\`, \`source\`, \`notes\`, \`created_at\`
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            \`name\` = VALUES(\`name\`),
            \`pubchem_cid\` = VALUES(\`pubchem_cid\`),
            \`smiles\` = VALUES(\`smiles\`),
            \`formula\` = VALUES(\`formula\`),
            \`molecular_weight\` = VALUES(\`molecular_weight\`),
            \`chemical_class\` = VALUES(\`chemical_class\`),
            \`plant_part\` = VALUES(\`plant_part\`),
            \`filter_category\` = VALUES(\`filter_category\`),
            \`source\` = VALUES(\`source\`),
            \`notes\` = VALUES(\`notes\`)
          `,
          [
            c.key,
            c.name,
            c.pubchemCid ?? null,
            c.smiles ?? null,
            c.formula ?? null,
            c.molecularWeight ?? null,
            c.chemicalClass ?? null,
            c.plantPart ?? null,
            c.filterCategory ?? null,
            c.source ?? null,
            c.notes ?? null,
            now,
          ]
        )
      }
    }
  },
}

export default migration
