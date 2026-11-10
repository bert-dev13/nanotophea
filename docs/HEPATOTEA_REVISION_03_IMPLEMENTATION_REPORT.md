# HEPATOTEA Revision 03 – Implementation Report

**Date:** 2026-11-11  
**Focus:** Runtime verification of Revision 02 (API route, acknowledgement persistence, legacy display, provenance, researcher acceptance)  
**Scientific position:** Six computational modules remain exploratory. None are scientifically validated predictive models.

**Status vocabulary**

| Status | Meaning |
|--------|---------|
| **VERIFIED** | Confirmed in source + automated tests and/or unambiguous runtime path |
| **PARTIALLY VERIFIED** | Core path confirmed; residual gap noted |
| **NOT IMPLEMENTED** | Not delivered |
| **NOT VERIFIABLE** | Could not be executed in this environment |

---

## 1. Executive summary

Revision 03 verified Revision 02 claims against the real Predictions route boundary and closed several integrity gaps found during inspection:

1. **Actual route boundary** is now testable via `postScientificPredictions` (session + study access injectable). Production `route.ts` wires MySQL + cookie/Bearer session auth.
2. **`updatePredictionRun` scientific replace** was a real defect: exploratory re-runs previously dropped metrics/acknowledgement. Fixed without schema migration.
3. **Acknowledgement run-id binding** is centralized (`bindAcknowledgementSimulationRunId`) for create and scientific replace.
4. **Provenance classification** distinguishes exploratory, documented predictions, and historical/unverified `PREDICTED` labels (no registered model → not presented as validated science).
5. **Legacy display audit** confirmed primary consumers use sanitization; no PDF/CSV prediction export surfaces exist.
6. **Browser RAT** could not be executed (app not reachable at localhost:3000). Checklist provided for researchers.
7. **Automated tests:** 242 passed; TypeScript clean; production build succeeded. `next lint` is not configured (interactive setup prompt).

**Database migrations:** none (none requested/required).

---

## 2. Files inspected

| Area | Paths |
|------|-------|
| Contract / Rev02 | `docs/STUDY_DESIGN_CONTRACT.md`, `docs/HEPATOTEA_REVISION_02_IMPLEMENTATION_REPORT.md`, `README.md` |
| API | `app/api/scientific/predictions/route.ts`, `lib/predictions/predictionRequest.ts`, `lib/predictions/predictionsRoute.ts` |
| Ack / store | `lib/predictions/acknowledgement.ts`, `lib/predictions/store.ts`, `lib/repositories/scientificRunRepository.ts` |
| Display | `lib/predictions/displaySanitization.ts`, `BiologicalPredictionsWorkspace.tsx`, `Stage6Report.tsx`, `AnalysisInterpretation.tsx`, `lib/ai/interpretation-context.ts` |
| Comparison | `lib/comparison/runComparison.ts` (uses series points + evidence class; no TEAC/SI cards) |
| Lab | `lib/lab/derivedAssays.ts` (+ tests; unchanged) |
| Manual import UI | `components/insilico/prediction/PredictionWorkspace.tsx` (caller of updatePredictionRun) |

---

## 3. Files modified / added and why

### Added

| File | Why |
|------|-----|
| `lib/predictions/predictionsRoute.ts` | Injectable real route boundary for auth/access/error sanitization tests |
| `lib/predictions/predictionsRoute.test.ts` | HTTP-boundary tests (401/403/400/200/404 + no secret leakage) |
| `lib/predictions/provenanceClassification.ts` | Explicit provenance classes beyond evidenceClass alone |
| `lib/predictions/provenanceClassification.test.ts` | Provenance + unverified PREDICTED behavior |
| `lib/predictions/acknowledgement.persistence.test.ts` | Run-id binding, spoofed actor, historical missing consent |
| `docs/HEPATOTEA_REVISION_03_RESEARCHER_ACCEPTANCE_CHECKLIST.md` | Researcher-facing RAT checklist |
| `docs/HEPATOTEA_REVISION_03_IMPLEMENTATION_REPORT.md` | This report |

### Modified

