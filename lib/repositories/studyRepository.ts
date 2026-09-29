import {
  CreateStudyInputSchema,
  StudyMemberSchema,
  StudySchema,
  UpdateStudyInputSchema,
  type CreateStudyInput,
  type Study,
  type StudyMember,
  type UpdateStudyInput,
  type UserProfile,
} from "@/lib/domain/models"
import { COLLECTIONS, STUDY_SUBCOLLECTIONS, studySub } from "@/lib/firebase/paths"
import {
  commitBatch,
  docRef,
  getDocData,
  listDocs,
  setDocData,
  updateDocData,
  where,
} from "@/lib/firebase/firestore"
import { writeAuditLog } from "@/lib/repositories/auditRepository"

function ownerMembership(owner: UserProfile, now: string): StudyMember {
  return StudyMemberSchema.parse({
    id: owner.id,
    userId: owner.id,
    email: owner.email,
    displayName: owner.displayName,
    role: "OWNER",
    addedAt: now,
    addedBy: owner.id,
  })
}

/**
 * Create study + OWNER membership in one batch so the study cannot exist
 * without its ownership record (security rules see prior writes in the batch).
 */
export async function createStudy(owner: UserProfile, input: CreateStudyInput): Promise<Study> {
  const parsed = CreateStudyInputSchema.parse(input)
  const ref = docRef(COLLECTIONS.studies)
  const now = new Date().toISOString()
  const study: Study = StudySchema.parse({
    id: ref.id,
    title: parsed.title,
    shortTitle: parsed.shortTitle,
    description: parsed.description,
    status: "draft",
    primaryCellLine: "HepG2",
    formulationSummary: "2 g dried Phyllanthus niruri leaf + 1 g Chitosan–TPP per tea bag",
    fairYear: parsed.fairYear,
    researcherNames: parsed.researcherNames,
    adviserNames: parsed.adviserNames,
    ownerId: owner.id,
    memberIds: [owner.id],
    createdAt: now,
    updatedAt: now,
    contractVersion: "2026-09-29",
  })

  const member = ownerMembership(owner, now)

  await commitBatch([
    { path: COLLECTIONS.studies, id: study.id, data: study },
    {
      path: studySub(study.id, STUDY_SUBCOLLECTIONS.members),
      id: owner.id,
      data: member,
    },
  ])

  // Membership exists → audit + research seed writes are authorized
  await writeAuditLog({
    studyId: study.id,
    actorId: owner.id,
    action: "study.create",
    entityType: "study",
    entityId: study.id,
  })

  const { seedDefaultResearchData } = await import("@/lib/seed/defaultResearchData")
  await seedDefaultResearchData(study.id, owner)

  return study
}

/**
 * If this user owns the study document but the members/{uid} OWNER row is
 * missing, recreate it. Never repairs for non-owners.
 */
export async function ensureOwnerMembership(
  study: Study,
  owner: UserProfile
): Promise<StudyMember | null> {
  if (study.ownerId !== owner.id) return null

  let existing: StudyMember | null = null
  try {
    existing = await getStudyMember(study.id, owner.id)
  } catch (e) {
    // Older rules denied reads of a missing members/{uid} doc with
    // permission-denied instead of returning empty — treat as missing.
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code?: string }).code || "")
        : ""
    if (code !== "permission-denied" && !/permission/i.test(e instanceof Error ? e.message : "")) {
      throw e
    }
    existing = null
  }

  if (existing?.role === "OWNER") return existing

  const now = new Date().toISOString()
  const member = ownerMembership(owner, now)
  await setDocData(studySub(study.id, STUDY_SUBCOLLECTIONS.members), owner.id, member)

  // Ensure memberIds still lists the owner (list query / read bootstrap)
  if (!study.memberIds.includes(owner.id)) {
    await updateDocData(COLLECTIONS.studies, study.id, {
      memberIds: [...study.memberIds, owner.id],
      updatedAt: now,
    })
  }

  return member
}

export async function getStudy(studyId: string): Promise<Study | null> {
  const raw = await getDocData<Study>(COLLECTIONS.studies, studyId)
  if (!raw) return null
  return StudySchema.parse(raw)
}

export async function listStudiesForUser(userId: string): Promise<Study[]> {
  // Sort client-side to avoid requiring a composite index during Phase 2 setup.
  const rows = await listDocs<Study>(
    COLLECTIONS.studies,
    where("memberIds", "array-contains", userId)
  )
  return rows
    .map((r) => StudySchema.parse(r))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function updateStudy(
  studyId: string,
  actorId: string,
  input: UpdateStudyInput
): Promise<Study> {
  const parsed = UpdateStudyInputSchema.parse(input)
  const existing = await getStudy(studyId)
  if (!existing) throw new Error("Study not found")
  const now = new Date().toISOString()
  const next = StudySchema.parse({
    ...existing,
    ...parsed,
    updatedAt: now,
  })
  await updateDocData(COLLECTIONS.studies, studyId, {
    ...parsed,
    updatedAt: now,
  })
  await writeAuditLog({
    studyId,
    actorId,
    action: "study.update",
    entityType: "study",
    entityId: studyId,
  })
  return next
}

export async function getStudyMember(studyId: string, userId: string): Promise<StudyMember | null> {
  const raw = await getDocData<StudyMember>(
    studySub(studyId, STUDY_SUBCOLLECTIONS.members),
    userId
  )
  if (!raw) return null
  return StudyMemberSchema.parse(raw)
}

export async function listStudyMembers(studyId: string): Promise<StudyMember[]> {
  const rows = await listDocs<StudyMember>(studySub(studyId, STUDY_SUBCOLLECTIONS.members))
  return rows.map((r) => StudyMemberSchema.parse(r))
}
