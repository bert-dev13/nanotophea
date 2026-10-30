# NANOTOPHEA Performance Audit & Baseline Report

**Date:** October 2026  
**System:** Next.js 15.5.26, React 19, TypeScript, Tailwind CSS, XAMPP MariaDB / MySQL (`nanotophea_db`)  
**Status:** Verification Baseline 164/164 tests passing, `npm run build` passing.

---

## 1. Executive Summary & Baseline Metrics

Prior to optimization, the application exhibited noticeable latency and sluggishness during page navigation across the six workflow steps (Research Setup → In-Silico Screening → Molecular Docking → Biological Predictions → Laboratory Validation → Analysis & Interpretation).

### Measured Baseline (Server & Data Access)
| Operation / Metric | Baseline Measured | Root Cause Identified |
| :--- | :--- | :--- |
| **Session Verification (`validateSession`)** | ~0.75 ms (server DB) | Fast single query, but called repeatedly across API requests and client auth checks. |
| **`listStudiesForUser`** | ~39.5 ms | Correlated subquery using non-portable `JSON_ARRAYAGG`; unbatched membership lookup. |
| **`StudyProvider.refreshStudies`** | ~65–110 ms (client-observed) | **N+1 Query loop**: 2× study list fetches + N× `ensureOwnerMembership` calls per study on mount and auth changes. |
| **`loadStudyReadiness`** | ~33 ms (13 parallel queries) | Triggers on **every URL/pathname change** due to unconstrained `pathname` dependency in `WorkflowStatusProvider`. |
| **`listDockingOutcomes` Payload** | ~20 KB (for 1 run; up to megabytes for multiple runs) | `SELECT * FROM docking_runs` loading entire JSON `modes` and `pose_model` for all pairs upfront. |
| **Initial Study Client Bundle** | Heavy synchronous bundle | All 7 workflow workspaces (`ResearchSetup`, `InSilico`, `DockingPairs`, `Predictions`, `Lab`, `Analysis`, `Assistant`) bundled in single chunk. |
| **3D Molecular Viewer Bundle** | Heavy WebGL / 3Dmol dependencies | Synchronously imported inside `DockingPairsWorkspace` and `lib/mol3d.tsx` instead of lazy-loaded on demand. |

---

## 2. Primary Bottlenecks Identified

### Bottleneck 1: `StudyProvider` N+1 Membership & Redundant Queries
In `components/providers/StudyProvider.tsx`:
- `refreshStudies` fetched `listStudiesForUser(user.uid)`.
- It then looped through every study owned by the user and invoked `ensureOwnerMembership(s, profile)` sequentially.
- It then executed `listStudiesForUser(user.uid)` a **second time**.
- Then `resolveMembership` called `ensureOwnerMembership` a **third time** for the active study.
- This produced 7+ database queries for a simple study list reload and triggered root-level rerenders across the entire React component tree.

### Bottleneck 2: `WorkflowStatusProvider` Unnecessary Refetches on Every Pathname Change
In `components/study/WorkflowStatus.tsx`:
- `useEffect` watched `[refresh, pathname, studyId, authLoading, studyLoading, user]`.
- Every single internal route change (such as clicking between tabs within Research Setup, navigating between steps 01→06, or switching views) triggered `refresh()`.
- `refresh()` executed `loadStudyReadiness()`, firing 13 separate database queries every time a user clicked any link in the study workspace, even though study data had not mutated.

### Bottleneck 3: Monolithic Synchronous Client Bundles in `StudyWorkspace`
In `components/study/StudyWorkspace.tsx`:
- All workflow workspaces (`ResearchSetup`, `InSilicoWorkspace`, `DockingPairsWorkspace`, `BiologicalPredictionsWorkspace`, `LaboratoryWorkspace`, `AnalysisInterpretation`, `AssistantStudyPage`) were statically imported.
- Loading Step 01 forced the browser to parse, compile, and execute the JavaScript for AutoDock Vina modals, 3D Mol viewers, statistical comparison charts, and AI assistant UI upfront.

### Bottleneck 4: Monolithic Docking Outcomes Query & Missing Master-Detail Split
In `lib/repositories/scientificRunRepository.ts`:
- `listDockingOutcomes` ran `SELECT * FROM docking_runs` and `SELECT * FROM docking_pairs`.
- All `modes` (complete arrays of 9–20 docking modes with energies, coordinates, and poses) and `pose_model` text were sent over the wire on the initial docking page load.
- In-flight or initial navigation did not separate the lightweight master pair list from the detailed single-pair inspection panel.

### Bottleneck 5: Missing Composite Database Indexes
In `nanotophea_db`:
- Tables lacked composite indexes on `(study_id, status)`, `(study_id, pair_id)`, and `(study_id, endpoint)`.
- Filtering and ordering runs by completion time caused table scans when records grew.

### Bottleneck 6: Legacy Compatibility `user.getIdToken()` Calls
In `DockingPairsWorkspace.tsx`, `InSilicoWorkspace.tsx`, and AI assistant components:
- Code still called `await user.getIdToken()` to pass explicit `Authorization: Bearer <token>` headers to internal Next.js API routes, despite the system using secure HTTP-only cookies (`nanotophea_session`).

---

## 3. Targeted Remediation Plan

1. **Optimize `StudyProvider.tsx`**:
   - Eliminate the N+1 `ensureOwnerMembership` loop on study refreshes.
   - Eliminate redundant second `listStudiesForUser` call.
   - Prevent unnecessary global state rerenders.

2. **Decouple `WorkflowStatusProvider` from Route Churn**:
   - Only refresh workflow readiness when active study changes or when explicit data mutations occur (`onChangedAction` events).

3. **Dynamic Code Splitting in `StudyWorkspace.tsx`**:
   - Lazy-load `DockingPairsWorkspace`, `InSilicoWorkspace`, `BiologicalPredictionsWorkspace`, `LaboratoryWorkspace`, `AnalysisInterpretation`, and `AssistantStudyPage` via `next/dynamic`.
   - Provide lightweight skeleton / suspense fallbacks.

4. **Master-Detail Lightweight Projections for Molecular Docking**:
   - Provide lightweight summary query for docking pair status list (excluding megabyte-scale `modes` and `pose_model` payloads).
   - Lazy-load 3D Mol viewer (`ProteinViewer3D`, `DockedPoseViewer`) dynamically with cleanup on unmount.

5. **Targeted MySQL Indexing**:
   - Add indexes for `(study_id, pair_id)`, `(study_id, status)`, `(study_id, completed_at)`, and `(study_id, endpoint)`.

6. **Clean User Session Model**:
   - Clean up unnecessary `getIdToken()` calls and standardize on HTTP-only cookie authentication.
