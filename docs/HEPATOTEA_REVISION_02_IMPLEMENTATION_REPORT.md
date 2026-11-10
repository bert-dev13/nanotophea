# HEPATOTEA Revision 02 – Implementation Report

**Date:** 2026-11-11  
**Scope:** Legacy display sanitization, exploratory acknowledgement auditability, endpoint-spec alignment, documentation alignment, API consent/access tests  
**Constraint followed:** No silent rewrite of historical rows; no schema migration; no new scientific formulas; experimental DPPH/LDH formulas untouched; six modules remain exploratory (not validated)

**Status vocabulary**

| Status | Meaning |
|--------|---------|
| **VERIFIED** | Implemented in source and covered by automated tests and/or unambiguous code path |
| **PARTIALLY VERIFIED** | Core behavior present; residual gap noted |
| **NOT IMPLEMENTED** | Not done in this revision |
| **NOT VERIFIABLE** | Requires live DB/browser E2E not executed here |

---

## 1. Executive summary

Revision 02 closes the remaining integrity gaps identified by the Final Scientific Integrity Verification Audit:

1. Legacy SIMULATION metrics (TEAC, IC50 summaries, SI, Predicted OD, BAX populations/markers) are quarantined into a labeled historical section instead of masquerading as current assay measurements.
2. New exploratory runs persist server-stamped acknowledgement metadata in `input_parameters` (actor from session, timestamp, version, run id).
3. Endpoint `outputLabels` / contexts now match remediated exploratory engines.
4. `README.md` and `STUDY_DESIGN_CONTRACT.md` reflect MySQL + session auth + Vina + exploratory vs validated reality.
5. Predictions API handler enforces auth, study access, acknowledgement, and no validated→prototype fallback — covered by automated tests.

**Database migrations:** none.

**Six modules remain exploratory simulations only.** No module is claimed as scientifically validated.

---

## 2. Task verification matrix

| Task | Status | Notes |
|------|--------|-------|
| T1 Legacy display sanitization | **VERIFIED** | `lib/predictions/displaySanitization.ts` used by Biological Predictions UI, Stage 6 report summary, AnalysisInterpretation lines, AI interpretation context |
| T2 Persist exploratory acknowledgement | **VERIFIED** | Server stamp in API response; `storedSimulationFromPrototype` + `createPredictionRun` write `meta:acknowledged*`; historical missing consent distinguishable |
| T3 Align endpoint specifications | **VERIFIED** | All six `lib/predictions/{dpph,mtt,ldh,ros,bax,hippo-yap}.ts` specs updated; test asserts obsolete labels absent |
| T4 README + study docs | **VERIFIED** | README rewritten to actual stack; contract amendment strengthens SIMULATION controls without weakening scientific requirements |
| T5 API integration tests | **VERIFIED** | `predictionApi.route.test.ts` covers auth, ack, access, spoofed actor, validated 404, persistence metadata |
| T6 Experimental lab workflows intact | **VERIFIED** | `derivedAssays.test.ts` still passes; no edits to `lib/lab/derivedAssays.ts` |

---

## 3. Files modified / added

### Added

| File | Purpose |
|------|---------|
| `lib/predictions/displaySanitization.ts` | Evidence-aware primary vs legacy metric display |
| `lib/predictions/displaySanitization.test.ts` | Legacy + current + PREDICTED cases |
| `lib/predictions/acknowledgement.ts` | Ack version/text + stamp/read helpers |
| `lib/predictions/predictionRequest.ts` | Pure predictions API handler (auth/access injectable) |
| `lib/predictions/predictionApi.route.test.ts` | Consent/access/validated-path tests |
| `docs/HEPATOTEA_REVISION_02_IMPLEMENTATION_REPORT.md` | This report |

### Modified

| File | Change |
|------|--------|
| `app/api/scientific/predictions/route.ts` | Session auth, study membership check, handler wiring |
| `lib/predictions/store.ts` | Persist acknowledgement into `input_parameters` |
| `lib/repositories/scientificRunRepository.ts` | Bind `meta:simulationRunId` on create when ack present |
| `components/study/BiologicalPredictionsWorkspace.tsx` | studyId + server ack; sanitized outputs; legacy section; copy fixes |
| `components/analysis/Stage6Report.tsx` | Sanitized prediction summary |
| `components/study/AnalysisInterpretation.tsx` | Sanitized simulation lines |
| `lib/ai/interpretation-context.ts` | Sanitized prediction lines for AI context |
| `lib/predictions/{dpph,mtt,ldh,ros,bax,hippo-yap}.ts` | Spec/label/context alignment |
| `lib/predictions/types.ts` | Clarified `outputLabels` semantics |
| `README.md` | Accurate stack, evidence, limitations |
| `docs/STUDY_DESIGN_CONTRACT.md` | SIMULATION operational controls + amendment log |
| `package.json` | Include new test files in `npm test` |

