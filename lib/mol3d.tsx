"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { ExternalLink } from "lucide-react"

// ── HTML builders ──────────────────────────────────────────────────────────────
// Molecules are loaded into 3Dmol.js running inside a srcdoc iframe.
// • window.OffscreenCanvas = undefined  →  forces 3Dmol to use a regular canvas,
//   preventing the "bitmap.close" crash that occurs when OffscreenCanvas is broken
//   in the sandbox environment.
// • Data (SDF / PDB text) is fetched in React (CORS OK for both APIs),
//   JSON-stringified, then embedded directly in the HTML — no CDN calls for data.
// • 3Dmol.js itself is loaded from the CDN once per iframe context.

function buildMolHTML(
  modelData: string,
  fmt: "sdf" | "pdb",
  bg: string,
  style: "ballstick" | "cartoon" | "surface",
  spinSpeed: number,
  accentColor: string,
): string {
  const styleCmd =
    style === "cartoon"
      ? `viewer.setStyle({},{ cartoon:{ color:'spectrum' } });
         viewer.setStyle({hetflag:true},{ stick:{ radius:0.12, colorscheme:'Jmol' }, sphere:{ scale:0.22, colorscheme:'Jmol' } });`
      : style === "surface"
      ? `viewer.setStyle({},{ surface:{ opacity:0.85, colorscheme:'ssJmol' }, cartoon:{ color:'spectrum' } });`
      : `viewer.setStyle({},{ stick:{ radius:0.14, colorscheme:'Jmol' }, sphere:{ scale:0.28, colorscheme:'Jmol' } });`

  const dataJs = JSON.stringify(modelData)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:${bg};overflow:hidden}
  canvas{display:block}
  #load{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;
        justify-content:center;gap:10px;color:#546e8a;font:12px/1.5 system-ui,sans-serif;
        pointer-events:none;z-index:9}
  .ring{width:28px;height:28px;border-radius:50%;border:3px solid #dde5ef;
        border-top-color:${accentColor};animation:sp 0.7s linear infinite}
  @keyframes sp{to{transform:rotate(360deg)}}
</style>
<script>window.OffscreenCanvas=undefined;</script>
<script src="https://3dmol.org/build/3Dmol-min.js"></script>
</head>
<body>
<div id="v" style="width:100vw;height:100vh;position:relative;"></div>
<div id="load"><div class="ring"></div>Loading…</div>
<script>
(function(){
  var data=${dataJs};
  var viewer=$3Dmol.createViewer(document.getElementById('v'),{
    backgroundColor:'${bg}',antialias:true
  });
  viewer.addModel(data,'${fmt}');
  ${styleCmd}
  viewer.zoomTo();
  viewer.spin('y',${spinSpeed});
  viewer.render();
  document.getElementById('load').style.display='none';
})();
</script>
</body>
</html>`
}

// ── Data fetchers ──────────────────────────────────────────────────────────────

async function fetchSDF(cid: number): Promise<string> {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/CID/${cid}/SDF?record_type=3d`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`PubChem ${r.status}`)
  return r.text()
}

async function fetchPDB(pdbId: string): Promise<string> {
  const url = `https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`RCSB ${r.status}`)
  return r.text()
}

// ── Fallback static image (PubChem PNG) ───────────────────────────────────────

function PubChemImage({ cid, height, name }: { cid: number; height: number; name: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="w-full h-full flex items-center justify-center relative"
      style={{ background: "#f0faf7" }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#dde5ef", borderTopColor: "#00a882" }} />
        </div>
      )}
      <Image
        src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/CID/${cid}/PNG?record_type=3d&image_size=${height}x${height}`}
        alt={`${name} 3D`}
        width={height}
        height={height}
        unoptimized
        onLoad={() => setLoaded(true)}
        style={{ maxHeight: height - 8, maxWidth: "90%", objectFit: "contain", display: loaded ? "block" : "none" }}
      />
    </div>
  )
}

// ── State machine for the viewer ──────────────────────────────────────────────

type ViewState = "idle" | "loading" | "ready" | "error"

function use3DViewer(fetcher: () => Promise<string>) {
  const [state, setState] = useState<ViewState>("idle")
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState("loading")
    setHtml(null)
    fetcher()
      .then(data => {
        if (cancelled) return
        setState("ready")
        return data
      })
      .then(data => { if (data) setHtml(data) })
      .catch(() => { if (!cancelled) setState("error") })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { state, html }
}

