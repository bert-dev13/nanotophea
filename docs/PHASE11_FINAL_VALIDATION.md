# Phase 11 — Final Integration, Hardening & Validation

**Date:** 2026-09-29  
**Binding source of truth:** `docs/STUDY_DESIGN_CONTRACT.md`  
**Scope:** Audit, harden, secure, test, polish, and validate NANOTOPHEA for researcher/adviser testing  
**Status:** Complete — ready for researcher testing with real study data  

**This phase did not add new scientific modules.**

**Build:** `npm run build` succeeds (all active routes compile)  
**Tests:** `npm test` — **48/48 pass**  
**Reports:** remain removed (`/reports` absent from navigation and routes)

---

## 1. Final architecture

```text
Auth (Firebase Auth)
  → Study membership (studies/{id}/members/{uid})
  → Active study (localStorage nanotophea.activeStudyId)
  → Study-scoped Firestore subcollections

Research Data (REFERENCE / LITERATURE)
  → In-Silico imports (PREDICTED / SIMULATION / LITERATURE / REFERENCE)
  → Laboratory datasets + raw replicates (EXPERIMENTAL)
  → Statistics derived from EXPERIMENTAL only
  → Comparison preserves computational + experimental classes separately
  → Researcher Interpretation (INTERPRETATION) links evidence manually
```

Stack: Next.js 15 App Router, React 19, Firebase Auth + Firestore (client), Zod, Recharts, Tailwind 4.

Firebase Admin is **scripts-only** (`lib/firebase/admin.ts`, `scripts/seed-admin.ts`). It is not used by the active app UI path.

---

## 2. Active routes

| Route | Module | Collection / notes |
|-------|--------|-------------------|
| `/` | Dashboard / Study Home | Study list + scientific notice |
| `/research/formulation` | Formulation | `formulations` |
| `/research/phytochemicals` | Phytochemicals | `compounds` |
| `/research/proteins` | Target proteins | `proteins` |
| `/research/cell-lines` | Cell lines | `cellLines` |
| `/research/references` | References | `references` |
| `/insilico/admet` | ADMET | Placeholder UI (import workspace not built; `admetRuns` schema/rules ready) |
| `/insilico/docking` | Molecular Docking | `dockingRuns` (manual Vina import) |
| `/insilico/predictions/{dpph,mtt,ldh,ros,bax,yap}` | Predictions | `predictionRuns` |
| `/insilico/predictions/hippo-yap` | Redirect | → `/insilico/predictions/yap` |
| `/lab/dpph` | Experimental DPPH | `labDatasets` + `replicates` |
| `/lab/ldh` | Experimental LDH | `labDatasets` + `replicates` |
| `/lab/characterization` | Characterization | `labDatasets` (characterization payload) |
| `/analysis/statistics` | Statistics | `statistics` |
| `/analysis/compare` | Prediction vs Experimental | `comparisons` |
| `/analysis/interpretation` | Researcher Interpretation | `interpretations` |

**Not present:** `/reports`, Dosage Planner, PDF/Excel export routes.

---

## 3. Firestore collections

Under `studies/{studyId}/`:

| Subcollection | Purpose |
|---------------|---------|
| `members` | Study roles |
| `formulations` | Formulation identity |
| `compounds` | Phytochemicals |
| `proteins` | Target proteins |
| `cellLines` | Cell lines |
| `references` | Citations |
| `admetRuns` | ADMET imports (rules + schema; UI placeholder) |
| `dockingRuns` | Docking imports |
| `predictionRuns` | Endpoint predictions |
| `labDatasets` | Lab datasets |
| `labDatasets/{id}/replicates` | Raw experimental replicates |
| `statistics` | ANOVA / Scheffé analyses |
| `comparisons` | Prediction vs experimental records |
| `interpretations` | Researcher narratives |
| `auditLogs` | Append-only audit |

Top-level: `users/{userId}`, `studies/{studyId}`.

---

## 4. Role matrix

| Action | OWNER | COLLABORATOR | ADVISER | VIEWER | Unauthenticated |
|--------|-------|--------------|---------|--------|-----------------|
| Read study data | ✓ | ✓ | ✓ | ✓ | ✗ |
| Create/edit scientific records | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage members / study metadata | ✓ | ✗ | ✗ | ✗ | ✗ |
| Write audit logs | ✓ | ✓ | ✗ | ✗ | ✗ |

**Security boundary:** `firestore.rules` (`canWriteResearch` = OWNER | COLLABORATOR). UI hide/disable is UX only.

**Phase 11 fix:** comparisons and interpretations previously allowed ADVISER write via a separate rule helper; they now use `canWriteResearch` so ADVISER/VIEWER are read-only, matching UI permissions.

---

## 5. Evidence-class matrix

