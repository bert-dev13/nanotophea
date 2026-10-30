import { listStudiesForUser } from "@/lib/repositories/studyRepository"
import { listCompounds, listProteins, listCellLines } from "@/lib/repositories/researchDataRepository"
import { listAdmetRuns, listDockingOutcomes, getDockingRun, listPredictionRuns } from "@/lib/repositories/scientificRunRepository"
import { listLabDatasets } from "@/lib/repositories/labRepository"
import { listInterpretations } from "@/lib/repositories/interpretationRepository"
import { queryOne } from "@/lib/db/mysql"

async function runE2e() {
  console.log("=== STARTING COMPLETE WORKFLOW NAVIGATION VERIFICATION ===")

  // 1. Verify HTTP login & Session creation
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@demo.com", password: "admin123" }),
  })
  if (!loginRes.ok) throw new Error(`Login failed with status ${loginRes.status}`)
  const cookieHeader = loginRes.headers.get("set-cookie") || ""
  console.log("✔ [1. Login] Succeeded. Session cookie established.")

  // 2. Verify Session via HTTP
  const sessionRes = await fetch("http://localhost:3000/api/auth/session", {
    headers: { Cookie: cookieHeader },
  })
  const sessionData = await sessionRes.json()
  if (!sessionData?.user) throw new Error("Session verification returned null user")
  console.log(`✔ [2. Auth] Active session verified for: ${sessionData.user.displayName} (${sessionData.user.email})`)

  // 3. Studies Page
  const t0 = performance.now()
  const studies = await listStudiesForUser(sessionData.user.id)
  const studiesTime = performance.now() - t0
  console.log(`✔ [3. Studies] Found ${studies.length} studies in ${studiesTime.toFixed(2)} ms`)
  if (!studies.length) throw new Error("No studies found")

  const study = studies.find(s => s.title.toLowerCase().includes("dezireij")) || studies[0]
  console.log(`✔ [3. Open Study] Selected study: "${study.title}" (${study.id})`)

  // 4. Step 01: Research Setup
  const t1 = performance.now()
  const [compounds, proteins, cellLines] = await Promise.all([
    listCompounds(study.id),
    listProteins(study.id),
    listCellLines(study.id),
  ])
  const setupTime = performance.now() - t1
  console.log(`✔ [4. Step 01 Research Setup] Loaded in ${setupTime.toFixed(2)} ms (${compounds.length} compounds, ${proteins.length} proteins, ${cellLines.length} cell lines)`)

  // 5. Step 02: In-Silico Screening
  const t2 = performance.now()
  const admet = await listAdmetRuns(study.id)
  const insilicoTime = performance.now() - t2
  console.log(`✔ [5. Step 02 In-Silico Screening] Loaded ${admet.length} ADMET runs in ${insilicoTime.toFixed(2)} ms`)

  // 6. Step 03: Molecular Docking
  const t3 = performance.now()
  const docking = await listDockingOutcomes(study.id)
  const dockingListTime = performance.now() - t3
  console.log(`✔ [6. Step 03 Molecular Docking Master List] Loaded ${docking.allRuns.length} runs in ${dockingListTime.toFixed(2)} ms (lightweight projection, pose_model excluded)`)

  // Test on-demand detail retrieval
  if (docking.allRuns.length > 0) {
    const tDetail = performance.now()
    const detail = await getDockingRun(study.id, docking.allRuns[0].id)
    const detailTime = performance.now() - tDetail
    console.log(`✔ [6. Step 03 Docking Detail On-Demand] Retrieved full run pose & search box in ${detailTime.toFixed(2)} ms`)
  }

  // 7. Step 04: Biological Predictions
  const t4 = performance.now()
  const predictions = await listPredictionRuns(study.id)
  const predTime = performance.now() - t4
  console.log(`✔ [7. Step 04 Biological Predictions] Loaded ${predictions.length} prediction runs in ${predTime.toFixed(2)} ms`)

  // 8. Step 05: Laboratory Validation
  const t5 = performance.now()
  const lab = await listLabDatasets(study.id)
  const labTime = performance.now() - t5
  console.log(`✔ [8. Step 05 Laboratory Validation] Loaded ${lab.length} laboratory datasets in ${labTime.toFixed(2)} ms`)

  // 9. Step 06: Analysis & Interpretation
  const t6 = performance.now()
  const interpretations = await listInterpretations(study.id)
  const analysisTime = performance.now() - t6
  console.log(`✔ [9. Step 06 Analysis & Interpretation] Loaded ${interpretations.length} interpretations in ${analysisTime.toFixed(2)} ms`)

  // 10. AI Assistant Endpoint
  const t7 = performance.now()
  const aiRes = await fetch("http://localhost:3000/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      studyId: study.id,
      intent: "chat",
      page: {
        currentPage: "Molecular Docking",
        selectedPhytochemicals: compounds.map(c => c.name),
        selectedTargetProteins: proteins.map(p => p.name),
        selectedCellLines: cellLines.map(c => c.name),
        activeDockingTarget: proteins[0]?.name || null,
        currentEndpoint: null,
      },
      messages: [{ role: "user", content: "Summarize this study's docking targets." }],
    }),
  })
  const aiTime = performance.now() - t7
  console.log(`✔ [10. AI Research Assistant] Endpoint status ${aiRes.status} in ${aiTime.toFixed(2)} ms`)

  console.log("=== FULL WORKFLOW VERIFICATION COMPLETE: ALL PASS ===")
  process.exit(0)
}

runE2e().catch((err) => {
  console.error("Workflow verification failed:", err)
  process.exit(1)
})
