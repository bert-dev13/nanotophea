"use client"

import { useState, useEffect } from "react"
import { ExternalLink } from "lucide-react"
import { useTheme } from "@/components/theme/ThemeProvider"
import { loadPubChemImageUrl, peekPubChemImageUrl, loadPubChemStructure } from "@/lib/scientific/pubchemClientCache"

// ── HTML builders ──────────────────────────────────────────────────────────────
// Molecules are loaded into 3Dmol.js running inside a srcdoc iframe.
// • window.OffscreenCanvas = undefined  →  forces 3Dmol to use a regular canvas,
//   preventing the "bitmap.close" crash that occurs when OffscreenCanvas is broken
//   in the sandbox environment.
// • Data (SDF / PDB text) is fetched in React (CORS OK for both APIs),
//   JSON-stringified, then embedded directly in the HTML — no CDN calls for data.
// • 3Dmol.js itself is loaded from the CDN once per iframe context.

function overlayScript(overlay?: {
  searchBox?: { centerX: number; centerY: number; centerZ: number; sizeX: number; sizeY: number; sizeZ: number }
  chain?: string
}): string {
  const chain = overlay?.chain && /^[A-Za-z0-9]$/.test(overlay.chain) ? overlay.chain : ""
  const box = overlay?.searchBox
  const numbers = box ? [box.centerX, box.centerY, box.centerZ, box.sizeX, box.sizeY, box.sizeZ] : []
  const boxScript = numbers.length === 6 && numbers.every((value) => Number.isFinite(value))
    ? `viewer.addBox({center:{x:${numbers[0]},y:${numbers[1]},z:${numbers[2]}},dimensions:{w:${numbers[3]},h:${numbers[4]},d:${numbers[5]}},color:'#c2410c',opacity:0.25});`
    : ""
  const chainScript = chain
    ? `viewer.setStyle({chain:'${chain}'},{stick:{radius:0.18,colorscheme:'greenCarbon'}});`
    : ""
  return `${chainScript}${boxScript}`
}

function buildMolHTML(
  modelData: string,
  fmt: "sdf" | "pdb",
  bg: string,
  style: "ballstick" | "cartoon" | "surface",
  spinSpeed: number,
  accentColor: string,
  overlay?: {
    searchBox?: { centerX: number; centerY: number; centerZ: number; sizeX: number; sizeY: number; sizeZ: number }
    chain?: string
  },
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
  ${overlayScript(overlay)}
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

async function fetchSDF(cid: number): Promise<{ sdf: string; conformer: "3d" | "2d" }> {
  return loadPubChemStructure(cid)
}

async function fetchPDB(pdbId: string): Promise<string> {
  const r = await fetch(`/api/scientific/rcsb/${encodeURIComponent(pdbId)}/structure`)
  if (!r.ok) throw new Error("unavailable")
  const pdb = await r.text()
  if (!pdb.includes("ATOM") && !pdb.includes("HETATM")) throw new Error("unavailable")
  return pdb
}

// ── Fallback static image (PubChem PNG) ───────────────────────────────────────

function StructureUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
      <p className="text-xs" style={{ color: "#3d5166" }}>Scientific data temporarily unavailable.</p>
      <button type="button" className="phyto-retry" onClick={onRetry}>Retry</button>
    </div>
  )
}

function PubChemImage({ cid, height, name }: { cid: number; height: number; name: string }) {
  const [src, setSrc] = useState<string | null>(() => peekPubChemImageUrl(cid) ?? null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">(() =>
    peekPubChemImageUrl(cid) ? "ready" : "loading",
  )

  useEffect(() => {
    let cancelled = false
    const cached = peekPubChemImageUrl(cid)
    if (cached) {
      setSrc(cached)
      setStatus("ready")
      return
    }
    setSrc(null)
    setStatus("loading")
    loadPubChemImageUrl(cid)
      .then((url) => {
        if (cancelled) return
        setSrc(url)
        setStatus("ready")
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null)
          setStatus("error")
        }
      })
    return () => {
      cancelled = true
    }
  }, [cid])

  return (
    <div className="w-full h-full flex items-center justify-center relative"
      style={{ background: "#f0faf7" }}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#dde5ef", borderTopColor: "#00a882" }} />
        </div>
      )}
      {status === "error" ? (
        <p className="text-xs px-3 text-center" style={{ color: "#64748b" }}>
          2D structure unavailable for {name}.
        </p>
      ) : src ? (
        // Native img avoids Next/Image onLoad races that left Combined view spinning forever.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${name} 2D structure`}
          width={height}
          height={height}
          style={{ maxHeight: height - 8, maxWidth: "90%", objectFit: "contain", display: "block" }}
        />
      ) : null}
    </div>
  )
}