### Not modified (intentionally)

- `lib/lab/derivedAssays.ts`
- Prototype engine math (`lib/predictions/prototype/*` formulas)
- MySQL schema / migrations

---

## 4. Behaviour details

### 4.1 Legacy display

For `SIMULATION` / `exploratory_math` runs:

- Current exploratory outputs render in the primary table.
- Obsolete keys (TEAC, IC50, Selectivity index, Predicted OD, BCL-2/caspase, viable/early/late/necrotic, etc.) render only under a **Historical / legacy** warning.
- Raw MySQL rows are not rewritten.
- PREDICTED / documented_model summaries are not quarantined by this path.

### 4.2 Acknowledgement audit fields (new runs)

Stored in `biological_predictions.input_parameters`:

| Key | Meaning |
|-----|---------|
| `meta:acknowledgedExploratory` | `true` |
| `meta:acknowledgedAt` | ISO timestamp |
| `meta:acknowledgedBy` | Authenticated user id (server session) |
| `meta:acknowledgementVersion` | `hepatotea-exploratory-ack-v1` |
| `meta:acknowledgementText` | Exact consent text version |
| `meta:simulationRunId` | New prediction run id (set at insert) |

Historical rows without these keys report `historicalMissingConsent: true` via `readAcknowledgementFromParameters`.

Client-supplied `actorId` / `acknowledgedBy` are ignored by the API handler.

### 4.3 API enforcement

| Request | Result |
|---------|--------|
| No session | 401 |
| Exploratory without ack | 400 `acknowledgement_required` |
| Exploratory without study access | 403 |
| Exploratory with ack + access | 200 SIMULATION + acknowledgement stamp |
| Validated / default | 404 `not_configured` (no prototype fallback) |

---

## 5. Test results

### Commands

```bash
npm test
```

Also exercised focused:

```bash
npx tsx --tsconfig tsconfig.json --test \
  lib/predictions/displaySanitization.test.ts \
  lib/predictions/predictionApi.route.test.ts \
  lib/predictions/predictionApi.mode.test.ts \
  lib/predictions/prototype/prototype.test.ts \
  lib/predictions/engine.test.ts \
  lib/predictions/modules.test.ts \
  lib/lab/derivedAssays.test.ts
```

### Results

| Suite | Result |
|-------|--------|
| Full `npm test` | **229 passed / 0 failed / 0 skipped** |
| Display sanitization | Pass |
| Predictions API route contract | Pass |
| Prototype integrity | Pass |
| Lab derived assays | Pass |

### Coverage vs acceptance criteria

| Criterion | Covered? |
|-----------|----------|
| Legacy sims cannot masquerade as experimental measurements | Yes (unit + UI wiring) |
| Historical records preserved | Yes (display-only quarantine) |
| New exploratory runs auditable acknowledgement | Yes (store + API tests) |
| Specs match engines | Yes |
| README/docs accurate | Yes (manual review) |
| API consent + validated paths | Yes |
| Experimental DPPH/LDH intact | Yes |
| No validated-model claims | Yes |

### Unavailable runtime checks

- Live MySQL end-to-end create via Next route + browser confirm dialog: **NOT VERIFIABLE** in this run (no browser E2E executed).
- Inspection of production historical rows: **NOT VERIFIABLE** without a live study database.

---

## 6. Remaining scientific-integrity risks

1. **Treatment duration** still absent from prediction features (**NOT IMPLEMENTED** — out of Rev02 scope beyond disclosure).
2. **DPPH HBD/TPSA** still usually missing from `admet.descriptors` (**PARTIALLY VERIFIED** / pre-existing).
3. **`updatePredictionRun`** still does not replace full scientific payload fields (pre-existing); re-runs that update an existing id may not overwrite metrics — create path is the primary remediated path.
4. Browser E2E of consent modal + legacy table rendering not automated.
5. Modules remain scientifically unvalidated by design.

---

## 7. Readiness

| Area | Classification |
|------|----------------|
| Six exploratory modules | Exploratory simulation only — suitable for researcher acceptance testing of remediated UX + audit trail |
| Validated prediction claims | **Not ready** (no registered models) |
| Experimental DPPH | Ready (unchanged formulas) |
| Experimental LDH | Ready (unchanged formulas) |

---

## 8. Concise remaining issues

- No treatment-duration capture.
- Descriptor path for HBD/TPSA still limited.
- Full prediction-run update semantics remain narrow (pre-existing).
- No browser E2E suite for consent UI.

**Blocking for researcher acceptance testing of exploratory + lab paths:** none introduced by Rev02.

**Blocking for claiming validated predictive science:** all six computational bioactivity modules (unchanged, intentional).
