# NANOTOPHEA Comprehensive Firebase Removal Audit

**Audit Date**: October 2026  
**Target Architecture**: Complete removal of Firebase client & admin dependencies. All persistence, authentication, session management, and authorization converted to MySQL/MariaDB (`nanotophea_db` via XAMPP on localhost:3306).

---

## 1. Executive Summary

This audit catalogs all usages of Google Firebase (Authentication, Firestore, Firebase Admin SDK, and configuration files) across the NANOTOPHEA repository. 

Previously, NANOTOPHEA used a hybrid architecture where scientific data repositories had already been refactored to MySQL (`lib/repositories/*.ts`), but:
1. **Authentication** was entirely anchored to Firebase Authentication (`firebase/auth`, `signInWithEmailAndPassword`, `signOut`, `onAuthStateChanged`).
2. **API route protection** relied on `getAdminAuth().verifyIdToken()` verifying Firebase JWT bearer tokens.
3. **Client-side components** invoked `await user.getIdToken()` to pass bearer tokens to `/api/scientific/docking/*`, `/api/scientific/adme`, and `/api/ai/chat`.
4. **`users` table** in MySQL lacked password hashing (`password_hash`), activation flags (`is_active`), and session storage.
5. **Session management** was handled by Firebase SDK client-side token caching rather than secure HTTP-only cookies.

Following this audit, all Firebase dependencies will be fully excised.

---

## 2. Inventory of Firebase Usage by Category

### A. Dependencies (`package.json`)
- `firebase`: `^12.19.0` (Client SDK: auth, firestore, app)
- `firebase-admin`: `^14.5.0` (Server SDK: admin auth, firestore)

### B. Environment Variables & Credentials
- `.env.local` & `.env.example`:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
  - `GOOGLE_APPLICATION_CREDENTIALS=./service.json`
  - `FIREBASE_SERVICE_ACCOUNT`
- Configuration & key files in root:
  - `service.json` (Admin SDK private key credentials)
  - `firebase.json` (Firebase CLI deployment settings)
  - `.firebaserc` (Firebase project ID definition)
  - `firestore.rules` (Obsolete Firestore security rules)

### C. Core Firebase Helper Modules (`lib/firebase/`)
- `lib/firebase/client.ts`: `initializeApp`, `getAuth`, `getFirestore`.
- `lib/firebase/admin.ts`: `firebase-admin/app`, `firebase-admin/auth`, `firebase-admin/firestore`.
- `lib/firebase/config.ts`: Environment parser for Firebase client credentials.
- `lib/firebase/firestore.ts`: Helper wrappers (`col`, `docRef`, `getDocData`, `setDocData`, `updateDocData`, `deleteDocData`, `listDocs`, `commitBatch`).
- `lib/firebase/paths.ts`: Path builders for Firestore subcollections (`studies/{studyId}/*`).

### D. Authentication Context & Providers
- `components/providers/AuthProvider.tsx`:
  - Imports: `onAuthStateChanged`, `signInWithEmailAndPassword`, `signOut`, `User` from `firebase/auth`.
  - Imports: `getFirebaseAuth` from `@/lib/firebase/client`.
  - Exposes: `user: User | null`, `profile: UserProfile | null`, `login`, `logout`.
  - Auto-subscribes to Firebase Auth state on client mount.

### E. Client Components Calling `user.getIdToken()`
The following components retrieve the Firebase ID token and send it as `Authorization: Bearer <token>`:
1. `components/study/DockingPairsWorkspace.tsx` (Lines 148, 163, 265: docking engine status, enqueue single docking job, enqueue all unfinished docking jobs).
2. `components/study/InSilicoWorkspace.tsx` (Lines 108, 204: ADME service status and ADME prediction trigger).
3. `components/ai/assistant-workspace.tsx` (Line 129: AI chat endpoint).
4. `components/ai/research-assistant.tsx` (Lines 80, 92: AI interpretation generation and AI chat).

### F. API Routes Verifying Firebase Bearer Tokens
The following server endpoints decode tokens using `getAdminAuth().verifyIdToken(token)`:
1. `app/api/scientific/adme/route.ts`
2. `app/api/scientific/docking/engine/route.ts`
3. `app/api/scientific/docking/jobs/route.ts`
4. `app/api/ai/chat/route.ts`

