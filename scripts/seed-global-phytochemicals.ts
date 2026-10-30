import type { RowDataPacket } from "mysql2/promise"
import { getPool } from "../lib/db/mysql"
import { CATALOG_COMPOUNDS } from "../lib/catalog/reusableResearchCatalog"

async function main() {
  const pool = getPool()

  console.log("Creating global_phytochemicals table if not exists...")
  await pool.query(`
    CREATE TABLE IF NOT EXISTS global_phytochemicals (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      pubchem_cid INT,
      smiles TEXT,
      formula VARCHAR(128),
      molecular_weight DOUBLE,
      chemical_class VARCHAR(128),
      plant_part VARCHAR(128),
      filter_category VARCHAR(64),
      source VARCHAR(255),
      notes TEXT,
      created_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)

  console.log(`Seeding ${CATALOG_COMPOUNDS.length} validated compounds into global_phytochemicals...`)
  const now = new Date().toISOString()
  for (const c of CATALOG_COMPOUNDS) {
    await pool.query(
      `INSERT INTO global_phytochemicals (
        id, name, pubchem_cid, smiles, formula, molecular_weight,
        chemical_class, plant_part, filter_category, source, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        pubchem_cid = VALUES(pubchem_cid),
        smiles = VALUES(smiles),
        formula = VALUES(formula),
        molecular_weight = VALUES(molecular_weight),
        chemical_class = VALUES(chemical_class),
        plant_part = VALUES(plant_part),
        filter_category = VALUES(filter_category),
        source = VALUES(source),
        notes = VALUES(notes)
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
        c.filter ?? null,
        c.source ?? null,
        c.notes ?? null,
        now,
      ]
    )
  }

  interface CountRow extends RowDataPacket {
    count: number
  }

  const [countRows] = await pool.query<CountRow[]>(
    "SELECT COUNT(*) as count FROM global_phytochemicals"
  )
  console.log("Global phytochemicals count in MySQL:", countRows[0]?.count)

  const [studyRows] = await pool.query<CountRow[]>(
    "SELECT COUNT(*) as count FROM phytochemicals"
  )
  console.log("Study phytochemical selections count in MySQL:", studyRows[0]?.count)

  await pool.end()
}

main().catch((err) => {
  console.error("Error seeding global phytochemicals:", err)
  process.exit(1)
})