// ── Compound 3D viewer ─────────────────────────────────────────────────────────

export function CompoundViewer3D({
  cid,
  name,
  height = 320,
  color = "#00d4aa",
}: {
  cid: number
  name: string
  height?: number
  color?: string
}) {
  const [mode, setMode] = useState<"3d" | "2d">("3d")
  const [srcdoc, setSrcdoc] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setSrcdoc(null)
    fetchSDF(cid)
      .then(sdf => {
        if (cancelled) return
        const html = buildMolHTML(sdf, "sdf", "#f0faf7", "ballstick", 1, color)
        setSrcdoc(html)
        setStatus("ready")
      })
      .catch(() => { if (!cancelled) setStatus("error") })
    return () => { cancelled = true }
  }, [cid, color])

  const bodyH = height - 40

  return (
    <div className="relative rounded-2xl overflow-hidden border flex flex-col"
      style={{ height, borderColor: "#dde5ef", background: "#f0faf7" }}>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: "#dde5ef", background: "#ffffffdd" }}>
        <div className="flex items-center gap-1.5">
          {(["3d", "2d"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wide transition-all"
              style={{
                borderColor: mode === m ? color : "#dde5ef",
                color: mode === m ? color : "#546e8a",
                background: mode === m ? color + "1a" : "transparent",
              }}>
              {m}
            </button>
          ))}
          {mode === "3d" && status === "ready" && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full animate-pulse"
              style={{ background: "#00a88215", color: "#00a882", border: "1px solid #00a88235" }}>
              ● Live 3D · Draggable
            </span>
          )}
        </div>
        <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=3D-Conformer`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-medium"
          style={{ color: "#2196d3" }}>
          PubChem ↗ <ExternalLink size={10} />
        </a>
      </div>

      {/* Body */}
      <div className="flex-1 relative overflow-hidden" style={{ height: bodyH }}>
        {mode === "3d" ? (
          <>
            {status === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                style={{ background: "#f0faf7" }}>
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "#dde5ef", borderTopColor: color }} />
                <span className="text-xs font-mono" style={{ color: "#546e8a" }}>
                  Fetching 3D model from PubChem…
                </span>
              </div>
            )}
            {status === "error" && (
              <PubChemImage cid={cid} height={bodyH} name={name} />
            )}
            {status === "ready" && srcdoc && (
              <iframe
                srcDoc={srcdoc}
                sandbox="allow-scripts"
                style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                title={`${name} 3D model`}
              />
            )}
          </>
        ) : (
          <PubChemImage cid={cid} height={bodyH} name={name} />
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-1 flex justify-between items-center border-t"
        style={{ background: "#f4f7fcee", borderColor: "#dde5ef" }}>
        <span className="text-[10px] font-mono" style={{ color: "#546e8a" }}>
          PubChem CID {cid} · {mode === "3d" ? "PubChem 3D Conformer · 3Dmol.js" : "2D depiction"}
        </span>
        {mode === "3d" && status === "ready" && (
          <span className="text-[10px] font-mono" style={{ color: "#8098b4" }}>
            Drag to rotate · Scroll to zoom
          </span>
        )}
      </div>
    </div>
  )
}

// ── Docking viewer (protein + compound split) ──────────────────────────────────
// Phase 5: Prefer ProteinViewer3D for receptor-only display.
// Do not use DockingViewer3D to imply a docked complex or show decorative ΔG
// unless real pose/complex files are integrated later.

export function DockingViewer3D({
  pdbId,
  cid,
  proteinName,
  compoundName,
  proteinColor = "#4fc3f7",
  compoundColor = "#00d4aa",
  height = 420,
  deltaG,
  hBonds,
}: {
  pdbId: string
  cid: number
  proteinName: string
  compoundName: string
  proteinColor?: string
  compoundColor?: string
  height?: number
  deltaG?: number
  hBonds?: number
}) {
  const [proteinSrcdoc, setProteinSrcdoc] = useState<string | null>(null)
  const [proteinStatus, setProteinStatus] = useState<"loading" | "ready" | "error">("loading")
  const [compoundSrcdoc, setCompoundSrcdoc] = useState<string | null>(null)
  const [compoundStatus, setCompoundStatus] = useState<"loading" | "ready" | "error">("loading")
  const [compoundMode, setCompoundMode] = useState<"3d" | "2d">("3d")

  useEffect(() => {
    let cancelled = false
    setProteinStatus("loading")
    setProteinSrcdoc(null)
    fetchPDB(pdbId)
      .then(pdb => {
        if (cancelled) return
        const html = buildMolHTML(pdb, "pdb", "#eef4ff", "cartoon", 0.5, proteinColor)
        setProteinSrcdoc(html)
        setProteinStatus("ready")
      })
      .catch(() => { if (!cancelled) setProteinStatus("error") })
    return () => { cancelled = true }
  }, [pdbId, proteinColor])

  useEffect(() => {
    let cancelled = false
    setCompoundStatus("loading")
    setCompoundSrcdoc(null)
    fetchSDF(cid)
      .then(sdf => {
        if (cancelled) return
        const html = buildMolHTML(sdf, "sdf", "#f0faf7", "ballstick", 1, compoundColor)
        setCompoundSrcdoc(html)
        setCompoundStatus("ready")
      })
      .catch(() => { if (!cancelled) setCompoundStatus("error") })
    return () => { cancelled = true }
  }, [cid, compoundColor])

  const bodyH = height - 76

  return (
    <div className="rounded-2xl border overflow-hidden shadow-sm"
      style={{ background: "#ffffff", borderColor: "#dde5ef" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: "#dde5ef", background: "linear-gradient(90deg,#f0faf7 0%,#f4f8ff 100%)" }}>
        <div className="flex items-center gap-2.5 text-sm font-mono flex-wrap">
          <span className="font-bold" style={{ color: proteinColor }}>◉ {proteinName}</span>
          <span className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ background: proteinColor + "18", color: proteinColor }}>PDB {pdbId}</span>
          <span style={{ color: "#546e8a" }}>⟷</span>
          <span className="font-bold" style={{ color: compoundColor }}>⬡ {compoundName}</span>
          <span className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ background: compoundColor + "18", color: compoundColor }}>CID {cid}</span>
        </div>
        {deltaG !== undefined && (
          <div className="flex items-center gap-3 text-xs font-mono shrink-0">
            <span className="font-bold" style={{ color: "#34d399" }}>ΔG {deltaG} kcal/mol</span>
            {hBonds !== undefined && <span style={{ color: "#546e8a" }}>H-bonds: {hBonds}</span>}
          </div>
        )}
      </div>

      {/* Split panels */}
      <div className="flex" style={{ height: bodyH }}>

        {/* ── LEFT: Protein (actual 3Dmol.js from RCSB PDB) ── */}
        <div className="flex-[3] flex flex-col border-r" style={{ borderColor: "#dde5ef" }}>
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b shrink-0"
            style={{ borderColor: "#dde5ef", background: "#f8fafc" }}>
            <span className="text-[11px] font-bold" style={{ color: proteinColor }}>
              Protein · {proteinName} · Cartoon ribbon
            </span>
            {proteinStatus === "ready" && (
              <span className="text-[10px] font-mono" style={{ color: "#8098b4" }}>Drag · Scroll</span>
            )}
            <a href={`https://www.rcsb.org/structure/${pdbId}`}
              target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-mono flex items-center gap-0.5" style={{ color: "#4fc3f7" }}>
              RCSB ↗ <ExternalLink size={8} />
            </a>
          </div>

          <div className="flex-1 relative" style={{ background: "#eef4ff" }}>
            {proteinStatus === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "#dde5ef", borderTopColor: proteinColor }} />
                <span className="text-xs font-mono" style={{ color: "#546e8a" }}>
                  Loading PDB {pdbId}…
                </span>
              </div>
            )}
            {proteinStatus === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <span className="text-xs" style={{ color: "#fb923c" }}>Could not load PDB</span>
                <a href={`https://www.rcsb.org/structure/${pdbId}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium" style={{ color: "#4fc3f7" }}>
                  View on RCSB ↗
                </a>
              </div>
            )}
            {proteinStatus === "ready" && proteinSrcdoc && (
              <iframe
                srcDoc={proteinSrcdoc}
                sandbox="allow-scripts"
                style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                title={`${proteinName} protein structure`}
              />
            )}
          </div>

          <div className="px-2.5 py-1 border-t shrink-0" style={{ borderColor: "#dde5ef", background: "#f8fafc" }}>
            <span className="text-[10px] font-mono" style={{ color: "#546e8a" }}>
              RCSB PDB {pdbId} · 3Dmol.js · Cartoon + Heteroatom sticks
            </span>
          </div>
        </div>

        {/* ── RIGHT: Compound (actual 3Dmol.js from PubChem SDF) ── */}
        <div className="flex-[2] flex flex-col" style={{ background: "#f0faf7" }}>
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b shrink-0"
            style={{ borderColor: "#dde5ef", background: "#f8fafc" }}>
            <div className="flex items-center gap-1">
              {(["3d", "2d"] as const).map(m => (
                <button key={m} onClick={() => setCompoundMode(m)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase"
                  style={{
                    borderColor: compoundMode === m ? compoundColor : "#dde5ef",
                    color: compoundMode === m ? compoundColor : "#546e8a",
                    background: compoundMode === m ? compoundColor + "18" : "transparent",
                  }}>
                  {m}
                </button>
              ))}
            </div>
            <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`}
              target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-mono flex items-center gap-0.5" style={{ color: "#2196d3" }}>
              PubChem ↗ <ExternalLink size={8} />
            </a>
          </div>

          <div className="flex-1 relative">
            {compoundMode === "3d" ? (
              <>
                {compoundStatus === "loading" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "#dde5ef", borderTopColor: compoundColor }} />
                    <span className="text-[10px] font-mono" style={{ color: "#546e8a" }}>
                      Fetching SDF…
                    </span>
                  </div>
                )}
                {compoundStatus === "error" && (
                  <PubChemImage cid={cid} height={bodyH - 56} name={compoundName} />
                )}
                {compoundStatus === "ready" && compoundSrcdoc && (
                  <iframe
                    srcDoc={compoundSrcdoc}
                    sandbox="allow-scripts"
                    style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                    title={`${compoundName} 3D model`}
                  />
                )}
              </>
            ) : (
              <PubChemImage cid={cid} height={bodyH - 56} name={compoundName} />
            )}
          </div>

          <div className="px-2.5 py-1 border-t shrink-0" style={{ borderColor: "#dde5ef", background: "#f8fafc" }}>
            <span className="text-[10px] font-mono" style={{ color: "#546e8a" }}>
              PubChem CID {cid} · {compoundMode === "3d" ? "3D Conformer SDF · 3Dmol.js" : "2D structure"}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t flex items-center justify-between gap-4"
        style={{ borderColor: "#dde5ef", background: "#f8fafc" }}>
        <span className="text-[10px] font-mono" style={{ color: "#546e8a" }}>
          <span style={{ color: proteinColor }}>{proteinName}</span> from RCSB PDB ·{" "}
          <span style={{ color: compoundColor }}>{compoundName}</span> from PubChem 3D · structure preview only
        </span>
        <span className="text-[10px] font-mono" style={{ color: "#8098b4" }}>
          Drag to rotate · Scroll to zoom
        </span>
      </div>
    </div>
  )
}

