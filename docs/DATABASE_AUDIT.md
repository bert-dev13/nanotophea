# NANOTOPHEA Database Audit: Firestore Implementation

This document provides a comprehensive audit of the Firestore database implementation in NANOTOPHEA, identifying all Firebase configurations, collections, documents, subcollections, repositories, operations, API routes, schemas, and authentication usages based on the actual codebase and live database inspection.

---

## 1. Firebase Configuration

### Client Configuration
- **File**: `lib/firebase/config.ts`, `lib/firebase/client.ts`
- **Environment Variables**:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
- **Initialization**:
  - Lazy browser-only initialization via `getFirebaseApp()`, `getFirebaseAuth()`, and `getFirebaseDb()`.

### Server / Admin Configuration
- **File**: `lib/firebase/admin.ts`
- **Credentials Resolution Order**:
  1. `FIREBASE_SERVICE_ACCOUNT` (JSON string)
  2. `GOOGLE_APPLICATION_CREDENTIALS` (File path)
  3. `FIREBASE_SERVICE_ACCOUNT_PATH` (File path)
  4. `./service.json` at repository root
- **Initialization**:
  - `getAdminAuth()` for verifying ID tokens.
  - `getAdminDb()` for server-side Firestore operations.

---

## 2. Top-Level Collections & Documents

| Collection | Description | Document ID Scheme | Actual Count in Firestore |
|---|---|---|---|
| `users` | User profiles linked to Firebase Auth UID | Firebase Auth `uid` (string) | 1 record (`g1dxux39lfeAb8RbvLEWgQ1IH6f2`) |
| `studies` | Top-level research studies | Auto-generated Firestore ID (20 chars) | 4 records (`GuxwqeU3vnoP5P4xvRLJ`, `RcO2qL5gqBH0snUpqURy`, `Tqw6jOLPR2rPCl7eNdWj`, `yBJQX1TvW3GLJJqQnS10`) |
| `literatureCache` | Cached PubMed query responses | MD5 hash of query endpoint/compound | 6 records |

---

## 3. Subcollections under `studies/{studyId}`

All study-scoped scientific and workflow records reside in subcollections under `studies/{studyId}`:

| Subcollection | Domain Entity / Schema | ID Scheme | Actual Count in DB | Relationships & Constraints |
|---|---|---|---|---|
| `members` | `StudyMemberSchema` | `userId` (Firebase Auth UID) | 4 (1 per study) | FK to `users.id`, role: `OWNER`, `COLLABORATOR`, `ADVISER`, `VIEWER` |
| `formulations` | `FormulationSchema` | Firestore doc ID | 0 | Belongs to `studyId`, referenced by lab datasets |
| `compounds` | `CompoundSchema` | Firestore doc ID | 4 | Belongs to `studyId`, phytochemical (Quercetin, etc.) |
| `proteins` | `ProteinSchema` | Firestore doc ID | 5 | Belongs to `studyId`, target protein (BAX, BCL-2, LATS1, etc.) |
| `cellLines` | `CellLineSchema` | Firestore doc ID | 4 | Belongs to `studyId`, cell line (HepG2, etc.) |
| `admetRuns` | `AdmetRunSchema` | Firestore doc ID | 2 | Belongs to `studyId`, links to `compoundId` |
| `dockingPairs` | `DockingPairSchema` | Canonical `${compoundId}__${proteinId}` | 4 | Unique logical pair per study + compound + protein |
| `dockingRuns` | `DockingRunSchema` | Firestore doc ID / UUID | 4 | 1-to-many runs under logical docking pair |
| `dockingJobs` | `DockingJobRecord` | `${compoundId}__${proteinId}` | 4 | Asynchronous job status for Vina execution |
| `predictionRuns` | `PredictionRunSchema` | Firestore doc ID | 14 | In-silico biological predictions per endpoint |
| `labDatasets` | `LabDatasetSchema` | Firestore doc ID | 0 | Laboratory validation assays (DPPH, MTT, LDH, etc.) |
| `labDatasets/{id}/replicates` | `LabReplicateSchema` | Firestore doc ID | 0 | Subcollection of `labDatasets`. Raw plate/assay replicates |
| `statistics` | `StatisticsRecordSchema` | Firestore doc ID | 0 | ANOVA and Scheffé post-hoc analysis records |
| `comparisons` | `ComparisonRecordSchema` | Firestore doc ID | 0 | In-silico vs Experimental comparisons |
| `interpretations` | `InterpretationSchema` | Firestore doc ID | 0 | Researcher-authored findings and hypothesis assessments |
| `references` | `ReferenceRecordSchema` | Firestore doc ID | 0 | Literature citations and references |
| `auditLogs` | `AuditLogSchema` | Firestore doc ID | 61 | Append-only audit trail per study |

---

## 4. Repositories Audit

The codebase encapsulates database interactions inside repository modules in `lib/repositories/`:

1. **`userRepository.ts`**:
   - `getUserProfile(userId)` -> `getDocData(users, userId)`
   - `upsertUserProfile(input)` -> `setDocData(users, id, data)`
   - `updateUserProfile(userId, patch)` -> `updateDocData(users, userId, patch)`

2. **`studyRepository.ts`**:
   - `createStudy(owner, input)` -> `setDocData(studies, id)` + `setDocData(studies/{id}/members, ownerId)`
   - `getStudy(studyId)` -> `getDocData(studies, studyId)`
   - `listStudiesForUser(userId)` -> `listDocs(studies, where("memberIds", "array-contains", userId))`
   - `updateStudy(studyId, actorId, input)` -> `updateDocData(studies, studyId, input)`
   - `getStudyMember(studyId, userId)` -> `getDocData(studies/{id}/members, userId)`
   - `listStudyMembers(studyId)` -> `listDocs(studies/{id}/members)`