/** Standalone PubChem 2D depiction used by Combined Tea Formulation and other panels. */
export function CompoundStructure2D({
  cid,
  name,
  height = 160,
  className,
}: {
  cid: number
  name: string
  height?: number
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        height,
        overflow: "hidden",
        borderRadius: 8,
        border: "1px solid #e2e8f0",
        background: "#f0faf7",
      }}
    >
      <PubChemImage cid={cid} height={height} name={name} />
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
  quiet = false,
}: {
  cid: number
  name: string
  height?: number
  color?: string
  /** Research-setup viewer: no spin, no live badge. */
  quiet?: boolean
}) {
  const [mode, setMode] = useState<"3d" | "2d">("3d")
  const [conformer, setConformer] = useState<"3d" | "2d" | null>(null)
  const [srcdoc, setSrcdoc] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [viewKey, setViewKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setSrcdoc(null)
    setConformer(null)
    fetchSDF(cid)
      .then((result) => {
        if (cancelled) return
        setConformer(result.conformer)
        if (result.conformer === "2d") setMode("2d")
        const html = buildMolHTML(result.sdf, "sdf", "#070d18", "ballstick", quiet ? 0 : 1, color)
        setSrcdoc(html)
        setStatus("ready")
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [cid, color, quiet, viewKey])

  const bodyH = height - 40

  return (
    <div className={`relative overflow-hidden border flex flex-col ${quiet ? "rounded-md" : "rounded-2xl"}`}
      style={{ height, borderColor: "rgba(255, 255, 255, 0.08)", background: "#070d18" }}>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: "rgba(255, 255, 255, 0.08)", background: "rgba(11, 20, 34, 0.85)" }}>
        <div className="flex items-center gap-1.5">
          {(["3d", "2d"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wide transition-all"
              style={{
                borderColor: mode === m ? "#2dd4bf" : "rgba(255, 255, 255, 0.1)",
                color: mode === m ? "#5eead4" : "#94a3b8",
                background: mode === m ? "rgba(45, 212, 191, 0.15)" : "transparent",
              }}>
              {m}
            </button>
          ))}
          {quiet && mode === "3d" && status === "ready" ? (
            <button
              type="button"
              onClick={() => setViewKey((n) => n + 1)}
              className="text-[11px] font-medium px-2 py-1"
              style={{ color: "#546e8a" }}
            >
              Reset
            </button>
          ) : null}
          {!quiet && mode === "3d" && status === "ready" && (
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
              quiet ? (
                <div className="phyto-skel phyto-skel--stage" aria-hidden>
                  <i /><i /><i />
                </div>
              ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                style={{ background: "#f0faf7" }}>
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "#dde5ef", borderTopColor: color }} />
                <span className="text-xs font-mono" style={{ color: "#546e8a" }}>
                  Loading structure…
                </span>
              </div>
              )
            )}
            {status === "error" && (
              quiet ? (
                <StructureUnavailable onRetry={() => setViewKey((n) => n + 1)} />
              ) : (
                <PubChemImage cid={cid} height={bodyH} name={name} />
              )
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
          PubChem CID {cid} · {conformer === "2d" ? "2D coordinates" : mode === "3d" ? "3D conformer" : "2D depiction"}
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
      .then((pdb) => {
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
      .then((result) => {
        if (cancelled) return
        const html = buildMolHTML(result.sdf, "sdf", "#f0faf7", "ballstick", 1, compoundColor)
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
  quiet = false,
  searchBox,
  highlightChain,
}: {
  pdbId: string
  name: string
  height?: number
  color?: string
  /** Research-setup viewer: no spin, reset control, no docking context. */
  quiet?: boolean
  searchBox?: { centerX: number; centerY: number; centerZ: number; sizeX: number; sizeY: number; sizeZ: number } | null
  highlightChain?: string
}) {
  const { theme } = useTheme()
  const isLight = theme === "light"
  const molBg = isLight ? "#f8fafc" : "#070d18"
  const [pdb, setPdb] = useState<string | null>(null)
  const [srcdoc, setSrcdoc] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [viewKey, setViewKey] = useState(0)
  const boxKey = searchBox
    ? [searchBox.centerX, searchBox.centerY, searchBox.centerZ, searchBox.sizeX, searchBox.sizeY, searchBox.sizeZ].join(",")
    : ""

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setPdb(null)
    fetchPDB(pdbId)
      .then((text) => {
        if (!cancelled) setPdb(text)
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [pdbId, viewKey])

  useEffect(() => {
    if (!pdb) return
    setSrcdoc(buildMolHTML(pdb, "pdb", molBg, "cartoon", quiet ? 0 : 0.5, color, {
      ...(searchBox ? { searchBox } : {}),
      ...(highlightChain ? { chain: highlightChain } : {}),
    }))
    setStatus("ready")
  }, [pdb, color, quiet, boxKey, highlightChain, molBg])

  return (
    <div
      className="relative rounded-2xl overflow-hidden border flex flex-col"
      style={{ height, borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-secondary)" }}
      >
        <span className="text-[11px] font-bold" style={{ color: quiet ? (isLight ? "#0f766e" : "#2dd4bf") : color }}>
          PDB {pdbId}
        </span>
        <span className="flex items-center gap-2">
          {quiet && status === "ready" ? (
            <button type="button" className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }} onClick={() => setViewKey((n) => n + 1)}>
              Reset
            </button>
          ) : null}
          <a
            href={`https://www.rcsb.org/structure/${pdbId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium"
            style={{ color: "#0284c7" }}
          >
            RCSB PDB ↗
          </a>
        </span>
      </div>
      <div className="flex-1 relative">
        {status === "loading" && (
          quiet ? (
            <div className="phyto-skel phyto-skel--stage" aria-hidden>
              <i /><i /><i />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-mono" style={{ color: "#546e8a" }}>
              Loading structure…
            </div>
          )
        )}
        {status === "error" && (
          quiet ? (
            <StructureUnavailable onRetry={() => setViewKey((n) => n + 1)} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-mono" style={{ color: "#b45309" }}>
              Could not load structure
            </div>
          )
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

function buildPoseHTML(proteinPdb: string | null, ligandPdb: string): string {
  const proteinJs = JSON.stringify(proteinPdb ?? "")
  const ligandJs = JSON.stringify(ligandPdb)
  const hasProtein = proteinPdb ? "true" : "false"
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#070d18;overflow:hidden;font:12px/1 system-ui,sans-serif;color:#e2e8f0}
  #bar{position:absolute;z-index:2;top:8px;left:8px;display:flex;gap:6px}
  button{border:1px solid rgba(255,255,255,0.12);background:rgba(15,23,42,0.85);color:#cbd5e1;border-radius:999px;padding:4px 8px;font:inherit;cursor:pointer;backdrop-filter:blur(8px)}
  button:hover{border-color:rgba(45,212,191,0.4);color:#5eead4;background:rgba(45,212,191,0.15)}
  button[data-on="false"]{opacity:.45}
</style>
<script>window.OffscreenCanvas=undefined;</script>
<script src="https://3dmol.org/build/3Dmol-min.js"></script>
</head>
<body>
<div id="bar">
  <button type="button" id="reset">Reset</button>
  <button type="button" id="zin">Zoom</button>
  <button type="button" id="prot">Protein</button>
  <button type="button" id="lig">Ligand</button>
</div>
<div id="v" style="width:100vw;height:100vh"></div>
<script>
(function(){
  var protein=${proteinJs};
  var ligand=${ligandJs};
  var hasProtein=${hasProtein};
  var viewer=$3Dmol.createViewer(document.getElementById('v'),{backgroundColor:'#f4f7fb',antialias:true});
  if (hasProtein) viewer.addModel(protein,'pdb');
  viewer.addModel(ligand,'pdb');
  var showP=true, showL=true;
  function paint(){
    if (hasProtein) {
      var receptor=viewer.getModel(0);
      if (showP) { receptor.show(); viewer.setStyle({model:0},{cartoon:{color:'spectrum'}}); }
      else receptor.hide();
    }
    var ligandModel=viewer.getModel(hasProtein?1:0);
    if (showL) {
      ligandModel.show();
      viewer.setStyle({model:hasProtein?1:0},{stick:{radius:0.15,colorscheme:'Jmol'},sphere:{scale:0.25,colorscheme:'Jmol'}});
    } else ligandModel.hide();
    viewer.render();
  }
  paint();
  viewer.zoomTo();
  viewer.render();
  document.getElementById('reset').onclick=function(){ viewer.zoomTo(); viewer.render(); };
  document.getElementById('zin').onclick=function(){ viewer.zoom(1.2, 200); };
  document.getElementById('prot').onclick=function(){
    if (!hasProtein) return;
    showP=!showP;
    this.setAttribute('data-on', showP?'true':'false');
    paint();
  };
  document.getElementById('lig').onclick=function(){
    showL=!showL;
    this.setAttribute('data-on', showL?'true':'false');
    paint();
  };
  if (!hasProtein) document.getElementById('prot').disabled=true;
})();
</script>
</body>
</html>`
}

/** Imported docked coordinates only. Does not load a PubChem conformer. */
export function DockedPoseViewer({
  poseModel,
  pdbId,
  height = 280,
}: {
  poseModel: string
  pdbId?: string
  height?: number
}) {
  const [srcdoc, setSrcdoc] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [proteinMissing, setProteinMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setSrcdoc(null)
    setProteinMissing(false)
    const load = async () => {
      let protein: string | null = null
      if (pdbId) {
        try {
          protein = await fetchPDB(pdbId)
        } catch {
          protein = null
        }
      }
      if (cancelled) return
      setProteinMissing(Boolean(pdbId) && !protein)
      setSrcdoc(buildPoseHTML(protein, poseModel))
      setStatus("ready")
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [poseModel, pdbId])

  return (
    <div>
      <div className="dock-pose" style={{ height }}>
        {status === "loading" ? <div className="phyto-skel" /> : null}
        {status === "ready" && srcdoc ? (
          <iframe srcDoc={srcdoc} sandbox="allow-scripts" title="Imported docking pose" />
        ) : null}
      </div>
      {proteinMissing ? (
        <p className="phyto-missing">Protein coordinates could not be loaded. The imported ligand pose is shown.</p>
      ) : null}
    </div>
  )
}
