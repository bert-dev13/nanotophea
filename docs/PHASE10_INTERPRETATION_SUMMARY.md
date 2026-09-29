# Phase 10 — Researcher Interpretation Summary

**Date:** 2026-09-29  
**Binding source of truth:** `docs/STUDY_DESIGN_CONTRACT.md` §12  
**Scope:** Researcher-authored scientific interpretation workspace with evidence linking  
**Route:** `/analysis/interpretation`  
**Collection:** `studies/{studyId}/interpretations/{interpretationId}`  

**Build:** `npm run build` succeeds  
**Tests:** `npm test` — 39/39 pass  

**Reports:** remain removed (`/reports` absent)

---

## 1. Architecture

| Piece | Role |
|-------|------|
| `lib/interpretation/presets.ts` | Contract §12.1 RQ/hypothesis presets (manual fill only) |
| `lib/interpretation/evidenceCatalog.ts` | Fingerprints, freshness, evidence-class guards |
| `lib/repositories/interpretationRepository.ts` | CRUD, evidence library, resolve links, audit |
| `components/analysis/InterpretationWorkspace.tsx` | Evidence library + structured editor |

The platform **organizes and links** evidence. It does **not** auto-write conclusions, auto-assess hypotheses, or convert PREDICTED → EXPERIMENTAL.

---

## 2. InterpretationRecord schema

| Field | Notes |
|-------|-------|
| `title` | Required |
| `researchQuestion`, `researchObjective`, `hypothesisText` | Researcher-authored (optional contract preset) |
| `researchQuestionPresetId?` | Preset id; fills **empty** fields only |
| `linkedEvidence[]` | `{ sourceType, sourceId, evidenceClass, label, sourceUpdatedAt?, moduleLabel? }` |
| `computationalSummary` / `experimentalSummary` / `statisticalSummary` / `comparisonSummary` | Manual narrative sections |
| `interpretationText`, `limitations`, `conclusion` | INTERPRETATION narrative |
| `hypothesisAssessment` | `not_assessed` \| `supported` \| `partially_supported` \| `not_supported` |
| `assessmentRationale?`, `assessmentSelectedBy?`, `assessmentSelectedAt?` | Set only on manual assessment change |
| `status` | `draft` → `reviewed` → `final` (legacy `submitted` → `reviewed`) |
| `sourceFingerprint`, `freshness` | Stale detection |
| `provenance.evidenceClass` | Always **INTERPRETATION** |

---

## 3. Evidence linking

Supported `sourceType` values:

| Group | Types |
|-------|-------|
| Research Data | `formulation`, `compound`, `protein`, `cellLine`, `reference` |
| Computational | `admetRun`, `dockingRun`, `predictionRun` |
| Experimental | `labDataset` |
| Analysis | `statistics`, `comparison` |

UI evidence library is grouped and collapsible. Linking stores IDs + evidence class + label — not full dataset copies.

Displayed factual snippets (when available) include stored values such as Vina affinity, ANOVA p, comparison compatibility. These are **not** turned into auto-generated efficacy claims.

---

## 4. Evidence classes

Preserved end-to-end via `EvidenceBadge`.

Guards reject illegal conversions (examples):

- prediction / ADMET / docking cannot be linked as EXPERIMENTAL  
- lab datasets / statistics must be EXPERIMENTAL  
- INTERPRETATION narrative remains INTERPRETATION  

Missing sources resolve as **SOURCE MISSING** (not silently valid).

---

## 5. Contract presets

From `STUDY_DESIGN_CONTRACT.md` §12.1:

1. Experimental DPPH T1–T6 significance question / null–alternative  
2. Experimental LDH T1–T6 significance question / null–alternative  

Selecting a preset fills only blank question/objective/hypothesis fields — wording is not rewritten.

---

## 6. Hypothesis assessment

Human-controlled only. Changing assessment records `assessmentSelectedBy` + `assessmentSelectedAt` and audits `interpretation.hypothesis_assessment`.

No algorithm selects supported / not_supported.

---

## 7. Status workflow

`draft` → `reviewed` → `final`  
Never auto-marked final.

Audit: `interpretation.status_change`

---

## 8. Stale detection

Fingerprint = sorted `sourceType:sourceId:sourceUpdatedAt` for all links.

On list/get, re-resolve links. If fingerprint differs or any source is missing → **STALE / REQUIRES REVIEW**.

Narrative is **not** auto-rewritten.

---

## 9. Permissions & audit

| Role | Access |
|------|--------|
| OWNER / COLLABORATOR | create · edit · link/unlink · assessment · status · delete |
| ADVISER / VIEWER | read-only |

Audit actions:

- `interpretation.create`
- `interpretation.update`
- `interpretation.delete`
- `interpretation.status_change`
- `interpretation.hypothesis_assessment`

Helpers: `canEditInterpretations` / `interpretationRoleLabel`

---

## 10. Scientific language guards

UI/contract notes forbid auto claims such as proven effective, clinically effective, cures, validated treatment.

No LLM interpretation feature in this phase.

---

## 11. Tests (`lib/interpretation/interpretation.test.ts`)

- Fingerprint stability / change / stale / missing  
- Evidence-class guards (prediction, lab, reference)  
- Contract presets present and free of efficacy slogans  
- Structural “no auto-conclusions” check  

Together with Phase 8–9 suites: **39 tests**.

---

## 12. Limitations

- No adviser review-comment thread beyond read-only  
- No automatic ranking of evidence  
- Presets cover contract experimental hypotheses only; other RQs are free text  
- Factual snippets are optional display aids, not generated conclusions  

---

## 13. Files created / modified

### Created
- `lib/interpretation/presets.ts`
- `lib/interpretation/evidenceCatalog.ts`
- `lib/interpretation/interpretation.test.ts`
- `components/analysis/InterpretationWorkspace.tsx`
- `docs/PHASE10_INTERPRETATION_SUMMARY.md`

### Modified
- `lib/domain/models.ts` — full Interpretation schemas  
- `lib/repositories/interpretationRepository.ts` — full CRUD + library  
- `lib/permissions/researchAccess.ts` — interpretation helpers  
- `app/analysis/interpretation/page.tsx` — workspace  
- `package.json` — test script includes interpretation tests  

---

## 14. Stop point

Phase 10 complete for review.  
**Do not begin final hardening automatically.**
