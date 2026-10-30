"use client"

import { useEffect, useState } from "react"
import type { PubChemCompound, RcsbStructure } from "@/lib/scientific/types"

const compounds = new Map<number, PubChemCompound>()
const structures = new Map<string, RcsbStructure>()

type Status = "idle" | "loading" | "ready" | "error"

export function usePubChemCompound(cid: number | undefined) {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<Status>("idle")
  const [data, setData] = useState<PubChemCompound | undefined>()

  useEffect(() => {
    if (cid == null) {
      setStatus("idle")
      setData(undefined)
      return
    }
    const cached = compounds.get(cid)
    if (cached) {
      setData(cached)
      setStatus("ready")
      return
    }
    let cancel = false
    setStatus("loading")
    setData(undefined)
    fetch(`/api/scientific/pubchem/${cid}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable")
        return response.json() as Promise<PubChemCompound>
      })
      .then((row) => {
        if (cancel) return
        compounds.set(cid, row)
        setData(row)
        setStatus("ready")
      })
      .catch(() => {
        if (!cancel) setStatus("error")
      })
    return () => {
      cancel = true
    }
  }, [cid, attempt])

  return {
    status,
    data,
    retry: () => {
      if (cid != null) compounds.delete(cid)
      setAttempt((value) => value + 1)
    },
  }
}

export function useRcsbStructure(pdbId: string | undefined) {
  const id = pdbId?.trim().toUpperCase() || undefined
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<Status>("idle")
  const [data, setData] = useState<RcsbStructure | undefined>()

  useEffect(() => {
    if (!id) {
      setStatus("idle")
      setData(undefined)
      return
    }
    const cached = structures.get(id)
    if (cached) {
      setData(cached)
      setStatus("ready")
      return
    }
    let cancel = false
    setStatus("loading")
    setData(undefined)
    fetch(`/api/scientific/rcsb/${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable")
        return response.json() as Promise<RcsbStructure>
      })
      .then((row) => {
        if (cancel) return
        structures.set(id, row)
        setData(row)
        setStatus("ready")
      })
      .catch(() => {
        if (!cancel) setStatus("error")
      })
    return () => {
      cancel = true
    }
  }, [id, attempt])

  return {
    status,
    data,
    retry: () => {
      if (id) structures.delete(id)
      setAttempt((value) => value + 1)
    },
  }
}

export function usePubChemCompounds(cids: Array<number | undefined>) {
  const unique = [...new Set(cids.filter((cid): cid is number => typeof cid === "number" && Number.isInteger(cid) && cid > 0))]
  const key = unique.join(",")
  const [attempt, setAttempt] = useState(0)
  const [entries, setEntries] = useState<Record<number, { status: Status; data?: PubChemCompound }>>({})

  useEffect(() => {
    const ids = key ? key.split(",").map(Number) : []
    let cancel = false
    const jobs = ids.filter((cid) => !compounds.has(cid))
    setEntries((current) => {
      const next = { ...current }
      for (const cid of ids) {
        const cached = compounds.get(cid)
        next[cid] = cached ? { status: "ready", data: cached } : { status: "loading" }
      }
      return next
    })
    for (const cid of jobs) {
      fetch(`/api/scientific/pubchem/${cid}`)
        .then(async (response) => {
          if (!response.ok) throw new Error("unavailable")
          return response.json() as Promise<PubChemCompound>
        })
        .then((row) => {
          if (cancel) return
          compounds.set(cid, row)
          setEntries((current) => ({ ...current, [cid]: { status: "ready", data: row } }))
        })
        .catch(() => {
          if (!cancel) setEntries((current) => ({ ...current, [cid]: { status: "error" } }))
        })
    }
    return () => {
      cancel = true
    }
  }, [key, attempt])

  return {
    status(cid: number | undefined): Status {
      if (cid == null) return "idle"
      return entries[cid]?.status ?? (compounds.has(cid) ? "ready" : "loading")
    },
    data(cid: number | undefined): PubChemCompound | undefined {
      if (cid == null) return undefined
      return entries[cid]?.data ?? compounds.get(cid)
    },
    retry(cid?: number) {
      if (cid != null) compounds.delete(cid)
      setAttempt((value) => value + 1)
    },
  }
}
