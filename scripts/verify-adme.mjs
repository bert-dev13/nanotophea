import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const isWin = process.platform === "win32"
const python = isWin
  ? path.join(root, ".adme-venv", "Scripts", "python.exe")
  : path.join(root, ".adme-venv", "bin", "python")

console.log("=======================================================")
console.log("          HEPATOTEA REAL LOCAL ADME INTEGRATION TEST")
console.log("=======================================================\n")

if (!existsSync(python)) {
  console.error("  [FAIL] Python environment not found at .adme-venv. Run setup first.")
  process.exit(1)
}

console.log("  [..] Executing real ADMET-AI model prediction on test compound (Aspirin)...")
const testPyScript = `
import json, sys
try:
    from admet_ai import ADMETModel
    model = ADMETModel()
    preds = model.predict(smiles="CC(=O)OC1=CC=CC=C1C(=O)O")
    
    # Flatten if needed
    if hasattr(preds, "to_dict"):
        data = preds.to_dict()
    elif isinstance(preds, dict):
        data = preds
    else:
        data = {}

    keys = list(data.keys())
    if len(keys) < 10:
        print(json.dumps({"ok": False, "error": f"Insufficient descriptors returned: {len(keys)}"}))
        sys.exit(1)

    # Sample a few core descriptors
    sample = {k: data[k] for k in keys[:5]}
    print(json.dumps({"ok": True, "count": len(keys), "sample": sample}))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
    sys.exit(1)
`

const res = spawnSync(python, ["-c", testPyScript], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
})

let parsed = null
for (const line of (res.stdout || "").split(/\r?\n/)) {
  try {
    const obj = JSON.parse(line.trim())
    if (obj && typeof obj.ok === "boolean") {
      parsed = obj
      break
    }
  } catch {}
}

if (res.status === 0 && parsed && parsed.ok) {
  console.log(`  \x1b[32m[OK]\x1b[0m Real ADMET-AI predictions verified (${parsed.count} scientific endpoints generated).`)
  console.log(`  \x1b[32m[OK]\x1b[0m ADME Pipeline: PASS (No mock data, real Chemprop model active)\n`)
  process.exit(0)
} else {
  console.error(`  \x1b[31m[FAIL]\x1b[0m Real ADME prediction test failed.`)
  if (parsed?.error) console.error(`  Detail: ${parsed.error}`)
  if (res.stderr) console.error(`  Stderr: ${res.stderr}`)
  process.exit(1)
}