3. **`researchDataRepository.ts`**:
   - CRUD for `formulations`, `compounds`, `proteins`, `cellLines`, `references`.
   - Methods: `list<Entity>(studyId)`, `get<Entity>(studyId, id)`, `create<Entity>(studyId, actor, input)`, `update<Entity>(studyId, id, actor, patch)`, `delete<Entity>(studyId, id, actor)`.

4. **`scientificRunRepository.ts`**:
   - `createAdmetRun`, `listAdmetRuns`, `savePrototypeAdmeRun`
   - `getDockingPair`, `listDockingPairs`, `upsertDockingPair`
   - `createDockingRun`, `listDockingRuns`, `listDockingOutcomes`
   - `createSkippedDockingPair`, `deleteDockingRun`
   - `createPredictionRun`, `listPredictionRuns`, `getPredictionRun`, `deletePredictionRun`

5. **`labRepository.ts`**:
   - `createLabDataset`, `getLabDataset`, `listLabDatasets`, `updateLabDataset`, `deleteLabDataset`
   - `saveLabReplicate`, `listLabReplicates`, `bulkSaveLabReplicates`, `deleteLabReplicate`

6. **`statisticsRepository.ts`**:
   - `createStatisticsAnalysis`, `getStatisticsAnalysis`, `listStatisticsAnalyses`, `deleteStatisticsAnalysis`, `evaluateStatisticsFreshness`

7. **`comparisonRepository.ts`**:
   - `createComparison`, `getComparison`, `listComparisons`, `updateComparison`, `deleteComparison`, `evaluateComparisonFreshness`

8. **`interpretationRepository.ts`**:
   - `createInterpretation`, `getInterpretation`, `listInterpretations`, `updateInterpretation`, `deleteInterpretation`, `evaluateInterpretationFreshness`

9. **`auditRepository.ts`**:
   - `writeAuditLog`, `listAuditLogs`

---

## 5. Firestore Operations Inventory

- `getDoc` / `getDocData`: Used across all repositories for reading single records by ID.
- `getDocs` / `listDocs`: Used for listing records within subcollections, filtered by constraints (`where`).
- `setDoc` / `setDocData`: Used for creating/upserting records with known IDs (e.g. users, members, dockingPairs, dockingJobs).
- `updateDoc` / `updateDocData`: Used for updating partial document fields with `updatedAt`.
- `deleteDoc` / `deleteDocData`: Used for record deletion.
- `writeBatch` / `commitBatch`: Implemented in `lib/firebase/firestore.ts`.
- `onSnapshot`: **NOT USED** anywhere in the application. All updates are request/response based.

---

## 6. API Routes & Server Touchpoints

- `app/api/scientific/docking/jobs/route.ts`: Runs AutoDock Vina jobs, tracks status via `services/docking/jobs.ts`, writes runs and canonical docking pairs.
- `app/api/scientific/docking/engine/route.ts`: Checks Vina engine binary readiness.
- `app/api/scientific/adme/route.ts`: Computes/retrieves ADME descriptors and persists `admetRuns`.
- `app/api/scientific/predictions/route.ts`: Computes biological predictions for endpoints (DPPH, MTT, LDH, ROS, BAX, Hippo-YAP).
- `app/api/scientific/pubchem/[cid]/route.ts`: PubChem proxy.
- `app/api/scientific/pubchem/[cid]/structure/route.ts`: PubChem 3D SDF structure proxy.
- `app/api/scientific/pubmed/route.ts`: PubMed search proxy, caches queries in `literatureCache`.
- `app/api/scientific/rcsb/[pdbId]/route.ts`: RCSB PDB metadata proxy.
- `app/api/scientific/rcsb/[pdbId]/structure/route.ts`: RCSB PDB structure proxy.
- `app/api/ai/chat/route.ts`: AI chat and interpretation generation using study context.

---

## 7. TypeScript Interfaces & Zod Schemas

Defined primarily in `lib/domain/models.ts` and `lib/domain/provenance.ts`:
- **Core Entities**: `UserProfileSchema`, `StudySchema`, `StudyMemberSchema`, `FormulationSchema`, `CompoundSchema`, `ProteinSchema`, `CellLineSchema`.
- **Docking**: `DockingModeSchema`, `DockingSearchBoxSchema`, `DockingPairSchema`, `DockingRunSchema`, `SkippedDockingPairSchema`, `ApprovedDockingConfigurationSchema`.
- **Predictions**: `PredictionRunSchema`, `PredictionResultPointSchema`.
- **Laboratory**: `LabDatasetSchema`, `LabReplicateSchema`, `LabObservationSchema`, `LabTreatmentSummarySchema`, `HplcResultsSchema`, `ProximateResultsSchema`, `NutritiveResultsSchema`, `PbResultsSchema`, `SensoryResultsSchema`, `MicrobialResultsSchema`, `StabilityResultsSchema`.
- **Analysis**: `StatisticsRecordSchema`, `ComparisonRecordSchema`, `InterpretationSchema`.
- **Governance**: `ProvenanceSchema`, `EvidenceTypeSchema`, `AuditLogSchema`.

---

## 8. Firebase Auth Usage

- Handled in `components/providers/AuthProvider.tsx` via `onAuthStateChanged`, `signInWithEmailAndPassword`, `signOut`.
- User identity is tied to `user.uid`.
- User record in `users` collection stores `{ id: user.uid, email, displayName, photoURL, defaultRole, createdAt, updatedAt }`.
- API routes verify tokens via `getAdminAuth().verifyIdToken(...)`.
- **Retention Requirement**: Firebase Authentication is kept strictly for authentication/login. The Firebase UID is stored in MySQL `users.id` / `users.firebase_uid`.
