import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"
import { getFirebaseWebConfig, hasFirebaseWebConfig } from "@/lib/firebase/config"

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined

/**
 * Lazy, idempotent Firebase init safe for Next.js.
 * Call only from client components / browser contexts.
 */
export function getFirebaseApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase client SDK must be initialized in the browser.")
  }
  if (!hasFirebaseWebConfig()) {
    throw new Error("Firebase web config is incomplete.")
  }
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(getFirebaseWebConfig())
  }
  return app
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp())
  }
  return auth
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp())
  }
  return db
}