| File | Why |
|------|-----|
| `app/api/scientific/predictions/route.ts` | Wire production deps into `postScientificPredictions` |
| `lib/predictions/acknowledgement.ts` | Run-id bind helper; read simulationRunId; actor assert |
| `lib/repositories/scientificRunRepository.ts` | Scientific replace on update; bind run id on create/update |
| `lib/predictions/displaySanitization.ts` | Unverified PREDICTED quarantine; provenance warnings |
| `components/study/BiologicalPredictionsWorkspace.tsx` | Persist failure messaging; provenance warning UI; ack assert |
| `lib/predictions/displaySanitization.test.ts` | Align PREDICTED expectations with unverified rule |
| `lib/predictions/predictionApi.route.test.ts` | Stronger acknowledgement typing |
| `package.json` | Register new tests |

### Unchanged (intentional)

- Exploratory prototype formulas
- Experimental DPPH/LDH formulas (`lib/lab/derivedAssays.ts`)
- Database schema

---

## 4. Actual API route verification

| Scenario | Status | Evidence |
|----------|--------|----------|
| No authenticated session → 401 | **VERIFIED** | `predictionsRoute.test.ts`; route uses `getSessionUserFromRequest` |
| No study access → 403 | **VERIFIED** | Route loads `studies`/`study_members`; handler rejects |
| Exploratory without acknowledgement → 400 | **VERIFIED** | Route + handler tests |
| Exploratory with ack + access → 200 SIMULATION | **VERIFIED** | Route boundary test stamps server actor |
| Validated/default → 404 `not_configured` | **VERIFIED** | No prototype fallback in handler |
| Client fake actor ID ignored | **VERIFIED** | `acknowledgedByServer` / session id only |
| Private DB errors not leaked | **VERIFIED** | Access-load throw sanitized in `predictionsRoute.ts` |
| Live MySQL + browser session E2E | **NOT VERIFIABLE** | localhost:3000 unreachable in this run |

**Note on persistence:** The Predictions HTTP route computes and stamps acknowledgement; MySQL insert/update is performed by authenticated server actions (`createPredictionRun` / `updatePredictionRun`). Route success ≠ DB save. Workspace now surfaces “computed but not saved” if persistence throws.

Pure-handler tests (`predictionApi.route.test.ts`) remain useful but are **not** described as full HTTP integration tests. Route-boundary tests (`predictionsRoute.test.ts`) exercise the actual NextResponse path with injectable auth/DB.

---

## 5. Acknowledgement persistence verification

| Condition | Status | Evidence |
|-----------|--------|----------|
| Server validates acknowledgement flag | **VERIFIED** | Handler requires `acknowledgeExploratory === true` |
| Actor from session only | **VERIFIED** | Route + assert helper |
| Timestamp server-side | **VERIFIED** | `stampExploratoryAcknowledgement` |
| Version + exact text preserved | **VERIFIED** | `meta:acknowledgementVersion/Text` |
| `meta:simulationRunId` matches persisted id | **VERIFIED** | `bindAcknowledgementSimulationRunId` on create **and** scientific update |
| Failed insert does not claim saved success | **PARTIALLY VERIFIED** | Workspace wraps persist errors; no live DB failure injected in CI |
| Historical missing consent identifiable | **VERIFIED** | `readAcknowledgementFromParameters` + provenance classifier |
| Historical rows not rewritten to invent ack | **VERIFIED** | Bind only when ack already present; no migration rewrite |

**Critical fix:** `updatePredictionRun` previously updated only `runName`/`notes`/`status`. Biological Predictions re-runs and the manual PredictionWorkspace edit path now perform a **scientific replace** when method/source/payload fields are supplied, rebinding acknowledgement run id to the existing row id.

---

## 6. Legacy display audit results

| Surface | Uses sanitization / safe path? | Status |
|---------|--------------------------------|--------|
| Biological Predictions workspace | Yes (`sanitizePredictionDisplay`) | **VERIFIED** |
| Stage 6 report summary | Yes (`sanitizedPredictionSummary`) | **VERIFIED** |
| Analysis Interpretation lines | Yes (`sanitizedPredictionLines`) | **VERIFIED** |
| AI interpretation context | Yes (`predictionLines` → sanitizer) | **VERIFIED** |
| Comparison module | Uses `resultPoints` + evidence class; no TEAC/SI summary cards | **VERIFIED** |
| PDF exports | None found for predictions | **NOT IMPLEMENTED** (N/A) |
| CSV/Excel prediction exports | None found | **NOT IMPLEMENTED** (N/A) |
| Repository column names (`teac`, etc.) | Persist historical columns; display quarantines | **VERIFIED** (storage preserved) |

