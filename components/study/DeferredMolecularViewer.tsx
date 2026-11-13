"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { Box, ImageIcon } from "lucide-react"
import { useVisibilityOnce } from "@/lib/hooks/useVisibilityOnce"

const CompoundStructure2D = dynamic(
  () => import("@/lib/mol2d").then((m) => m.CompoundStructure2D),
  {
    ssr: false,
    loading: () => (
      <div className="tea-dash-viewer-skel" style={{ height: 160 }} aria-busy="true">
        Loading 2D structure…
      </div>
    ),
  },
)

const CompoundViewer3D = dynamic(
  () => import("@/lib/mol3d").then((m) => m.CompoundViewer3D),
  {
    ssr: false,
    loading: () => (
      <div className="tea-dash-viewer-skel" style={{ height: 220 }} aria-busy="true">
        Loading 3D molecular viewer…
      </div>
    ),
  },
)

const ProteinViewer3D = dynamic(
  () => import("@/lib/mol3d").then((m) => m.ProteinViewer3D),
  {
    ssr: false,
    loading: () => (
      <div className="tea-dash-viewer-skel" style={{ height: 280 }} aria-busy="true">
        Loading protein viewer…
      </div>
    ),
  },
)

/** Delay before auto-starting 3D after the section is visible (ms). Lets 2D paint first. */
const AUTO_3D_DELAY_MS = 900

/**
 * Ligand molecular structure — visibility-aware.
 * 2D loads first (lightweight PubChem PNG + shared cache).
 * 3Dmol/WebGL starts after a short idle delay so it does not block the page.
 */
export function DeferredCompoundViewer({
  cid,
  name,
  height = 300,
  quiet = true,
}: {
  cid: number
  name: string
  height?: number
  quiet?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const active = useVisibilityOnce(rootRef)
  const [load3d, setLoad3d] = useState(false)
  const twoDHeight = Math.min(200, Math.max(140, Math.round(height * 0.55)))

  useEffect(() => {
    if (!active) {
      setLoad3d(false)
      return
    }
    let cancelled = false
    const start = () => {
      if (!cancelled) setLoad3d(true)
    }
    const ric = typeof window !== "undefined" ? window.requestIdleCallback : undefined
    let idleId: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    if (typeof ric === "function") {
      idleId = ric(start, { timeout: AUTO_3D_DELAY_MS })
    } else {
      timer = setTimeout(start, AUTO_3D_DELAY_MS)
    }
    return () => {
      cancelled = true
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId)
      }
      if (timer) clearTimeout(timer)
    }
  }, [active, cid])

  return (
    <div ref={rootRef} className="molecular-structure-auto space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">2D Structure</h4>
          <span className="text-[10px] font-mono text-slate-500">CID {cid}</span>
        </div>
        {active ? (
          <CompoundStructure2D cid={cid} name={name} height={twoDHeight} />
        ) : (
          <div className="deferred-mol-gate" style={{ minHeight: twoDHeight }} aria-busy="true">
            <ImageIcon size={18} aria-hidden />
            <div>
              <strong>2D structure</strong>
              <p>Loads when this section is on screen.</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">3D Structure</h4>
          {active && !load3d ? (
            <button
              type="button"
              className="phyto-select"
              data-on="false"
              onClick={() => setLoad3d(true)}
            >
              Open interactive 3D now
            </button>
          ) : null}
        </div>
        {!active ? (
          <div className="deferred-mol-gate" style={{ minHeight: height }} aria-busy="true">
            <ImageIcon size={18} aria-hidden />
            <div>
              <strong>3D structure</strong>
              <p>Interactive viewer starts after 2D is ready.</p>
            </div>
          </div>
        ) : load3d ? (
          <CompoundViewer3D key={cid} cid={cid} name={name} height={height} quiet={quiet} prefer2dWhileLoading />
        ) : (
          <div className="deferred-mol-gate" style={{ minHeight: Math.min(height, 160) }} aria-busy="true">
            <ImageIcon size={18} aria-hidden />
            <div>
              <strong>Preparing 3D…</strong>
              <p>Page stays interactive while the 3D viewer is scheduled.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Protein 3D — loads when visible, after a short idle delay to keep navigation responsive. */
export function DeferredProteinViewer({
  pdbId,
  name,
  height = 300,
  quiet = true,
}: {
  pdbId: string
  name: string
  height?: number
  quiet?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const active = useVisibilityOnce(rootRef)
  const [load3d, setLoad3d] = useState(false)

  useEffect(() => {
    if (!active) {
      setLoad3d(false)
      return
    }
    let cancelled = false
    const start = () => {
      if (!cancelled) setLoad3d(true)
    }
    const ric = typeof window !== "undefined" ? window.requestIdleCallback : undefined
    let idleId: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    if (typeof ric === "function") {
      idleId = ric(start, { timeout: AUTO_3D_DELAY_MS })
    } else {
      timer = setTimeout(start, AUTO_3D_DELAY_MS)
    }
    return () => {
      cancelled = true
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId)
      }
      if (timer) clearTimeout(timer)
    }
  }, [active, pdbId])

  if (!active) {
    return (
      <div ref={rootRef}>
        <div className="deferred-mol-gate" style={{ minHeight: height }} aria-busy="true">
          <Box size={18} aria-hidden />
          <div>
            <strong>Protein structure</strong>
            <p>3D viewer for {pdbId} loads when this section is visible.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!load3d) {
    return (
      <div ref={rootRef}>
        <div className="deferred-mol-gate" style={{ minHeight: Math.min(height, 160) }} aria-busy="true">
          <Box size={18} aria-hidden />
          <div>
            <strong>Preparing protein 3D…</strong>
            <p>PDB {pdbId} — viewer starts shortly without blocking the page.</p>
          </div>
          <button type="button" className="phyto-select" data-on="false" onClick={() => setLoad3d(true)}>
            Open now
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef}>
      <ProteinViewer3D key={pdbId} pdbId={pdbId} name={name} height={height} quiet={quiet} />
    </div>
  )
}
