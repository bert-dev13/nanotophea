"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Box, ImageIcon } from "lucide-react"

const CompoundViewer3D = dynamic(
  () => import("@/lib/mol3d").then((m) => m.CompoundViewer3D),
  {
    ssr: false,
    loading: () => (
      <div className="tea-dash-viewer-skel" style={{ height: 280 }}>
        Loading molecular viewer…
      </div>
    ),
  },
)

const ProteinViewer3D = dynamic(
  () => import("@/lib/mol3d").then((m) => m.ProteinViewer3D),
  {
    ssr: false,
    loading: () => (
      <div className="tea-dash-viewer-skel" style={{ height: 280 }}>
        Loading protein viewer…
      </div>
    ),
  },
)

/** Ligand 2D/3D — loads PubChem/3Dmol only after the researcher requests it. */
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
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <div className="deferred-mol-gate" style={{ minHeight: height }}>
        <ImageIcon size={18} aria-hidden />
        <div>
          <strong>Molecular structure</strong>
          <p>2D/3D loads on demand for CID {cid}. Other page content stays interactive.</p>
        </div>
        <button type="button" className="phyto-select" data-on="false" onClick={() => setOpen(true)}>
          Show structure
        </button>
      </div>
    )
  }

  return <CompoundViewer3D key={cid} cid={cid} name={name} height={height} quiet={quiet} />
}

/** Protein 3D — loads RCSB/3Dmol only after request. */
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
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <div className="deferred-mol-gate" style={{ minHeight: height }}>
        <Box size={18} aria-hidden />
        <div>
          <strong>Protein structure</strong>
          <p>3D viewer for {pdbId} loads on demand.</p>
        </div>
        <button type="button" className="phyto-select" data-on="false" onClick={() => setOpen(true)}>
          Show structure
        </button>
      </div>
    )
  }

  return <ProteinViewer3D key={pdbId} pdbId={pdbId} name={name} height={height} quiet={quiet} />
}
