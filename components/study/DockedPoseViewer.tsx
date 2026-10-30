"use client"

import { useEffect, useState } from "react"
import { useTheme } from "@/components/theme/ThemeProvider"

export function DockedPoseViewer({
  pdbId,
  pose,
  searchBox,
}: {
  pdbId: string
  pose: string
  searchBox?: { centerX: number; centerY: number; centerZ: number; sizeX: number; sizeY: number; sizeZ: number }
}) {
  const { theme } = useTheme()
  const [receptor, setReceptor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [proteinOn, setProteinOn] = useState(true)
  const [ligandOn, setLigandOn] = useState(true)
  const [siteOn, setSiteOn] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setReceptor(null)
    setError(null)
    void fetch(`/api/scientific/rcsb/${encodeURIComponent(pdbId)}/structure`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("RCSB structure unavailable")
        setReceptor(await response.text())
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : "RCSB structure unavailable")
      })
    return () => controller.abort()
  }, [pdbId])

  return (
    <div>
      <div className="dock-filters" role="group" aria-label="Pose visibility">
        <button type="button" data-on={proteinOn ? "true" : "false"} onClick={() => setProteinOn((value) => !value)}>Protein</button>
        <button type="button" data-on={ligandOn ? "true" : "false"} onClick={() => setLigandOn((value) => !value)}>Ligand</button>
        <button type="button" data-on={siteOn ? "true" : "false"} onClick={() => setSiteOn((value) => !value)} disabled={!searchBox}>Binding site</button>
      </div>
      {error ? <p className="phyto-missing">{error}</p> : null}
      {!receptor && !error ? <p className="dock-note">Loading receptor structure…</p> : null}
      {receptor ? (
        <iframe
          className="dock-pose"
          title="3D docked pose"
          sandbox="allow-scripts"
          srcDoc={poseHtml(receptor, pose, { proteinOn, ligandOn, siteOn, searchBox, theme })}
        />
      ) : null}
    </div>
  )
}

function poseHtml(
  receptor: string,
  pose: string,
  view: {
    proteinOn: boolean
    ligandOn: boolean
    siteOn: boolean
    theme: "light" | "dark"
    searchBox?: { centerX: number; centerY: number; centerZ: number; sizeX: number; sizeY: number; sizeZ: number }
  },
): string {
  const isLight = view.theme === "light"
  const bgHex = isLight ? "#f8fafc" : "#080f1c"
  const box = view.siteOn && view.searchBox
    ? `viewer.addBox({center:{x:${view.searchBox.centerX},y:${view.searchBox.centerY},z:${view.searchBox.centerZ}},dimensions:{w:${view.searchBox.sizeX},h:${view.searchBox.sizeY},d:${view.searchBox.sizeZ}},color:'#c2410c',opacity:0.25});`
    : ""
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>html,body,#v{margin:0;height:100%;background:${bgHex}}</style>
<script>window.OffscreenCanvas=undefined;</script>
<script src="https://3dmol.org/build/3Dmol-min.js"></script></head>
<body><div id="v"></div><script>
var viewer=$3Dmol.createViewer(document.getElementById('v'),{backgroundColor:'${bgHex}'});
viewer.addModel(${JSON.stringify(receptor)},'pdb');
if(${view.proteinOn ? "true" : "false"}) viewer.setStyle({model:0},{cartoon:{color:'spectrum'}});
else viewer.setStyle({model:0},{});
viewer.addModel(${JSON.stringify(pose)},'pdbqt');
if(${view.ligandOn ? "true" : "false"}) viewer.setStyle({model:1},{stick:{radius:0.15,colorscheme:'greenCarbon'}});
else viewer.setStyle({model:1},{});
${box}
viewer.zoomTo();
viewer.render();
</script></body></html>`
}
