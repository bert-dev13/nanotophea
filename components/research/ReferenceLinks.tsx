"use client"

import { useEffect, useState } from "react"
import type { ReferenceRecord } from "@/lib/domain/models"
import { listReferences } from "@/lib/repositories/researchDataRepository"

export function useStudyReferences(studyId: string | undefined) {
  const [refs, setRefs] = useState<ReferenceRecord[]>([])
  useEffect(() => {
    if (!studyId) {
      setRefs([])
      return
    }
    let cancelled = false
    void listReferences(studyId).then((rows) => {
      if (!cancelled) setRefs(rows)
    })
    return () => {
      cancelled = true
    }
  }, [studyId])
  return refs
}

export function ReferenceLinkList({
  referenceIds,
  references,
}: {
  referenceIds: string[]
  references: ReferenceRecord[]
}) {
  if (!referenceIds.length) return null
  const map = new Map(references.map((r) => [r.id, r]))
  return (
    <ul className="space-y-1.5">
      {referenceIds.map((id) => {
        const r = map.get(id)
        return (
          <li key={id} className="text-xs" style={{ color: "#0369a1" }}>
            {r ? (
              <>
                <span className="font-semibold" style={{ color: "#0d1f3c" }}>
                  {r.title}
                </span>
                {r.year ? ` (${r.year})` : ""}
                {r.doi && (
                  <>
                    {" · "}
                    <a
                      href={`https://doi.org/${r.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      DOI
                    </a>
                  </>
                )}
                {r.pmid && (
                  <>
                    {" · "}
                    <a
                      href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      PMID {r.pmid}
                    </a>
                  </>
                )}
                {r.url && !r.doi && !r.pmid && (
                  <>
                    {" · "}
                    <a href={r.url} target="_blank" rel="noreferrer" className="underline">
                      Link
                    </a>
                  </>
                )}
              </>
            ) : (
              <span style={{ color: "#94a3b8" }}>Reference {id.slice(0, 8)}… (missing)</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function ReferenceIdPicker({
  references,
  value,
  onChange,
  disabled,
}: {
  references: ReferenceRecord[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1 max-h-36 overflow-y-auto rounded-lg border p-2" style={{ borderColor: "#dde5ef" }}>
      {references.length === 0 && (
        <p className="text-xs" style={{ color: "#94a3b8" }}>
          No study references yet. Add some under Research Data → References.
        </p>
      )}
      {references.map((r) => {
        const checked = value.includes(r.id)
        return (
          <label key={r.id} className="flex items-start gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              disabled={disabled}
              checked={checked}
              onChange={() =>
                onChange(checked ? value.filter((id) => id !== r.id) : [...value, r.id])
              }
            />
            <span style={{ color: "#1a3558" }}>
              {r.title}
              {r.year ? ` (${r.year})` : ""}
            </span>
          </label>
        )
      })}
    </div>
  )
}
