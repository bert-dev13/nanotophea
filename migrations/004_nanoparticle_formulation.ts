import type { DbExecutor, Migration } from "../lib/db/migration-helpers"

export const migration: Migration = {
  id: "004_nanoparticle_formulation",
  name: "Create nanoparticle_formulations table for Chitosan-TPP carrier documentation",
  async up(conn: DbExecutor) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`nanoparticle_formulations\` (
        \`id\` VARCHAR(64) NOT NULL,
        \`study_id\` VARCHAR(64) NOT NULL,
        \`system_name\` VARCHAR(255) NOT NULL DEFAULT 'Chitosan–TPP Nanoparticle System',
        \`carrier_type\` VARCHAR(64) NOT NULL DEFAULT 'chitosan_tpp',

        -- Chitosan parameters
        \`chitosan_concentration\` VARCHAR(64) NULL,
        \`chitosan_molecular_weight\` VARCHAR(128) NULL,
        \`chitosan_deacetylation_degree\` VARCHAR(64) NULL,
        \`chitosan_solvent\` VARCHAR(128) NULL,
        \`chitosan_ph\` VARCHAR(64) NULL,

        -- TPP parameters
        \`tpp_concentration\` VARCHAR(64) NULL,
        \`tpp_ph\` VARCHAR(64) NULL,

        -- Formation / crosslinking parameters
        \`chitosan_tpp_ratio\` VARCHAR(64) NULL,
        \`mixing_method\` VARCHAR(128) NULL,
        \`addition_method\` VARCHAR(128) NULL,
        \`stirring_rate\` VARCHAR(64) NULL,
        \`stirring_duration\` VARCHAR(64) NULL,
        \`temperature\` VARCHAR(64) NULL,
        \`preparation_notes\` TEXT NULL,

        -- Nanoparticle characterization (Experimental measurements)
        \`particle_size_nm\` DOUBLE NULL,
        \`pdi\` DOUBLE NULL,
        \`zeta_potential_mv\` DOUBLE NULL,
        \`encapsulation_efficiency_percent\` DOUBLE NULL,
        \`loading_capacity_percent\` DOUBLE NULL,
        \`characterization_notes\` TEXT NULL,

        -- Computational modeling status
        \`computational_status\` VARCHAR(64) NOT NULL DEFAULT 'not_configured',
        \`computational_notes\` TEXT NULL,

        -- Evidence & Provenance
        \`provenance\` JSON NOT NULL,
        \`reference_ids\` JSON NULL,

        \`created_at\` VARCHAR(64) NOT NULL,
        \`updated_at\` VARCHAR(64) NOT NULL,
        \`created_by\` VARCHAR(128) NOT NULL,
        \`updated_by\` VARCHAR(128) NOT NULL,

        PRIMARY KEY (\`id\`),
        KEY \`idx_nanoform_study\` (\`study_id\`),
        CONSTRAINT \`fk_nanoform_study\` FOREIGN KEY (\`study_id\`) REFERENCES \`studies\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
  },
}

export default migration

