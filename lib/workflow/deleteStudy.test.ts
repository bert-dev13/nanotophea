import test from "node:test"
import assert from "node:assert/strict"
import { createStudy, deleteStudy, getStudy } from "@/lib/repositories/studyRepository"
import { query, queryOne, execute, transaction } from "@/lib/db/mysql"
import type { UserProfile } from "@/lib/domain/models"

const testOwner: UserProfile = {
  id: "test-delete-owner-1",
  email: "delete-owner-1@test.com",
  displayName: "Delete Owner 1",
  role: "COLLABORATOR",
  defaultRole: "COLLABORATOR",
  photoURL: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const testUnauthorizedUser: UserProfile = {
  id: "test-delete-intruder-2",
  email: "intruder@test.com",
  displayName: "Intruder User",
  role: "COLLABORATOR",
  defaultRole: "COLLABORATOR",
  photoURL: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

test("deleteStudy: rejects study-not-found", async () => {
  await assert.rejects(
    async () => {
      await deleteStudy("non-existent-study-id-9999", testOwner.id)
    },
    { message: /Study not found/ }
  )
})

test("deleteStudy: rejects unauthorized deletion from non-owner", async () => {
  const study = await createStudy(testOwner, {
    title: "Unauthorized Deletion Probe Study",
    description: "Testing security protection",
  })

  try {
    await assert.rejects(
      async () => {
        await deleteStudy(study.id, testUnauthorizedUser.id)
      },
      { message: /Unauthorized/ }
    )

    // Study must still exist!
    const stillExists = await getStudy(study.id)
    assert.ok(stillExists, "Study must remain untouched when deletion is unauthorized")
  } finally {
    // Clean up with authorized owner
    await deleteStudy(study.id, testOwner.id)
  }
})

test("deleteStudy: authorized deletion removes study, dependent records, and preserves other studies", async () => {
  // Create another study that must NOT be deleted
  const otherStudy = await createStudy(testOwner, {
    title: "Preserved Investigation Alpha",
    description: "Must stay intact",
  })

  // Create study to be deleted
  const studyToDelete = await createStudy(testOwner, {
    title: "Study To Delete Completely",
    description: "Testing cascade cleanup",
  })

  const now = new Date().toISOString()

  // Seed study-specific records across multiple tables
  await execute(
    `INSERT INTO phytochemicals (id, study_id, name, provenance, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `phyto-${studyToDelete.id}`,
      studyToDelete.id,
      "Test Compound A",
      JSON.stringify({ evidenceClass: "LITERATURE", source: "test" }),
      now,
      now,
      testOwner.id,
      testOwner.id,
    ]
  )

  await execute(
    `INSERT INTO target_proteins (id, study_id, name, provenance, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `prot-${studyToDelete.id}`,
      studyToDelete.id,
      "Test Protein Target B",
      JSON.stringify({ evidenceClass: "REFERENCE", source: "test" }),
      now,
      now,
      testOwner.id,
      testOwner.id,
    ]
  )

  await execute(
    `INSERT INTO docking_pairs (id, study_id, compound_id, protein_id, provenance, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `pair-${studyToDelete.id}`,
      studyToDelete.id,
      `phyto-${studyToDelete.id}`,
      `prot-${studyToDelete.id}`,
      JSON.stringify({ evidenceClass: "PREDICTED", source: "test" }),
      now,
      now,
      testOwner.id,
      testOwner.id,
    ]
  )

  // Verify records exist before deletion
  const [phytoBefore] = await query<any>("SELECT COUNT(*) as c FROM phytochemicals WHERE study_id = ?", [studyToDelete.id])
  const [protBefore] = await query<any>("SELECT COUNT(*) as c FROM target_proteins WHERE study_id = ?", [studyToDelete.id])
  const [pairBefore] = await query<any>("SELECT COUNT(*) as c FROM docking_pairs WHERE study_id = ?", [studyToDelete.id])
  assert.equal(Number(phytoBefore.c), 1)
  assert.equal(Number(protBefore.c), 1)
  assert.equal(Number(pairBefore.c), 1)

  // Perform authorized deletion
  await deleteStudy(studyToDelete.id, testOwner.id)

  // Verify study is deleted
  const deletedStudy = await getStudy(studyToDelete.id)
  assert.equal(deletedStudy, null, "Study record must be deleted")

  // Verify dependent study records are completely removed
  const [phytoAfter] = await query<any>("SELECT COUNT(*) as c FROM phytochemicals WHERE study_id = ?", [studyToDelete.id])
  const [protAfter] = await query<any>("SELECT COUNT(*) as c FROM target_proteins WHERE study_id = ?", [studyToDelete.id])
  const [pairAfter] = await query<any>("SELECT COUNT(*) as c FROM docking_pairs WHERE study_id = ?", [studyToDelete.id])
  assert.equal(Number(phytoAfter.c), 0, "Dependent phytochemicals must be removed")
  assert.equal(Number(protAfter.c), 0, "Dependent target_proteins must be removed")
  assert.equal(Number(pairAfter.c), 0, "Dependent docking_pairs must be removed")

  // Verify preserved other study is completely intact
  const otherStillExists = await getStudy(otherStudy.id)
  assert.ok(otherStillExists, "Other studies must remain intact")
  assert.equal(otherStillExists.title, "Preserved Investigation Alpha")

  // Clean up preserved study
  await deleteStudy(otherStudy.id, testOwner.id)
})

test("deleteStudy: transaction rollback on error ensures atomicity", async () => {
  const rollbackStudy = await createStudy(testOwner, {
    title: "Atomic Rollback Verification Study",
  })

  // Simulate a transactional failure during child cleanup
  let caught = false
  try {
    await transaction(async (conn) => {
      // Step 1: delete a member
      await conn.execute("DELETE FROM study_members WHERE study_id = ?", [rollbackStudy.id])
      // Step 2: simulate intentional failure before commit
      throw new Error("Simulated transactional failure during study deletion")
    })
  } catch (e: any) {
    if (e.message.includes("Simulated transactional failure")) {
      caught = true
    }
  }

  assert.ok(caught, "Transaction error must be thrown")

  // Verify rollback: study_members still exists!
  const members = await query<any>("SELECT * FROM study_members WHERE study_id = ?", [rollbackStudy.id])
  assert.ok(members.length > 0, "Rolled back transaction must not leave partially deleted records")

  // Clean up
  await deleteStudy(rollbackStudy.id, testOwner.id)
})

test.after(async () => {
  const { getPool } = await import("@/lib/db/mysql")
  await getPool().end()
})