| Module | Allowed classes |
|--------|-----------------|
| Research identity / references | REFERENCE, LITERATURE |
| ADMET (when imported) | PREDICTED, LITERATURE, REFERENCE |
| Docking (Vina import) | PREDICTED |
| Prediction workspace | PREDICTED, SIMULATION |
| Laboratory | EXPERIMENTAL |
| Statistics | derived from EXPERIMENTAL (provenance EXPERIMENTAL) |
| Comparison | preserves computational + experimental separately |
| Interpretation | INTERPRETATION |

Classes are never silently converted (e.g. PREDICTED ↛ EXPERIMENTAL).

---

## 6. Scientific integrity audit

Searched active `lib/`, `components/`, `app/` (excluding `_archive`, `node_modules`, `.next`):

| Check | Result |
|-------|--------|
| `Math.random()` scientific values | Not found in active science paths |
| Fake IC50 / docking ΔG / RMSD / confidence | Not generated by active modules |
| Fake AI/CNN claims | Absent |
| Automatic hypothesis conclusions | Absent — researcher selects assessment manually |
| Dosage / clinical recommendations | Absent |
| Reports / PDF / Excel | Absent |
| Active imports from `_archive` | None |

Archived legacy may remain under `_archive` only if quarantined (not imported).

**Infinite statistics:** ANOVA/Scheffé Infinity is stored as `Number.MAX_VALUE` (`INFINITE_STAT_SENTINEL`) because Firestore rejects Infinity; UI displays `∞` via `formatStatNumber` / `isInfiniteStatDisplay`.

---

## 7. Security review (`firestore.rules`)

| Rule | Status |
|------|--------|
| Unauthenticated cannot access study data | ✓ |
| Membership required for read | ✓ (`canReadStudy`) |
| Study create requires ownerId + memberIds bootstrap | ✓ |
| OWNER manages study + members | ✓ |
| Scientific write = OWNER/COLLABORATOR | ✓ |
| ADVISER/VIEWER read-only | ✓ |
| Cross-study access by ID alone | Blocked without membership |
| `auditLogs` create-only for writers | ✓ |

Deploy rules to the Firebase project before production researcher testing:

```bash
firebase deploy --only firestore:rules
```

---

## 8. Study-isolation review

- All repositories use `studySub(studyId, …)` / `labReplicatesPath(studyId, datasetId)`.
- UI modules read/write only via `activeStudy.id`.
- Active study id stored in `localStorage` key `nanotophea.activeStudyId`; cleared on logout / empty study list.
- Dropdowns and evidence libraries are study-scoped query results.
- Tests assert Study A paths never equal Study B paths.

---

## 9. Unit audit

| Context | Unit |
|---------|------|
| In-silico DPPH | µM |
| Experimental DPPH | µg/mL |
| In-silico LDH | µg/mL |
| Experimental LDH | µg/mL |
| Experimental T3–T6 | 50 / 100 / 250 / 500 µg/mL |

Comparison logic: DPPH is side-by-side only (no µM ↔ µg/mL conversion). LDH may align when units and concentrations match.

---

## 10. Provenance audit

Scientific records carry `provenance.evidenceClass` plus method/source fields as applicable. Missing provenance is shown rather than invented. Interpretation links store source fingerprints and freshness (`CURRENT` / `STALE`).

---

## 11. Stale-data behavior

| Layer | Trigger | Effect |
|-------|---------|--------|
| Statistics | Lab dataset / replicate fingerprint change | STALE / requires recalculation |
| Comparison | Prediction / lab / statistics fingerprint change | STALE / requires review |
| Interpretation | Linked evidence change or missing source | STALE / requires review |

Downstream records are **never** auto-rewritten when upstream data changes.

---

## 12. Timestamp consistency

ISO strings used for scientific/application timestamps (`createdAt`, `updatedAt`, `calculatedAt`, `dateGenerated`, `datePerformed`, `selectedAt`). Fingerprints use stored string timestamps. Firestore `Timestamp` objects are not mixed into fingerprint inputs in active repositories.

---

## 13. Validation

Zod schemas enforce evidence classes, endpoints, units where modeled, and reject invalid enums. Missing measurements are not coerced to zero. NaN/Infinity are guarded before Firestore writes (Infinity → sentinel for stats only).

---

## 14. Error handling / empty states

- `lib/errors/userFacing.ts` maps permission-denied, unavailable, unauthenticated, missing study/source to short researcher messages (no stack traces).
- Applied across StudyProvider and scientific workspaces/catalogs.
- Empty states use honest copy (e.g. no computational/lab/statistics/comparison/interpretation records) without seeding fake science.

---

## 15. Test results

```text
npm test → 48/48 pass
```

Coverage includes:

