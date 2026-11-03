import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import https from "node:https"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { setupAdmeEnvironment } from "./setup-adme.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const isWin = process.platform === "win32"

const VINA_VERSION = "1.2.7"
const VINA_URL = "https://github.com/forlilab/AutoDock-Vina/releases/download/v1.2.7/vina_1.2.7_win.exe"
const VINA_EXPECTED_SHA256 = "e0c4b2715e0c1a74f6e92d0f3be0328ac97542eafbc111e6b1efad897a73cce5"

function logOk(msg) {
  console.log(`  \x1b[32m[OK]\x1b[0m ${msg}`)
}

function logInfo(msg) {
  console.log(`  \x1b[90m[..]\x1b[0m ${msg}`)
}

function logWarn(msg) {
  console.log(`  \x1b[33m[WARN]\x1b[0m ${msg}`)
}

function logFail(msg, help = "") {
  console.error(`\n  \x1b[31m[ERROR] ${msg}\x1b[0m`)
  if (help) {
    console.error(`  \x1b[97mGUIDANCE: ${help}\x1b[0m\n`)
  }
}

function printHeader(title) {
  console.log("")
  console.log("\x1b[36m===============================================================================\x1b[0m")
  console.log(`\x1b[36m  ${title}\x1b[0m`)
  console.log("\x1b[36m===============================================================================\x1b[0m")
  console.log("")
}

function printStep(num, title) {
  console.log("")
  console.log(`\x1b[33m[${num}] ${title}\x1b[0m`)
  console.log("\x1b[90m-------------------------------------------------------------------------------\x1b[0m")
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fsCreateStream(destPath)
    https
      .get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.destroy()
          downloadFile(response.headers.location, destPath).then(resolve).catch(reject)
          return
        }
        if (response.statusCode !== 200) {
          file.destroy()
          reject(new Error(`Download failed with HTTP ${response.statusCode}`))
          return
        }
        response.pipe(file)
        file.on("finish", () => {
          file.close(resolve)
        })
      })
      .on("error", (err) => {
        file.destroy()
        reject(err)
      })
  })
}

function fsCreateStream(dest) {
  const fs = require("node:fs")
  return fs.createWriteStream(dest)
}

function computeSha256(filePath) {
  const buffer = readFileSync(filePath)
  return createHash("sha256").update(buffer).digest("hex").toLowerCase()
}

