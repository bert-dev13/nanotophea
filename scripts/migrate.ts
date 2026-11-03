import fs from "fs"
import path from "path"
import { pathToFileURL } from "url"
import mysql, { type PoolConnection } from "mysql2/promise"
import type { Migration } from "../lib/db/migration-helpers"

// 1. Load environment variables from .env.local and .env
function loadEnv() {
  const envFiles = [".env.local", ".env"]
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file)
    if (!fs.existsSync(fullPath)) continue
    const content = fs.readFileSync(fullPath, "utf-8")
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim()
        let val = trimmed.slice(eqIdx + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (process.env[key] === undefined) {
          process.env[key] = val
        }
      }
    }
  }
}

loadEnv()

function getDbConfig(): mysql.PoolOptions {
  const dbUrl = process.env.DATABASE_URL
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl)
      return {
        host: parsed.hostname || "localhost",
        port: parsed.port ? parseInt(parsed.port, 10) : 3306,
        user: decodeURIComponent(parsed.username || "root"),
        password: decodeURIComponent(parsed.password || ""),
        database: parsed.pathname.replace(/^\//, "") || "nanotophea_db",
        waitForConnections: true,
        connectionLimit: 5,
        enableKeepAlive: true,
      }
    } catch {
      // Fall through to separate env vars
    }
  }

  return {
    host: process.env.MYSQL_HOST || "localhost",
    port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE || "nanotophea_db",
    waitForConnections: true,
    connectionLimit: 5,
    enableKeepAlive: true,
  }
}

async function getMigrationsList(): Promise<{ file: string; migration: Migration }[]> {
  const migrationsDir = path.resolve(__dirname, "../migrations")
  if (!fs.existsSync(migrationsDir)) {
    return []
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts"))
    .sort()

  const migrations: { file: string; migration: Migration }[] = []
  for (const file of files) {
    const filePath = path.join(migrationsDir, file)
    const mod = await import(pathToFileURL(filePath).href)
    const mig: Migration = mod.migration || mod.default
    if (!mig || !mig.id || typeof mig.up !== "function") {
      throw new Error(`Migration file "${file}" does not export a valid Migration object.`)
    }
    migrations.push({ file, migration: mig })
  }

  return migrations
}

async function ensureMigrationTable(conn: PoolConnection): Promise<void> {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`name\` VARCHAR(255) NOT NULL,
      \`batch\` INT NOT NULL,
      \`execution_time_ms\` INT NOT NULL,
      \`executed_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
}

async function runStatus(): Promise<void> {
  const pool = mysql.createPool(getDbConfig())
  const conn = await pool.getConnection()

  try {
    await ensureMigrationTable(conn)
    const [rows]: any = await conn.query("SELECT * FROM `schema_migrations` ORDER BY `id` ASC")
    const appliedMap = new Map<string, any>()
    for (const r of rows) {
      appliedMap.set(r.id, r)
    }

    const allMigrations = await getMigrationsList()

    console.log("\n=======================================================")
    console.log("          NANO-HEPATOTEA DATABASE MIGRATIONS")
    console.log("=======================================================\n")

    for (const { migration } of allMigrations) {
      const applied = appliedMap.get(migration.id)
      if (applied) {
        console.log(`[APPLIED] ${migration.id} - ${migration.name} (Batch ${applied.batch}, ${applied.execution_time_ms}ms)`)
      } else {
        console.log(`[PENDING] ${migration.id} - ${migration.name}`)
      }
    }

    const pendingCount = allMigrations.filter((m) => !appliedMap.has(m.migration.id)).length
    console.log(`\nTotal migrations: ${allMigrations.length} | Applied: ${appliedMap.size} | Pending: ${pendingCount}\n`)
  } finally {
    conn.release()
    await pool.end()
  }
}

async function runMigrate(): Promise<void> {
  const pool = mysql.createPool(getDbConfig())
  const conn = await pool.getConnection()

  try {
    await ensureMigrationTable(conn)

    const [rows]: any = await conn.query("SELECT `id` FROM `schema_migrations`")
    const appliedIds = new Set<string>(rows.map((r: any) => r.id))

    const [batchRows]: any = await conn.query("SELECT COALESCE(MAX(`batch`), 0) + 1 AS nextBatch FROM `schema_migrations`")
    const nextBatch: number = batchRows[0]?.nextBatch || 1

    const allMigrations = await getMigrationsList()
    const pendingMigrations = allMigrations.filter((m) => !appliedIds.has(m.migration.id))

    console.log("NANO-HEPATOTEA DATABASE MIGRATIONS\n")

    for (const item of allMigrations) {
      const { migration } = item
      if (appliedIds.has(migration.id)) {
        console.log(`[OK] Migration ${migration.id} already applied`)
      } else {
        console.log(`[..] Applying migration ${migration.id}: ${migration.name}`)
        const startTime = Date.now()
        try {
          await migration.up(conn)
          const elapsed = Date.now() - startTime
          await conn.query(
            `INSERT INTO \`schema_migrations\` (\`id\`, \`name\`, \`batch\`, \`execution_time_ms\`, \`executed_at\`)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(3))`,
            [migration.id, migration.name, nextBatch, elapsed]
          )
          appliedIds.add(migration.id)
          console.log(`[OK] Migration ${migration.id} completed (${elapsed}ms)`)
        } catch (err: any) {
          console.error(`\n[ERROR] Migration failed: ${migration.id} (${migration.name})`)
          console.error(`SQL Error: ${err?.message || err}`)
          if (err?.sql) {
            console.error(`Failed Statement: ${err.sql}`)
          }
          throw err
        }
      }
    }

    console.log("\n[OK] Database schema fully up to date.")
  } finally {
    conn.release()
    await pool.end()
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes("--status")) {
    await runStatus()
  } else {
    await runMigrate()
  }
}

main().catch((err) => {
  console.error("Migration runner terminated with error:", err?.message || err)
  process.exit(1)
})
