/**
 * Firebase Admin (server / scripts only).
 * Never import this from client components — it uses the service account.
 *
 * Credentials resolution order:
 * 1. GOOGLE_APPLICATION_CREDENTIALS path
 * 2. FIREBASE_SERVICE_ACCOUNT_PATH
 * 3. ./service.json at repo root
 */
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"
import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app"
import { getAuth, type Auth } from "firebase-admin/auth"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

let auth: Auth | undefined
let db: Firestore | undefined

function resolveServiceAccountPath(): string {
  const fromEnv =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (fromEnv) return resolve(fromEnv)
  return resolve(process.cwd(), "service.json")
}

export function getFirebaseAdminApp(): App {
  if (getApps().length) return getApps()[0]!

  const path = resolveServiceAccountPath()
  if (!existsSync(path)) {
    throw new Error(
      `Firebase service account not found at ${path}. Place service.json at repo root or set GOOGLE_APPLICATION_CREDENTIALS.`
    )
  }

  const raw = JSON.parse(readFileSync(path, "utf8")) as {
    project_id: string
    client_email: string
    private_key: string
  }

  return initializeApp({
    credential: cert({
      projectId: raw.project_id,
      clientEmail: raw.client_email,
      privateKey: raw.private_key.replace(/\\n/g, "\n"),
    }),
    projectId: raw.project_id,
  })
}

export function getAdminAuth() {
  if (!auth) auth = getAuth(getFirebaseAdminApp())
  return auth
}

export function getAdminDb() {
  if (!db) {
    db = getFirestore(getFirebaseAdminApp())
    db.settings({ ignoreUndefinedProperties: true })
  }
  return db
}
