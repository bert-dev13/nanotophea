"use client"

/**
 * Lightweight PubChem 2D depictions — no 3Dmol / WebGL.
 * Prefer this module when only 2D is needed so the heavy mol3d chunk stays deferred.
 */

import { useEffect, useState } from "react"
import { loadPubChemImageUrl, peekPubChemImageUrl } from "@/lib/scientific/pubchemClientCache"

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
    <div
      className="w-full h-full flex items-center justify-center relative"
      style={{ background: "#f0faf7" }}
    >
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#dde5ef", borderTopColor: "#00a882" }}
          />
        </div>
      )}
      {status === "error" ? (
        <p className="text-xs px-3 text-center" style={{ color: "#64748b" }}>
          2D structure unavailable for {name}.
        </p>
      ) : src ? (
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

export { PubChemImage }
