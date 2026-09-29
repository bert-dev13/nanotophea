# Phase 2 — Firebase Integration Summary

**Date:** 2026-09-29  
**Scope:** Auth + Firestore only (no Storage, no scientific engines)  
**Build:** `npm run build` succeeded with `.env.local` loaded  

---

## 1. Firebase files created

| Path | Purpose |
|------|---------|
| `lib/firebase/config.ts` | Reads `NEXT_PUBLIC_FIREBASE_*` env vars |
| `lib/firebase/client.ts` | Lazy browser-only Firebase App / Auth / Firestore init |
| `lib/firebase/firestore.ts` | Thin Firestore helpers |
| `lib/firebase/paths.ts` | Collection / subcollection path constants |
| `lib/domain/provenance.ts` | Evidence classes + provenance + future artifact refs |
| `lib/domain/models.ts` | Zod schemas + TypeScript domain models |
| `lib/repositories/userRepository.ts` | User profiles |
| `lib/repositories/studyRepository.ts` | Studies + members |
| `lib/repositories/researchDataRepository.ts` | Formulation / compounds / proteins / cell lines / references |
| `lib/repositories/scientificRunRepository.ts` | ADMET / docking / prediction run shells |
| `lib/repositories/labRepository.ts` | Lab datasets + replicates |
| `lib/repositories/interpretationRepository.ts` | Interpretations / stats / comparisons |
| `lib/repositories/auditRepository.ts` | Audit logs |
| `lib/repositories/index.ts` | Barrel export |
| `components/providers/AuthProvider.tsx` | Auth state, login/register/logout |
| `components/providers/StudyProvider.tsx` | Study list / active study / create |
| `components/auth/LoginScreen.tsx` | Email/password UI |
| `components/study/StudyToolbar.tsx` | Study selector, create, logout, role badge |
| `firestore.rules` | Security rules |
| `firebase.json` | Points to Firestore rules |
| `.env.example` | Env template (no Storage bucket) |
| `.env.local` | Local Firebase web config (gitignored) |

---

## 2. Environment variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

- Config is **not** hardcoded in components.
- **STORAGE_BUCKET** intentionally omitted (Storage out of scope).
- `.env.local` is gitignored; `.env.example` is tracked (`!.env.example`).

---

## 3. Authentication flow

1. App mounts client-side only → `AuthProvider` initializes Firebase Auth.
2. Unauthenticated users see `LoginScreen` (login or create account).
3. Email/password via Firebase Auth.
4. On first sign-in / register → `users/{uid}` profile upserted.
5. Authenticated shell shows header + `StudyToolbar` + Phase 1 navigation.
6. Logout clears session and returns to login.

**Roles (study membership, not global):** `OWNER` | `COLLABORATOR` | `ADVISER` | `VIEWER`

**Console prerequisite:** Enable **Email/Password** under Firebase Authentication.

---

## 4. Firestore collections

```text
users/{userId}

studies/{studyId}
  members/{memberId}
  formulations/{formulationId}
  compounds/{compoundId}
  proteins/{proteinId}
  cellLines/{cellLineId}
  admetRuns/{runId}
  dockingRuns/{runId}
  predictionRuns/{runId}
  labDatasets/{datasetId}
    replicates/{replicateId}
  statistics/{analysisId}
  comparisons/{comparisonId}
  interpretations/{interpretationId}
  references/{referenceId}
  auditLogs/{logId}
```

---

## 5. Domain models (Zod-validated)

Core entities in `lib/domain/models.ts`:

- `UserProfile`, `Study`, `StudyMember`
- Research: `Formulation`, `Compound`, `Protein`, `CellLineRecord`, `ReferenceRecord`
- Runs: `AdmetRun`, `DockingRun`, `PredictionRun`
- Lab: `LabDataset`, `LabReplicate`
- Analysis: `StatisticsRecord`, `ComparisonRecord`, `Interpretation`
- `AuditLog`

---

## 6. Evidence / provenance structure

Every scientific record carries `provenance` (`lib/domain/provenance.ts`):

- `evidenceClass`: `REFERENCE` | `LITERATURE` | `PREDICTED` | `EXPERIMENTAL` | `INTERPRETATION` | `SIMULATION`
- Optional method/source/citation/lab/protocol/assumptions
- Optional `artifacts[]` reserved for **future** Storage/URL attachments (unused now)

---

## 7. Security rules (summary)

| Actor | Access |
|-------|--------|
| Unauthenticated | No study data |
| Study member | Read study + subcollections |
| OWNER | Full write; manage members; create/update study |
| COLLABORATOR | Write research / runs / lab / references |
| ADVISER | Read all; write interpretations + comparisons |
| VIEWER | Read-only |

Bootstrap: creator may write own `members/{uid}` with role `OWNER` when creating a study.

Deploy rules: `firebase deploy --only firestore:rules` (requires Firebase CLI login).

---

## 8. Study creation / loading flow

1. User clicks **New study** in toolbar.
2. `createStudy(profile, input)` writes `studies/{id}` with `ownerId`, `memberIds: [uid]`, contract defaults (HepG2, 2 g + 1 g formulation).
3. Creates `members/{uid}` with role **OWNER**.
4. Writes audit log `study.create`.
5. Study list loads via `memberIds array-contains uid` (client-sorted by `updatedAt`).
6. Active study persisted in `localStorage` (`nanotophea.activeStudyId`).
7. Dashboard shows Firestore study metadata (not hardcoded SIP title alone).

---

## 9. Files modified

- `package.json` / `package-lock.json` — added `firebase`, `zod`
- `components/layout/AppShell.tsx` — Auth + Study providers, protected shell
- `components/layout/AppHeader.tsx` — Phase 2 badge
- `components/panels/DashboardPanel.tsx` — active study from Firestore
- `.gitignore` — allow `.env.example`, ignore `.env.local`

---

## 10. Explicitly not done / pending

| Item | Status |
|------|--------|
| Firebase Storage / file uploads | Out of scope |
| AutoDock Vina / ADMET / prediction / lab / stats engines | Not implemented |
| Migrating quarantined legacy scientific demo data | **Not migrated** |
| Member invite UI for COLLABORATOR/ADVISER/VIEWER | Pending (schema + rules ready; OWNER can add via console/API later) |
| Firebase CLI deploy of rules | Manual step for researcher |
| Emulator suite | Not configured |
| Server Components using Firebase Admin | Not used (client SDK only) |

---

## 11. Verification

- `npm run build` — **pass**
- TypeScript check during Next build — **pass**
- No SSR Firebase init (client mount gate in `AppShell`)
- Lint: Next lint may warn if no ESLint config is present; build typecheck is green

---

## 12. Researcher setup checklist

1. Confirm `.env.local` values for project `nanotophea`
2. Firebase Console → Authentication → enable Email/Password
3. Firebase Console → Firestore → create database if needed
4. Deploy `firestore.rules`
5. `npm run dev` → register → create study → confirm Dashboard shows study

---

**Stop here for review.** Do not start the next scientific module until Phase 2 is accepted.
