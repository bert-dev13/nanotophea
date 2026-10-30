import { validateSession } from "@/lib/auth/session"
import { query, queryOne } from "@/lib/db/mysql"
import { listStudiesForUser, getStudy } from "@/lib/repositories/studyRepository"
import { loadStudyReadiness } from "@/lib/workflow/loadStudyReadiness"
import { listDockingOutcomes } from "@/lib/repositories/scientificRunRepository"
import { listCompounds, listProteins } from "@/lib/repositories/researchDataRepository"

async function run() {
  console.log("=== PERFORMANCE BASELINE MEASUREMENT ===")

  let sessionRow = await queryOne<any>("SELECT id, user_id FROM sessions ORDER BY created_at DESC LIMIT 1")
  if (!sessionRow) {
    const { createSession } = await import("@/lib/auth/session")
    const created = await createSession("g1dxux39lfeAb8RbvLEWgQ1IH6f2", { userAgent: "Benchmark" })
    sessionRow = { id: created.token, user_id: "g1dxux39lfeAb8RbvLEWgQ1IH6f2" }
  }
  const token = sessionRow.id
  const userId = sessionRow.user_id

  console.log(`Testing with user_id: ${userId}, token prefix: ${token.slice(0, 8)}...`)

  // Benchmark validateSession
  const t0 = performance.now()
  for (let i = 0; i < 20; i++) {
    await validateSession(token)
  }
  const avgSessionMs = (performance.now() - t0) / 20
  console.log(`validateSession avg latency: ${avgSessionMs.toFixed(2)} ms`)

  // Benchmark listStudiesForUser
  const t1 = performance.now()
  const studies = await listStudiesForUser(userId)
  const listStudiesMs = performance.now() - t1
  console.log(`listStudiesForUser count: ${studies.length}, time: ${listStudiesMs.toFixed(2)} ms`)

  if (studies.length === 0) {
    console.log("No studies found for user.")
    process.exit(0)
  }

  const study = studies[0]
  const studyId = study.id
  console.log(`Testing study: "${study.title}" (${studyId})`)

  // Benchmark loadStudyReadiness (which runs 13 parallel queries on route change)
  const t2 = performance.now()
  const readiness = await loadStudyReadiness(studyId)
  const readinessMs = performance.now() - t2
  console.log(`loadStudyReadiness time: ${readinessMs.toFixed(2)} ms`)

  // Benchmark listDockingOutcomes
  const t3 = performance.now()
  const docking = await listDockingOutcomes(studyId)
  const dockingMs = performance.now() - t3
  const dockingPayloadJson = JSON.stringify(docking)
  console.log(`listDockingOutcomes time: ${dockingMs.toFixed(2)} ms, completed runs: ${docking.completed.length}, total allRuns: ${docking.allRuns.length}, payload size: ${(dockingPayloadJson.length / 1024).toFixed(1)} KB`)

  // Benchmark Research Setup (compounds + proteins)
  const t4 = performance.now()
  const [compounds, proteins] = await Promise.all([listCompounds(studyId), listProteins(studyId)])
  const setupMs = performance.now() - t4
  console.log(`Research Setup data time: ${setupMs.toFixed(2)} ms (${compounds.length} compounds, ${proteins.length} proteins)`)

  console.log("=== BASELINE COMPLETE ===")
  process.exit(0)
}

run().catch((err) => {
  console.error("Baseline measurement error:", err)
  process.exit(1)
})