### G. Repositories, Domain, & Errors
- `lib/errors/userFacing.ts`: Mentions Firebase error codes (`permission-denied`, `unavailable`, `unauthenticated`) and log messages.
- `lib/statistics/statDisplay.ts`: Function name `toFirestoreStatNumber` and comments regarding Firestore number limitations.
- `lib/docking/migration.ts`: Historical Firestore migration utility importing `getAdminDb`.

### H. Tests
- `lib/phase11/phase11.test.ts`:
  - Imports `studySub`, `STUDY_SUBCOLLECTIONS` from `../firebase/paths`.
  - Tests `toFirestoreStatNumber`.
  - Tests user-facing Firebase error message mapping.

### I. Scripts
- `scripts/migrate-firestore-to-mysql.ts`: Historical migration script from Firestore to MySQL.
- `scripts/migrate-docking.ts`: Docking deduplication script for Firestore.
- `scripts/audit-db.ts`: Firestore database inspector.
- `scripts/delete-studies.ts` & `scripts/delete-all-records.ts`: Firestore deletion utilities.
- `scripts/seed-admin.ts`: Seed script using `admin.auth()`.

---

## 3. Migration and Removal Action Plan

1. **MySQL Schema Enhancement**:
   - Update `users` table in `lib/db/schema.sql` and live MySQL database `nanotophea_db` to include:
     - `password_hash VARCHAR(255) NULL`
     - `role ENUM('OWNER','COLLABORATOR','ADVISER','VIEWER') NOT NULL DEFAULT 'VIEWER'`
     - `is_active TINYINT(1) NOT NULL DEFAULT 1`
     - `last_login_at VARCHAR(64) NULL`
   - Create `sessions` table in `nanotophea_db`:
     - `id VARCHAR(128) PRIMARY KEY` (cryptographically secure session token)
     - `user_id VARCHAR(128) NOT NULL (FK -> users.id ON DELETE CASCADE)`
     - `expires_at BIGINT NOT NULL` (Unix timestamp)
     - `created_at VARCHAR(64) NOT NULL`
     - `ip_address VARCHAR(45) NULL`
     - `user_agent TEXT NULL`

2. **Secure Password Hashing & Seed**:
   - Use `bcryptjs` (industry-standard salted bcrypt hash with cost factor 10).
   - Seed `admin@demo.com` with password `admin123` (or configured env `NANOTOPHEA_ADMIN_PASSWORD`).
   - Never store, log, or return plaintext passwords or hashes.

3. **Server-Side Session Management**:
   - Create `lib/auth/session.ts` handling session creation, verification, expiration, and invalidation.
   - Use HTTP-only cookies (`nanotophea_session`) with `SameSite: Lax`, `Path: /`, and `Secure` (in production).
   - Also allow `Authorization: Bearer <session_token>` for seamless API route calls.

4. **Authentication Endpoints & Server Actions**:
   - Create `/api/auth/login`, `/api/auth/logout`, `/api/auth/session`, `/api/auth/me`.
   - Implement timing-safe verification and generic error messages ("Invalid email or password").
   - Prevent account enumeration.
   - Server-side route protection via Next.js `middleware.ts`.

5. **Client Authentication Replacement**:
   - Replace Firebase `AuthProvider` with MySQL session-backed `AuthProvider`.
   - Provide non-flickering, cookie-aware session initialization without Firebase hydration delays.
   - Ensure `user.getIdToken()` continues to return the active session token so existing client callers function without modification.

6. **Excision of Obsolete Firebase Files**:
   - Delete `lib/firebase/` directory (`admin.ts`, `client.ts`, `config.ts`, `firestore.ts`, `paths.ts`).
   - Delete `service.json`, `firebase.json`, `.firebaserc`, `firestore.rules`.
   - Archive/retire obsolete Firestore scripts.
   - Remove `firebase` and `firebase-admin` from `package.json`.
   - Clean `.env.local` and `.env.example`.

7. **Verification & Testing**:
   - Validate login, logout, wrong password, wrong email, inactive user, session refresh.
   - Run unit test suite and Next.js production build (`npm run build`).
