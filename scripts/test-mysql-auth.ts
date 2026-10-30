import { execute, query, queryOne, getPool } from "../lib/db/mysql"
import { hashPassword, verifyPassword } from "../lib/auth/password"
import { createSession, validateSession, invalidateSession } from "../lib/auth/session"
import { getUserAuthByEmail, getUserProfile, updateUserLastLogin, setUserActive } from "../lib/repositories/userRepository"
import { createStudy, getStudy, deleteStudy } from "../lib/repositories/studyRepository"
import { createDockingRun, listDockingPairs, listAllDockingRuns } from "../lib/repositories/scientificRunRepository"
import { createCompound, createProtein } from "../lib/repositories/researchDataRepository"
import { defaultProvenance } from "../lib/domain/provenance"

async function runAuthTests() {
  console.log("=== STARTING NANOTOPHEA MYSQL AUTH & ACCESS VERIFICATION ===")

  // 1. Password Hashing and Verification
  const testPassword = "SecurePassword123!"
  const hashed = await hashPassword(testPassword)
  if (!hashed || !hashed.startsWith("$2")) {
    throw new Error("Password hash format invalid")
  }
  const isMatch = await verifyPassword(testPassword, hashed)
  const isWrongMatch = await verifyPassword("WrongPassword!", hashed)
  if (!isMatch || isWrongMatch) {
    throw new Error("Password verification failed")
  }
  console.log("✔ Password hashing (bcrypt) and verification: PASS")

  // 2. Setup Test User
  const testUser = {
    id: "test_auth_researcher_id",
    email: "auth_test@nanotophea.test",
    password: "ResearchPassword2026",
    displayName: "Dr. Test Researcher",
    role: "OWNER" as const,
  }

  await execute(`DELETE FROM sessions WHERE user_id = ?`, [testUser.id])
  await execute(`DELETE FROM studies WHERE owner_id = ?`, [testUser.id])
  await execute(`DELETE FROM users WHERE id = ? OR email = ?`, [testUser.id, testUser.email])

  const userHash = await hashPassword(testUser.password)
  const now = new Date().toISOString()
  await execute(
    `INSERT INTO users (id, email, password_hash, display_name, role, default_role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [testUser.id, testUser.email, userHash, testUser.displayName, testUser.role, testUser.role, now, now]
  )
  console.log("✔ Test user created in MySQL")

  // 3. Test Valid Login Lookup
  const authRecord = await getUserAuthByEmail(testUser.email)
  if (!authRecord || !authRecord.passwordHash) {
    throw new Error("User lookup by email failed")
  }
  const validPass = await verifyPassword(testUser.password, authRecord.passwordHash)
  if (!validPass) {
    throw new Error("Valid password rejected")
  }
  await updateUserLastLogin(authRecord.id)
  console.log("✔ Valid credentials verification: PASS")

  // 4. Test Invalid Password
  const invalidPass = await verifyPassword("BadPassword999", authRecord.passwordHash)
  if (invalidPass) {
    throw new Error("Invalid password incorrectly accepted")
  }
  console.log("✔ Invalid password rejection: PASS")

  // 5. Test Invalid Email Lookup
  const nonExistent = await getUserAuthByEmail("nobody@doesnotexist.test")
  if (nonExistent !== null) {
    throw new Error("Non-existent email returned a user")
  }
  console.log("✔ Unknown email lookup yields null (generic error presented): PASS")

  // 6. Test Inactive Account
  await setUserActive(testUser.id, false)
  const inactiveRecord = await getUserAuthByEmail(testUser.email)
  if (!inactiveRecord || inactiveRecord.isActive) {
    throw new Error("Account deactivation failed")
  }
  console.log("✔ Inactive account detection: PASS")
  // Reactivate for further tests
  await setUserActive(testUser.id, true)

  // 7. Test Session Creation, Validation, and Refresh
  const { token, expiresAt } = await createSession(testUser.id, {
    userAgent: "Mozilla/5.0 Node-Test",
    ipAddress: "127.0.0.1",
  })
  if (!token || token.length < 32 || expiresAt <= Date.now()) {
    throw new Error("Session creation failed")
  }
  console.log(`✔ Session created in MySQL sessions table: ${token.slice(0, 16)}...`)

  const validated = await validateSession(token)
  if (!validated || validated.user.id !== testUser.id || validated.user.email !== testUser.email) {
    throw new Error("Session validation failed")
  }
  // Verify password hash is NEVER present in the returned user object
  if ("passwordHash" in (validated.user as any) || "password_hash" in (validated.user as any)) {
    throw new Error("SECURITY FAILURE: password hash found on UserProfile object!")
  }
  console.log("✔ Session validation & user profile mapping (no password hash exposed): PASS")

  // 8. Test Session Invalidation on Inactive Account
  await setUserActive(testUser.id, false)
  const validatedWhenInactive = await validateSession(token)
  if (validatedWhenInactive !== null) {
    throw new Error("Inactive user session was not revoked!")
  }
  console.log("✔ Inactive user session rejected and revoked: PASS")
  await setUserActive(testUser.id, true)

  // 9. Test Manual Logout / Session Destruction
  const session2 = await createSession(testUser.id)
  await invalidateSession(session2.token)
  const validatedAfterLogout = await validateSession(session2.token)
  if (validatedAfterLogout !== null) {
    throw new Error("Destroyed session was still valid!")
  }
  console.log("✔ Logout session invalidation: PASS")

  // 10. Test Study Creation and Ownership Protection
  const userProfile = await getUserProfile(testUser.id)
  if (!userProfile) throw new Error("Could not load user profile")

  const study = await createStudy(userProfile, {
    title: "Auth Protection Study",
    shortTitle: "Protected",
    description: "Testing ownership protection in MySQL",
  })
  console.log(`✔ Study created by ${userProfile.email}: ${study.id}`)

  const fetchedStudy = await getStudy(study.id)
  if (!fetchedStudy || fetchedStudy.ownerId !== testUser.id) {
    throw new Error("Study ownerId does not match authenticated user!")
  }
  console.log("✔ Study ownership check: PASS")

  // 11. Test Docking Pair 1 -> Multiple Docking Runs Preservation
  const compound = await createCompound(study.id, userProfile, {
    name: "Phyllanthin",
    pubchemCid: 442600,
    smiles: "COC1=CC(=CC(=C1OC)CC(C)CC2=CC(=C(C(=C2)OC)OC)OC)OC",
    chemicalClass: "Lignan",
    provenance: defaultProvenance("REFERENCE", { operatorId: userProfile.id, source: "PubChem" }),
  })
  const protein = await createProtein(study.id, userProfile, {
    name: "CYP2E1",
    proteinName: "Cytochrome P450 2E1",
    pdbId: "3E4E",
    provenance: defaultProvenance("REFERENCE", { operatorId: userProfile.id, source: "RCSB PDB" }),
  })

  const run1 = await createDockingRun(study.id, userProfile, {
    compoundId: compound.id,
    proteinId: protein.id,
    runName: "Phyllanthin x CYP2E1 Run 1",
    vinaVersion: "1.2.5",
    receptorPdbId: "3E4E",
    modes: [{ mode: 1, affinityKcalMol: -7.5, rmsdLowerBound: 0, rmsdUpperBound: 0 }],
    bestBindingAffinityKcalMol: -7.5,
    searchBox: { centerX: 10, centerY: 10, centerZ: 10, sizeX: 20, sizeY: 20, sizeZ: 20 },
    provenance: defaultProvenance("PREDICTED", { operatorId: userProfile.id, methodName: "AutoDock Vina", source: "AutoDock Vina 1.2.5" }),
  })

  const run2 = await createDockingRun(study.id, userProfile, {
    compoundId: compound.id,
    proteinId: protein.id,
    runName: "Phyllanthin x CYP2E1 Run 2",
    vinaVersion: "1.2.5",
    receptorPdbId: "3E4E",
    modes: [{ mode: 1, affinityKcalMol: -7.8, rmsdLowerBound: 0, rmsdUpperBound: 0 }],
    bestBindingAffinityKcalMol: -7.8,
    searchBox: { centerX: 10, centerY: 10, centerZ: 10, sizeX: 20, sizeY: 20, sizeZ: 20 },
    provenance: defaultProvenance("PREDICTED", { operatorId: userProfile.id, methodName: "AutoDock Vina", source: "AutoDock Vina 1.2.5" }),
  })

  const pairs = await listDockingPairs(study.id)
  const allRuns = await listAllDockingRuns(study.id)

  if (pairs.length !== 1) {
    throw new Error(`Expected exactly 1 docking pair, got ${pairs.length}`)
  }
  if (allRuns.length !== 2) {
    throw new Error(`Expected exactly 2 docking runs, got ${allRuns.length}`)
  }
  if (pairs[0]!.runsCount !== 2) {
    throw new Error(`Expected pair runsCount = 2, got ${pairs[0]!.runsCount}`)
  }
  if (pairs[0]!.latestBindingAffinity !== -7.8) {
    throw new Error(`Expected latestBindingAffinity = -7.8, got ${pairs[0]!.latestBindingAffinity}`)
  }
  console.log("✔ Docking Pair deduplication & run history (1 Pair, 2 Runs, runsCount=2): PASS")

  // 12. Cleanup
  await deleteStudy(study.id, testUser.id)
  await execute(`DELETE FROM sessions WHERE user_id = ?`, [testUser.id])
  await execute(`DELETE FROM users WHERE id = ?`, [testUser.id])
  console.log("✔ Test study and sessions cleaned up successfully")

  console.log("=== ALL AUTH AND PERMISSION TESTS PASSED ===")
}

runAuthTests()
  .then(async () => {
    const pool = getPool()
    await pool.end()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error("Auth test failed:", err)
    const pool = getPool()
    await pool.end()
    process.exit(1)
  })
