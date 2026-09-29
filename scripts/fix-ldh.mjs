import fs from "node:fs"

const path = "components/panels/LDHPanel.tsx"
let c = fs.readFileSync(path, "utf8")
if (c.includes("React.ElementType") && !c.includes('import React')) {
  c = c.replace('"use client"\n\n', '"use client"\n\nimport React from "react"\n')
  fs.writeFileSync(path, c)
  console.log("added React import to LDHPanel")
} else {
  console.log("LDHPanel ok")
}
