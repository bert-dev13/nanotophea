import { UserProfileSchema, type UserProfile, type StudyRole } from "@/lib/domain/models"
import { COLLECTIONS } from "@/lib/firebase/paths"
import { getDocData, setDocData, updateDocData } from "@/lib/firebase/firestore"

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const raw = await getDocData<UserProfile>(COLLECTIONS.users, userId)
  if (!raw) return null
  return UserProfileSchema.parse(raw)
}

export async function upsertUserProfile(input: {
  id: string
  email: string
  displayName?: string | null
  photoURL?: string | null
  defaultRole?: StudyRole
}): Promise<UserProfile> {
  const existing = await getUserProfile(input.id)
  const now = new Date().toISOString()
  if (existing) {
    const updated: UserProfile = UserProfileSchema.parse({
      ...existing,
      email: input.email,
      displayName: input.displayName?.trim() || existing.displayName,
      photoURL: input.photoURL ?? existing.photoURL ?? null,
      updatedAt: now,
    })
    await setDocData(COLLECTIONS.users, input.id, updated, true)
    return updated
  }
  const created: UserProfile = UserProfileSchema.parse({
    id: input.id,
    email: input.email,
    displayName: input.displayName?.trim() || input.email.split("@")[0] || "Researcher",
    photoURL: input.photoURL ?? null,
    createdAt: now,
    updatedAt: now,
    defaultRole: input.defaultRole ?? "OWNER",
  })
  await setDocData(COLLECTIONS.users, input.id, created)
  return created
}

export async function updateUserProfile(
  userId: string,
  patch: Partial<Pick<UserProfile, "displayName" | "defaultRole" | "photoURL">>
): Promise<void> {
  await updateDocData(COLLECTIONS.users, userId, {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}
