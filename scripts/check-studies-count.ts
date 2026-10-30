import fs from "fs"
import path from "path"
import mysql from "mysql2/promise"

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

async function main() {
  const host = process.env.MYSQL_HOST || "localhost"
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306
  const user = process.env.MYSQL_USER || "root"
  const password = process.env.MYSQL_PASSWORD ?? ""
  const database = process.env.MYSQL_DATABASE || "nanotophea_db"

  try {
    const conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    })
    try {
      const [rows]: any = await conn.query("SELECT COUNT(*) AS c FROM `studies`")
      console.log("STUDIES_COUNT:" + (rows[0]?.c || 0))
    } finally {
      await conn.end()
    }
  } catch {
    console.log("STUDIES_COUNT:0")
  }
}

main()
