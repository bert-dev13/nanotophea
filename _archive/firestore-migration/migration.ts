import { getAdminDb } from "@/lib/firebase/admin"
import {
  canonicalDockingPairDocId,
  DockingPairSchema,
  DockingRunSchema,
  SkippedDockingPairSchema,
  type DockingPair,
  type DockingRun,
} from "@/lib/domain/models"

export interface MigrationSummary {
  studyId: string
  studyTitle: string
  compoundsCount: number
  proteinsBeforeCount: number
  proteinsAfterCount: number
  duplicateProteinsRemoved: number
  runsBeforeCount: number
  runsPreservedCount: number
  canonicalPairsCreated: number
  pairs: Array<{
    pairId: string
    compoundName: string
    targetName: string
    runsCount: number
    latestAffinity: number | null
    latestRunId: string | null
  }>
}

export async function migrateStudyDocking(studyId: string): Promise<MigrationSummary> {
  const db = getAdminDb()
  const studyDoc = await db.doc(`studies/${studyId}`).get()
  const studyTitle = (studyDoc.data()?.title as string) || studyId

  // 1. Fetch proteins and deduplicate
  const proteinsSnap = await db.collection(`studies/${studyId}/proteins`).get()
  const proteinDocs = proteinsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
    id: string
    name: string
    pdbId?: string
    uniprotIds?: string[]
    biologicalTarget?: string
    createdAt?: string
    [key: string]: unknown
  }>

  // Map protein target identifier to primary protein document ID
  const proteinGroupMap = new Map<string, Array<typeof proteinDocs[0]>>()
  for (const p of proteinDocs) {
    const key = (p.biologicalTarget || p.name || "").trim().toUpperCase()
    if (!proteinGroupMap.has(key)) proteinGroupMap.set(key, [])
    proteinGroupMap.get(key)!.push(p)
  }

  const proteinIdRemap = new Map<string, string>() // oldId -> canonicalId
  let duplicateProteinsRemoved = 0

  for (const [key, group] of proteinGroupMap.entries()) {
    // Pick the canonical primary protein: prefer one with valid pdbId, then earliest createdAt
    group.sort((a, b) => {
      const aHasPdb = Boolean(a.pdbId && a.pdbId.trim())
      const bHasPdb = Boolean(b.pdbId && b.pdbId.trim())
      if (aHasPdb && !bHasPdb) return -1
      if (!aHasPdb && bHasPdb) return 1
      return (a.createdAt || "").localeCompare(b.createdAt || "")
    })
    const primary = group[0]!
    for (const p of group) {
      proteinIdRemap.set(p.id, primary.id)
      if (p.id !== primary.id) {
        await db.doc(`studies/${studyId}/proteins/${p.id}`).delete()
        duplicateProteinsRemoved++
      }
    }
  }

  // 2. Fetch compounds and deduplicate if necessary
  const compoundsSnap = await db.collection(`studies/${studyId}/compounds`).get()
  const compoundDocs = compoundsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
    id: string
    name: string
    pubchemCid?: number
    createdAt?: string
    [key: string]: unknown
  }>
  const compoundGroupMap = new Map<string, Array<typeof compoundDocs[0]>>()
  for (const c of compoundDocs) {
    const key = (c.name || "").trim().toLowerCase()
    if (!compoundGroupMap.has(key)) compoundGroupMap.set(key, [])
    compoundGroupMap.get(key)!.push(c)
  }
  const compoundIdRemap = new Map<string, string>()
  for (const [, group] of compoundGroupMap.entries()) {
    group.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))
    const primary = group[0]!
    for (const c of group) {
      compoundIdRemap.set(c.id, primary.id)
      if (c.id !== primary.id) {
        await db.doc(`studies/${studyId}/compounds/${c.id}`).delete()
      }
    }
  }

  // 3. Fetch all docking runs and skipped pairs
  const runsSnap = await db.collection(`studies/${studyId}/dockingRuns`).get()
  const allRuns: DockingRun[] = []
  const skippedList: any[] = []

  for (const doc of runsSnap.docs) {
    const data = doc.data()
    const mappedCompoundId = compoundIdRemap.get(data.compoundId) || data.compoundId
    const mappedProteinId = proteinIdRemap.get(data.proteinId) || data.proteinId

    const skipParsed = SkippedDockingPairSchema.safeParse(data)
    if (skipParsed.success) {
      skippedList.push({
        ...skipParsed.data,
        compoundId: mappedCompoundId,
        proteinId: mappedProteinId,
      })
      continue
    }

    const runParsed = DockingRunSchema.safeParse(data)
    if (runParsed.success) {
      const pairId = canonicalDockingPairDocId(mappedCompoundId, mappedProteinId)
      const updatedRun: DockingRun = {
        ...runParsed.data,
        id: doc.id,
        pairId,
        compoundId: mappedCompoundId,
        proteinId: mappedProteinId,
      }
      allRuns.push(updatedRun)
      // If the run had unmapped proteinId/compoundId or missing pairId, update in Firestore
      if (data.proteinId !== mappedProteinId || data.compoundId !== mappedCompoundId || data.pairId !== pairId) {
        await db.doc(`studies/${studyId}/dockingRuns/${doc.id}`).set(updatedRun, { merge: true })
      }
    }
  }

  // 4. Group runs by canonical pair ID
  const runsByPair = new Map<string, DockingRun[]>()
  for (const run of allRuns) {
    const pairId = run.pairId || canonicalDockingPairDocId(run.compoundId, run.proteinId)
    if (!runsByPair.has(pairId)) runsByPair.set(pairId, [])
    runsByPair.get(pairId)!.push(run)
  }

  const pairSummaries: MigrationSummary["pairs"] = []

  for (const [pairId, runs] of runsByPair.entries()) {
    // Sort runs chronologically descending: newest first
    runs.sort((a, b) => {
      const timeA = a.completedAt || a.updatedAt || a.createdAt
      const timeB = b.completedAt || b.updatedAt || b.createdAt
      return timeB.localeCompare(timeA)
    })

    const earliestTime = runs[runs.length - 1]!.createdAt
    const latestRun = runs[0]!
    const compoundId = latestRun.compoundId
    const proteinId = latestRun.proteinId

    // Find protein & compound names
    const protein = proteinDocs.find((p) => p.id === proteinId)
    const compound = compoundDocs.find((c) => c.id === compoundId)
    const compoundName = latestRun.ligandName || compound?.name || "Compound"
    const targetName = latestRun.researchTarget || protein?.name || "Target"

    const pairRecord = DockingPairSchema.parse({
      id: pairId,
      studyId,
      compoundId,
      proteinId,
      compoundName,
      targetName,
      status: "COMPLETED",
      latestRunId: latestRun.id,
      latestBindingAffinity: latestRun.bestBindingAffinityKcalMol,
      runsCount: runs.length,
      archived: false,
      createdAt: earliestTime,
      updatedAt: latestRun.updatedAt || latestRun.completedAt || new Date().toISOString(),
      createdBy: latestRun.createdBy,
      updatedBy: latestRun.updatedBy,
    })

    await db.doc(`studies/${studyId}/dockingPairs/${pairId}`).set(pairRecord)

    pairSummaries.push({
      pairId,
      compoundName,
      targetName,
      runsCount: runs.length,
      latestAffinity: latestRun.bestBindingAffinityKcalMol,
      latestRunId: latestRun.id,
    })
  }

  // Also handle skipped pairs
  for (const skip of skippedList) {
    const pairId = canonicalDockingPairDocId(skip.compoundId, skip.proteinId)
    if (!runsByPair.has(pairId)) {
      const pairRecord = DockingPairSchema.parse({
        id: pairId,
        studyId,
        compoundId: skip.compoundId,
        proteinId: skip.proteinId,
        compoundName: skip.compoundName,
        targetName: skip.targetName,
        status: "SKIPPED",
        latestRunId: null,
        latestBindingAffinity: null,
        runsCount: 0,
        archived: false,
        createdAt: skip.createdAt,
        updatedAt: skip.updatedAt,
        createdBy: skip.createdBy,
        updatedBy: skip.updatedBy,
      })
      await db.doc(`studies/${studyId}/dockingPairs/${pairId}`).set(pairRecord)
    }
  }

  // 5. Clean up duplicate or stale dockingJobs
  const jobsSnap = await db.collection(`studies/${studyId}/dockingJobs`).get()
  for (const jobDoc of jobsSnap.docs) {
    const data = jobDoc.data()
    const mappedCompoundId = compoundIdRemap.get(data.compoundId) || data.compoundId
    const mappedProteinId = proteinIdRemap.get(data.proteinId) || data.proteinId
    const expectedJobId = `${mappedCompoundId}__${mappedProteinId}`
    if (jobDoc.id !== expectedJobId) {
      await db.doc(`studies/${studyId}/dockingJobs/${jobDoc.id}`).delete()
    }
  }

  return {
    studyId,
    studyTitle,
    compoundsCount: compoundDocs.length,
    proteinsBeforeCount: proteinDocs.length,
    proteinsAfterCount: proteinGroupMap.size,
    duplicateProteinsRemoved,
    runsBeforeCount: runsSnap.docs.length,
    runsPreservedCount: allRuns.length,
    canonicalPairsCreated: pairSummaries.length,
    pairs: pairSummaries,
  }
}

export async function migrateAllStudies(): Promise<MigrationSummary[]> {
  const db = getAdminDb()
  const studiesSnap = await db.collection("studies").get()
  const summaries: MigrationSummary[] = []
  for (const doc of studiesSnap.docs) {
    const summary = await migrateStudyDocking(doc.id)
    summaries.push(summary)
  }
  return summaries
}