/** Protein-only 3D viewer (REFERENCE visualization — not a docking result) */
export function ProteinViewer3D({
  pdbId,
  name,
  height = 320,
  color = "#4fc3f7",
}: {
  pdbId: string
  name: string
  height?: number
  color?: string
}) {
  const [srcdoc, setSrcdoc] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setSrcdoc(null)
    fetchPDB(pdbId)
      .then((pdb) => {
        if (cancelled) return
        setSrcdoc(buildMolHTML(pdb, "pdb", "#eef4ff", "cartoon", 0.5, color))
        setStatus("ready")
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [pdbId, color])

  return (
    <div
      className="relative rounded-2xl overflow-hidden border flex flex-col"
      style={{ height, borderColor: "#dde5ef", background: "#eef4ff" }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: "#dde5ef", background: "#ffffffdd" }}
      >
        <span className="text-[11px] font-bold" style={{ color }}>
          {name} · PDB {pdbId}
        </span>
        <a
          href={`https://www.rcsb.org/structure/${pdbId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-medium"
          style={{ color: "#2196d3" }}
        >
          RCSB ↗
        </a>
      </div>
      <div className="flex-1 relative">
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-mono" style={{ color: "#546e8a" }}>
            Loading PDB…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-mono" style={{ color: "#b45309" }}>
            Could not load structure
          </div>
        )}
        {status === "ready" && srcdoc && (
          <iframe
            srcDoc={srcdoc}
            sandbox="allow-scripts"
            style={{ width: "100%", height: "100%", border: "none" }}
            title={`${name} PDB ${pdbId}`}
          />
        )}
      </div>
    </div>
  )
}