- ANOVA / Scheffé / descriptive / F distribution
- DPPH unit separation & LDH alignment
- Comparison fingerprints / stale
- Interpretation fingerprints / evidence-class guards / no auto-conclusions
- Phase 11 boundaries: permissions, study paths, infinite sentinel, user-facing errors

```text
npm run build → success (24 static routes)
```

---

## 16. Manual QA checklist

Use **empty/manual** values. Do **not** seed fake scientific results.

### Authentication
- [ ] Sign up / sign in works with configured Firebase Auth
- [ ] Sign out clears active study selection
- [ ] Unauthenticated users cannot load study scientific pages meaningfully

### Study creation
- [ ] Create study as OWNER
- [ ] Active study selector switches studies
- [ ] Study A data does not appear under Study B

### Research Data
- [ ] Formulation / phytochemicals / proteins / cell lines / references CRUD for OWNER/COLLABORATOR
- [ ] ADVISER/VIEWER read-only (no save)
- [ ] Evidence badges show REFERENCE/LITERATURE as appropriate

### ADMET
- [ ] Page loads with placeholder / contract note (no invented ADMET numbers)

### Docking
- [ ] Import manual Vina run (PREDICTED)
- [ ] Cannot invent affinities without researcher input
- [ ] Read-only roles cannot save

### Predictions
- [ ] DPPH / MTT / LDH / ROS / BAX / Hippo–YAP import or record runs
- [ ] Units labeled correctly (DPPH µM; LDH µg/mL)

### Lab DPPH / LDH / Characterization
- [ ] Create dataset + raw replicates
- [ ] T3–T6 concentrations 50/100/250/500 µg/mL
- [ ] Missing replicates remain missing (not zero-filled)
- [ ] Evidence class EXPERIMENTAL

### Statistics
- [ ] Run ANOVA/Scheffé on experimental DPPH or LDH
- [ ] Change lab data → analysis marked STALE
- [ ] Recalculate restores CURRENT without inventing data
- [ ] Infinite F (zero within-MS) displays as ∞

### Comparison
- [ ] DPPH: side-by-side only; notice that µM ≠ µg/mL
- [ ] LDH: aligned when units/concentrations match
- [ ] Stale when sources change

### Interpretation
- [ ] Author narrative; link evidence; manual hypothesis assessment
- [ ] Stale when linked sources change/disappear
- [ ] No automatic conclusion text

### Permissions
- [ ] ADVISER cannot write scientific collections (Firestore deny)
- [ ] OWNER can manage membership where UI supports it

### Responsive / a11y smoke
- [ ] Desktop / tablet / mobile: sidebar collapses; study selector reachable
- [ ] Tables scroll; dialogs fit viewport; focus visible on controls

### Error handling
- [ ] Wrong study membership → clear permission message
- [ ] Offline / Firebase unavailable → clear connection message

---

## 17. Remaining known limitations (not bugs)

The system still does **not**:

- Execute AutoDock Vina internally
- Automatically run SwissADME
- Contain validated internal predictive models unless explicitly documented and added
- Upload laboratory / PDBQT / pose files
- Use Firebase Storage in the app path
- Use Firebase Admin SDK in the browser app
- Automatically interpret scientific findings
- Provide clinical or dosage recommendations
- Generate Reports / PDF / Excel
- Provide a full ADMET import workspace UI (placeholder only; schema/rules exist)

---

## 18. Deployment prerequisites

1. Firebase project with Auth + Firestore enabled  
2. `.env.local` from `.env.example` (`NEXT_PUBLIC_FIREBASE_*`)  
3. Deploy `firestore.rules` (and indexes if required by queries)  
4. Optional: `service.json` + `npm run seed:admin` for bootstrap users (server scripts only)  
5. `npm install` → `npm test` → `npm run build` → `npm start` (or host Next.js)

---

## 19. Files modified / added in Phase 11

### Added
- `lib/errors/userFacing.ts`
- `lib/statistics/statDisplay.ts`
- `lib/phase11/phase11.test.ts`
- `docs/PHASE11_FINAL_VALIDATION.md`
- `README.md` (project root)

### Updated (selected)
- `firestore.rules` — ADVISER/VIEWER read-only on comparisons/interpretations
- `lib/repositories/statisticsRepository.ts` — infinite sentinel helper
- `components/providers/StudyProvider.tsx` — user-facing errors; clear active study on logout
- `components/analysis/*Workspace.tsx` — error mapping; ∞ display
- Lab / docking / prediction / research panels — user-facing errors
- `package.json` — include Phase 11 tests

### Removed
- Temporary patch script (not retained)
- No scientific modules or Reports added

---

## 20. Completion statement

Phase 11 audits, fixes, tests, production build, documentation, and manual QA checklist are complete.

**STOP.** No further development phase is started from this document.

NANOTOPHEA is ready for researcher/adviser testing with real study data under the Study Design Contract.
