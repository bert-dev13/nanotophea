import type { PoolConnection } from "mysql2/promise"

export type DbExecutor = PoolConnection

export interface Migration {
  id: string
  name: string
  up: (conn: DbExecutor) => Promise<void>
  down?: (conn: DbExecutor) => Promise<void>
}

/**
 * Checks whether a table exists in the current database.
 */
export async function tableExists(conn: DbExecutor, tableName: string): Promise<boolean> {
  const [rows]: any = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  )
  return Number(rows[0]?.c || 0) > 0
}

/**
 * Checks whether a column exists in a specific table.
 */
export async function columnExists(
  conn: DbExecutor,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const [rows]: any = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  )
  return Number(rows[0]?.c || 0) > 0
}

/**
 * Adds a column to a table if it does not already exist.
 */
export async function addColumnIfNotExists(
  conn: DbExecutor,
  tableName: string,
  columnName: string,
  definition: string
): Promise<boolean> {
  if (!(await columnExists(conn, tableName, columnName))) {
    await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`)
    return true
  }
  return false
}

/**
 * Checks whether an index exists on a table.
 */
export async function indexExists(
  conn: DbExecutor,
  tableName: string,
  indexName: string
): Promise<boolean> {
  const [rows]: any = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  )
  return Number(rows[0]?.c || 0) > 0
}

/**
 * Adds an index to a table if it does not already exist.
 */
export async function addIndexIfNotExists(
  conn: DbExecutor,
  tableName: string,
  indexName: string,
  columns: string
): Promise<boolean> {
  if (!(await indexExists(conn, tableName, indexName))) {
    await conn.query(`ALTER TABLE \`${tableName}\` ADD INDEX \`${indexName}\` (${columns})`)
    return true
  }
  return false
}

/**
 * Drops an index from a table if it exists.
 */
export async function dropIndexIfExists(
  conn: DbExecutor,
  tableName: string,
  indexName: string
): Promise<boolean> {
  if (await indexExists(conn, tableName, indexName)) {
    await conn.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``)
    return true
  }
  return false
}
