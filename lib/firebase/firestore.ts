import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  deleteDoc,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"

export function col(path: string) {
  return collection(getFirebaseDb(), path)
}

export function docRef(path: string, id?: string) {
  return id ? doc(getFirebaseDb(), path, id) : doc(collection(getFirebaseDb(), path))
}

export async function getDocData<T>(path: string, id: string): Promise<(T & { id: string }) | null> {
  const snap = await getDoc(doc(getFirebaseDb(), path, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as T) }
}

/** Firestore rejects `undefined`. Optional Zod fields must be omitted, not stored. */
export function omitUndefined<T extends DocumentData>(data: T): DocumentData {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
}

export async function setDocData(path: string, id: string, data: DocumentData, merge = false) {
  await setDoc(doc(getFirebaseDb(), path, id), omitUndefined(data), { merge })
}

export async function updateDocData(path: string, id: string, data: DocumentData) {
  await updateDoc(doc(getFirebaseDb(), path, id), omitUndefined(data))
}

export async function deleteDocData(path: string, id: string) {
  await deleteDoc(doc(getFirebaseDb(), path, id))
}

export async function listDocs<T>(
  path: string,
  ...constraints: QueryConstraint[]
): Promise<Array<T & { id: string }>> {
  const q = constraints.length ? query(col(path), ...constraints) : query(col(path))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}

/** Atomic multi-doc write. Order matters for security-rule get()/exists() within the batch. */
export async function commitBatch(
  writes: Array<{ path: string; id: string; data: DocumentData; merge?: boolean }>
): Promise<void> {
  const batch = writeBatch(getFirebaseDb())
  for (const w of writes) {
    batch.set(doc(getFirebaseDb(), w.path, w.id), omitUndefined(w.data), { merge: w.merge ?? false })
  }
  await batch.commit()
}

export { where, orderBy }