// -----------------------------------------------------------------------------
// MAIN SETUP
// -----------------------------------------------------------------------------
async function main() {
  printHeader("NANO-HEPATOTEA: Cross-Device Environment Setup")

  // =============================================================================
  // [1/7] Node.js & npm
  // =============================================================================
  printStep("1/7", "Verifying Node.js & npm Runtime")
  const nodeVer = process.version
  const nodeMajor = parseInt(nodeVer.replace(/^v/, "").split(".")[0], 10)
  if (nodeMajor < 18) {
    logFail(`Node.js ${nodeVer} is too old. NANO-HEPATOTEA requires Node.js v18 or newer.`, "Download and install from https://nodejs.org/")
    process.exit(1)
  }
  logOk(`Node.js runtime: ${nodeVer}`)

  const npmCmd = isWin ? "npm.cmd" : "npm"
  const npxCmd = isWin ? "npx.cmd" : "npx"
  const npmRes = spawnSync(npmCmd, ["-v"], { encoding: "utf8", windowsHide: true, shell: isWin })
  if (npmRes.status !== 0) {
    logFail("npm is not installed or not in PATH.", "Reinstall Node.js with npm included.")
    process.exit(1)
  }
  logOk(`npm package manager: v${(npmRes.stdout || "").trim()}`)

  // =============================================================================
  // [2/7] Environment Configuration (.env.local)
  // =============================================================================
  printStep("2/7", "Checking Environment Configuration (.env.local)")
  const envFile = path.join(root, ".env.local")
  const artifactsDir = path.join(root, ".docking-artifacts")
  if (!existsSync(artifactsDir)) {
    mkdirSync(artifactsDir, { recursive: true })
    logOk("Created docking artifacts directory: .docking-artifacts")
  } else {
    logOk("Docking artifacts directory verified: .docking-artifacts")
  }

  if (!existsSync(envFile)) {
    logInfo(".env.local does not exist. Creating default template from .env.example...")
    const exampleFile = path.join(root, ".env.example")
    let template = ""
    if (existsSync(exampleFile)) {
      template = readFileSync(exampleFile, "utf8")
    } else {
      template = `# Database Configuration (XAMPP MySQL/MariaDB)\nMYSQL_HOST=localhost\nMYSQL_PORT=3306\nMYSQL_USER=root\nMYSQL_PASSWORD=\nMYSQL_DATABASE=nanotophea_db\nDATABASE_URL=mysql://root:@localhost:3306/nanotophea_db\n\n# Seed Admin Credentials\nNANOTOPHEA_ADMIN_EMAIL=admin@demo.com\nNANOTOPHEA_ADMIN_PASSWORD=admin123\n\nTOGETHER_API_KEY=\n\n# Local AutoDock Vina worker (defaults to project-relative paths)\n# VINA_BIN=tools/vina/vina.exe\n# DOCKING_PYTHON=.adme-venv/Scripts/python.exe\n# DOCKING_ARTIFACT_DIR=.docking-artifacts\n\n# Hosted ADMET-AI service (optional)\nADMET_API_URL=http://127.0.0.1:8000\n`
    }
    writeFileSync(envFile, template, "utf8")
    logOk("Created .env.local with safe default configuration.")
  } else {
    logOk(".env.local exists (existing secrets preserved intact).")
  }

  // =============================================================================
  // [3/7] Node Dependencies (node_modules)
  // =============================================================================
  printStep("3/7", "Checking Node.js Dependencies")
  const nodeModulesDir = path.join(root, "node_modules")
  const packageLock = path.join(root, "package-lock.json")
  let needsInstall = false

  if (!existsSync(nodeModulesDir)) {
    needsInstall = true
    logInfo("node_modules folder not found. Running npm install...")
  } else if (existsSync(packageLock)) {
    const lockTime = statSync(packageLock).mtimeMs
    const modulesTime = statSync(nodeModulesDir).mtimeMs
    if (lockTime > modulesTime) {
      needsInstall = true
      logInfo("package-lock.json is newer than node_modules. Updating dependencies...")
    }
  }

  if (needsInstall) {
    const iRes = spawnSync(npmCmd, ["install"], { cwd: root, stdio: "inherit", windowsHide: true, shell: isWin })
    if (iRes.status !== 0) {
      logFail("npm install failed.", "Check package.json and network connectivity.")
      process.exit(1)
    }
    logOk("Dependencies installed successfully.")
  } else {
    logOk("Node.js dependencies already up to date.")
  }

  // =============================================================================
  // [4/7] Database Connection & Migrations
  // =============================================================================
  printStep("4/7", "Verifying Database Connection & Running Migrations")
  logInfo("Ensuring database server is ready and 'nanotophea_db' exists...")
  const ensureDbRes = spawnSync(npxCmd, ["tsx", "scripts/ensure-db.ts"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    shell: isWin,
  })

  if (ensureDbRes.status !== 0) {
    // If on Windows and MySQL is not running, check if XAMPP exists
    const xamppBat = existsSync("C:\\xamppp\\mysql_start.bat")
      ? "C:\\xamppp\\mysql_start.bat"
      : existsSync("C:\\xampp\\mysql_start.bat")
        ? "C:\\xampp\\mysql_start.bat"
        : null
    if (isWin && xamppBat) {
      logInfo("Starting local XAMPP MySQL service...")
      spawn("cmd.exe", ["/c", xamppBat], { detached: true, stdio: "ignore", windowsHide: true }).unref()
      // Give MySQL a few seconds to initialize
      await new Promise((r) => setTimeout(r, 3000))
    }
    // Retry ensure-db
    const retryRes = spawnSync(npxCmd, ["tsx", "scripts/ensure-db.ts"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      shell: isWin,
    })
    if (retryRes.status !== 0) {
      logFail("Failed to connect to MySQL server.", "Ensure MySQL is running in XAMPP Control Panel on port 3306.")
      process.exit(1)
    }
  }
  logOk("MySQL connected and 'nanotophea_db' database is ready.")

  logInfo("Applying pending database migrations (npm run db:migrate)...")
  const migRes = spawnSync(npmCmd, ["run", "db:migrate"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    shell: isWin,
  })

  for (const line of (migRes.stdout || "").split(/\r?\n/)) {
    const t = line.trim()
    if (t.startsWith("[OK]")) logOk(t.substring(4).trim())
    else if (t.startsWith("[..]")) logInfo(t.substring(4).trim())
    else if (t.startsWith("[ERROR]")) console.error(`  \x1b[31m${t}\x1b[0m`)
  }

  if (migRes.status !== 0) {
    logFail("Database migration failed.", "Check SQL error message above.")
    process.exit(1)
  }

  // Check research records count to preserve intact
  const countRes = spawnSync(npxCmd, ["tsx", "scripts/check-studies-count.ts"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    shell: isWin,
  })
  const countMatch = (countRes.stdout || "").match(/STUDIES_COUNT:(\d+)/)
  const studiesCount = countMatch ? parseInt(countMatch[1], 10) : 0
  if (studiesCount > 0) {
    logOk(`Existing research data detected (${studiesCount} active studies preserved intact).`)
  } else {
    logInfo("Fresh installation detected: database schema initialized with 0 studies.")
    logInfo("Optional: To import research records from an exported backup, run: mysql -u root nanotophea_db < backup.sql")
    logInfo("To seed the default demo admin user, run: npm run seed:admin")
  }

  // =============================================================================
  // [5/7] Python Scientific Environment (.adme-venv)
  // =============================================================================
  printStep("5/7", "Verifying Python Scientific Environment (.adme-venv)")
  const admeOk = await setupAdmeEnvironment()
  if (!admeOk) {
    logFail("Failed to configure Python scientific environment.", "Ensure Python 3.11 is installed.")
    process.exit(1)
  }

  // =============================================================================
  // [6/7] AutoDock Vina & Docking Toolchain
  // =============================================================================
  printStep("6/7", "Verifying AutoDock Vina & Molecular Docking Toolchain")
  const vinaDir = path.join(root, "tools", "vina")
  const vinaBin = path.join(vinaDir, isWin ? "vina.exe" : "vina")

  if (!existsSync(vinaBin)) {
    logInfo(`AutoDock Vina binary not found. Downloading official release (v${VINA_VERSION})...`)
    if (!existsSync(vinaDir)) mkdirSync(vinaDir, { recursive: true })

    const tempVina = path.join(vinaDir, `vina_temp_${Date.now()}.exe`)
    try {
      // Use curl if available for fast HTTPS download with progress
      const curlRes = spawnSync("curl.exe", ["-s", "-L", "-o", tempVina, VINA_URL], { windowsHide: true })
      if (curlRes.status !== 0 || !existsSync(tempVina)) {
        await downloadFile(VINA_URL, tempVina)
      }

      logInfo("Verifying AutoDock Vina SHA-256 checksum...")
      const downloadedHash = computeSha256(tempVina)
      if (downloadedHash !== VINA_EXPECTED_SHA256) {
        rmSync(tempVina, { force: true })
        logFail(`Checksum mismatch for AutoDock Vina binary! Expected: ${VINA_EXPECTED_SHA256}, Got: ${downloadedHash}`, "Refusing installation of unverified binary.")
        process.exit(1)
      }

      renameSync(tempVina, vinaBin)
      logOk(`AutoDock Vina binary verified and installed to: tools/vina/vina.exe`)
    } catch (err) {
      if (existsSync(tempVina)) rmSync(tempVina, { force: true })
      logFail(`Failed to download AutoDock Vina: ${err.message}`, "Download manually from https://github.com/forlilab/AutoDock-Vina/releases and place at tools/vina/vina.exe")
      process.exit(1)
    }
  }

  // Verify Vina execution
  const vVerRes = spawnSync(vinaBin, ["--version"], { encoding: "utf8", windowsHide: true })
  const vVer = (vVerRes.stdout || vVerRes.stderr || "").trim()
  if (vVerRes.status === 0 && vVer.toLowerCase().includes("vina")) {
    logOk(`AutoDock Vina ready: ${vVer} (${vinaBin})`)
  } else {
    logFail(`Vina binary exists at ${vinaBin} but failed to execute --version.`)
    process.exit(1)
  }

  // =============================================================================
  // [7/7] Final Verification (Real ADME + Real Docking Tests)
  // =============================================================================
  printStep("7/7", "Executing Real Scientific Integration Tests")

  logInfo("Running real AutoDock Vina docking integration test...")
  const dockTest = spawnSync(process.execPath, ["scripts/verify-docking.mjs"], { cwd: root, encoding: "utf8", windowsHide: true })
  for (const line of (dockTest.stdout || "").split(/\r?\n/)) {
    if (line.includes("PASS")) console.log(`  ${line.trim()}`)
  }
  if (dockTest.status !== 0) {
    logFail("Molecular docking integration test failed.")
    console.error(dockTest.stdout || dockTest.stderr)
    process.exit(1)
  }
  logOk("Real molecular docking pipeline verified (Ligand Prep, Receptor Prep, Vina, Affinity Parsing: ALL PASS).")

  logInfo("Running real ADMET-AI property calculation test...")
  const admeTest = spawnSync(process.execPath, ["scripts/verify-adme.mjs"], { cwd: root, encoding: "utf8", windowsHide: true })
  if (admeTest.status !== 0) {
    logFail("Real ADMET property calculation test failed.")
    console.error(admeTest.stdout || admeTest.stderr)
    process.exit(1)
  }
  logOk("Real ADME calculation pipeline verified (Chemprop & Therapeutics Data Commons model active).")

  // =============================================================================
  // COMPLETION SUMMARY
  // =============================================================================
  console.log("")
  console.log("\x1b[32m===============================================================================\x1b[0m")
  console.log("\x1b[32m                       NANO-HEPATOTEA SETUP COMPLETE\x1b[0m")
  console.log("\x1b[32m===============================================================================\x1b[0m")
  console.log("")
  console.log("  Node.js ........... \x1b[32m✓\x1b[0m")
  console.log("  Database .......... \x1b[32m✓\x1b[0m")
  console.log("  Python ............ \x1b[32m✓\x1b[0m")
  console.log("  RDKit ............. \x1b[32m✓\x1b[0m")
  console.log("  ADME Engine ....... \x1b[32m✓\x1b[0m")
  console.log("  AutoDock Vina ..... \x1b[32m✓\x1b[0m")
  console.log("  Docking Engine .... \x1b[32m✓\x1b[0m")
  console.log("")
  console.log("Start NANO-HEPATOTEA:")
  console.log("")
  console.log("    \x1b[36mnpm run dev:share\x1b[0m")
  console.log("")
  console.log("\x1b[32m===============================================================================\x1b[0m")
  console.log("")
  process.exit(0)
}

main().catch((err) => {
  logFail(`Unexpected setup failure: ${err.message}`)
  console.error(err.stack)
  process.exit(1)
})
