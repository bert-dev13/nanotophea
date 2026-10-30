import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise"

interface GlobalWithMysql {
  __nanotopheaMysqlPool?: Pool
}

const globalForMysql = globalThis as unknown as GlobalWithMysql

function getPoolConfig(): mysql.PoolOptions {
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
        connectionLimit: 15,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      }
    } catch {
      // Fall through to individual env vars
    }
  }

  return {
    host: process.env.MYSQL_HOST || "localhost",
    port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "nanotophea_db",
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  }
}

export function getPool(): Pool {
  if (!globalForMysql.__nanotopheaMysqlPool) {
    globalForMysql.__nanotopheaMysqlPool = mysql.createPool(getPoolConfig())
  }
  return globalForMysql.__nanotopheaMysqlPool
}

export async function query<T extends RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  const pool = getPool()
  const [rows] = await pool.query<T[]>(sql, params as any)
  return rows
}

export async function queryOne<T extends RowDataPacket>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

export async function execute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const pool = getPool()
  const [result] = await pool.execute<ResultSetHeader>(sql, params as any)
  return result
}

export async function transaction<T>(callback: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const pool = getPool()
  const connection = await pool.getConnection()
  await connection.beginTransaction()
  try {
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

export async function closePool(): Promise<void> {
  if (globalForMysql.__nanotopheaMysqlPool) {
    await globalForMysql.__nanotopheaMysqlPool.end()
    globalForMysql.__nanotopheaMysqlPool = undefined
  }
}
