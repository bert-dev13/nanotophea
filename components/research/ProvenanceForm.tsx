"use client"

import type { EvidenceType } from "@/types/evidence"
import { FormField, inputClass, inputStyle, textareaClass } from "@/components/research/FormFields"

export interface ProvenanceFormState {
  evidenceClass: EvidenceType
  source: string
  citation: string
  retrievedAt: string
  notesLimitation: string
}

export function emptyProvenanceForm(
  evidenceClass: EvidenceType = "REFERENCE"
): ProvenanceFormState {
  return {
    evidenceClass,
    source: "",
    citation: "",
    retrievedAt: new Date().toISOString().slice(0, 10),
    notesLimitation: "",
  }
}

/** Returns error message or null if provenance is acceptable for Research Data. */
export function validateResearchProvenance(p: ProvenanceFormState): string | null {
  if (p.evidenceClass === "REFERENCE") {
    if (!p.source.trim()) return "REFERENCE records require a source database or protocol."
    if (!p.retrievedAt.trim()) return "REFERENCE records require a retrieval/record date."
    return null
  }
  if (p.evidenceClass === "LITERATURE") {
    if (!p.citation.trim() && !p.source.trim()) {
      return "LITERATURE requires a citation (DOI/PMID/URL) or linked source — not free-typed claims alone."
    }
    return null
  }
  return "Research Data records must use REFERENCE or LITERATURE evidence only."
}

export function provenanceFromForm(p: ProvenanceFormState) {
  return {
    evidenceClass: p.evidenceClass,
    source: p.source.trim() || undefined,
    citation: p.citation.trim() || undefined,
    retrievedAt: p.retrievedAt.trim() || undefined,
    recordedAt: new Date().toISOString(),
    limitations: p.notesLimitation.trim() || undefined,
  }
}

export function ProvenanceFormFields({
  value,
  onChange,
  allowLiterature = true,
}: {
  value: ProvenanceFormState
  onChange: (next: ProvenanceFormState) => void
  allowLiterature?: boolean
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
      <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>
        Provenance (required)
      </p>
      <FormField label="Evidence class" required>
        <select
          className={inputClass}
          style={inputStyle}
          value={value.evidenceClass}
          onChange={(e) =>
            onChange({ ...value, evidenceClass: e.target.value as EvidenceType })
          }
        >
          <option value="REFERENCE">REFERENCE</option>
          {allowLiterature && <option value="LITERATURE">LITERATURE</option>}
        </select>
      </FormField>
      <FormField
        label="Source database / protocol"
        required={value.evidenceClass === "REFERENCE"}
        hint="e.g. PubChem, RCSB PDB, STUDY_DESIGN_CONTRACT"
      >
        <input
          className={inputClass}
          style={inputStyle}
          value={value.source}
          onChange={(e) => onChange({ ...value, source: e.target.value })}
        />
      </FormField>
      <FormField
        label="Citation / accession"
        required={value.evidenceClass === "LITERATURE"}
        hint="DOI, PMID, CID, PDB ID, or URL — required for LITERATURE"
      >
        <input
          className={inputClass}
          style={inputStyle}
          value={value.citation}
          onChange={(e) => onChange({ ...value, citation: e.target.value })}
        />
      </FormField>
      <FormField label="Retrieved / recorded date" required={value.evidenceClass === "REFERENCE"}>
        <input
          type="date"
          className={inputClass}
          style={inputStyle}
          value={value.retrievedAt}
          onChange={(e) => onChange({ ...value, retrievedAt: e.target.value })}
        />
      </FormField>
      <FormField label="Limitations (optional)">
        <textarea
          className={textareaClass}
          style={inputStyle}
          value={value.notesLimitation}
          onChange={(e) => onChange({ ...value, notesLimitation: e.target.value })}
        />
      </FormField>
    </div>
  )
}