Experimental laboratory UIs were not altered and do not route through prediction sanitization (correct separation).

---

## 7. Historical provenance audit

| Class | Criteria | UI treatment |
|-------|----------|--------------|
| Experimental laboratory | Lab datasets / EXPERIMENTAL evidence | Outside prediction sanitizer; preserved |
| Exploratory mathematical simulation | `SIMULATION` / `exploratory_math` / exploratory source | Primary exploratory metrics; legacy metrics quarantined; missing-ack warned |
| Documented computational prediction | `PREDICTED` **and** registered model **and** method identity | Allowed as documented prediction (none registered today) |
| Historical / unverifiable | `PREDICTED`/`documented_model` without registered model or incomplete identity | Quarantined as historical/unverified; warning shown |

**Important:** `PREDICTED` alone is insufficient. Classifier + sanitizer enforce this.

---

## 8. Browser testing results

| Item | Status |
|------|--------|
| Existing Playwright/Cypress/Vitest browser suite | **NOT IMPLEMENTED** (not in package.json) |
| Cursor browser against `http://localhost:3000` | **NOT VERIFIABLE** — connection failed (`chrome-error://`); app server not running |
| Recommendation | Smallest addition later: Playwright against a seeded study; do not invent a heavy framework now |

All browser acceptance scenarios in the checklist are marked **Not Tested**.

---

## 9. Researcher acceptance checklist

Created: [`docs/HEPATOTEA_REVISION_03_RESEARCHER_ACCEPTANCE_CHECKLIST.md`](./HEPATOTEA_REVISION_03_RESEARCHER_ACCEPTANCE_CHECKLIST.md)

No checklist item is marked Pass by engineering in this revision.

---

## 10. Regression test results

### Commands executed

```bash
npm test
npx tsc --noEmit
npm run build
npm run lint   # interactive ESLint setup prompt — not completed
```

Focused integrity suite also executed (included in `npm test`).

### Results

| Check | Result |
|-------|--------|
| `npm test` | **242 passed / 0 failed / 0 skipped** |
| `tsc --noEmit` | **Pass** |
| `npm run build` | **Pass** (Next.js 15.5.26) |
| `npm run lint` | **NOT VERIFIABLE** — `next lint` prompts to configure ESLint; no committed ESLint config |

No unrelated failing suites were observed.

---

## 11. Acceptance criteria table

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Actual Next route enforces auth/authz/ack | **VERIFIED** | `route.ts` + `predictionsRoute.test.ts` |
| Validated mode never falls back to exploratory | **VERIFIED** | Handler + route tests |
| Ack metadata consistent with run id + session actor | **VERIFIED** | create/update bind + persistence tests |
| Legacy metrics cannot masquerade as experimental | **VERIFIED** | sanitizer + consumer wiring + tests |
| Provenance cannot be mistaken for validated science | **VERIFIED** | provenance classifier + unverified PREDICTED path |
| Experimental DPPH/LDH intact | **VERIFIED** | formulas untouched; lab tests pass |
| Browser RAT executed or NOT VERIFIABLE | **NOT VERIFIABLE** | localhost unreachable |
| Automated tests/build reported accurately | **VERIFIED** | §10 |
| Researcher checklist available | **VERIFIED** | checklist doc |
| Software readiness ≠ scientific validation | **VERIFIED** | stated throughout |

---

## 12. Remaining limitations

1. Browser E2E not executed; researcher must complete checklist.
2. Live MySQL insert-failure injection not covered in CI.
3. Treatment duration still absent; HBD/TPSA path still limited (pre-existing).
4. No prediction PDF/CSV exporters to sanitize (none exist).
5. ESLint not configured for non-interactive `npm run lint`.
6. Six modules remain scientifically unvalidated by design.

---

## 13. Final readiness assessment

| Area | Assessment |
|------|------------|
| Exploratory prediction software path (auth, ack, display, provenance) | **Ready for researcher acceptance testing** of remediated UX |
| Validated predictive claims | **Not ready** — no registered models |
| Experimental DPPH/LDH processing | **Ready** (unchanged formulas) |
| Browser-confirmed RAT | **Pending researcher execution** |

**Blocking for exploratory + lab RAT:** none identified in automated verification.  
**Blocking for claiming scientific predictive validation:** all six computational bioactivity modules.
