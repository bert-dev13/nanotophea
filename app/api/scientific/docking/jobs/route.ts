import { isCompleteDockingProfile, profileSpecForProtein } from "@/lib/docking/profiles"
import { NextResponse } from "next/server"
import { getSessionUserFromRequest } from "@/lib/auth/session"
import { query } from "@/lib/db/mysql"
import { DockingRejected, enqueueDocking, listDockingJobs } from "@/services/docking/jobs"

export async function GET(request: Request) {
  const actor = await actorId(request)
  if (!actor) return NextResponse.json({ error: "Sign in to use docking." }, { status: 401 })
  const studyId = new URL(request.url).searchParams.get("studyId")?.trim()
  if (!studyId) return NextResponse.json({ error: "Study is required." }, { status: 400 })
  const jobs = await listDockingJobs(studyId)
  return NextResponse.json({ jobs })
}

export async function POST(request: Request) {
  const actor = await actorId(request)
  if (!actor) return NextResponse.json({ error: "Sign in to use docking." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as {
    studyId?: string
    compoundId?: string
    proteinId?: string
    scope?: string
  } | null
  if (!body?.studyId) return NextResponse.json({ error: "Study is required." }, { status: 400 })
  try {
    const pairs = body.scope === "unfinished"
      ? await unfinishedPairs(body.studyId)
      : body.compoundId && body.proteinId
        ? [{ compoundId: body.compoundId, proteinId: body.proteinId }]
        : []
    if (!pairs.length) return NextResponse.json({ error: "No docking pair was selected." }, { status: 400 })
    const jobs = []
    const rejected: string[] = []
    for (const pair of pairs) {
      try {
        jobs.push(await enqueueDocking({ studyId: body.studyId, actorId: actor, ...pair }))
      } catch (error) {
        if (error instanceof DockingRejected) rejected.push(error.message)
        else throw error
      }
    }
    if (!jobs.length && rejected.length) {
      return NextResponse.json({ error: rejected[0], jobs: [] }, { status: 409 })
    }
    return NextResponse.json({ jobs, rejected })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vina execution failure"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function actorId(request: Request): Promise<string | null> {
  const user = await getSessionUserFromRequest(request)
  return user?.id ?? null
}

async function unfinishedPairs(studyId: string): Promise<Array<{ compoundId: string; proteinId: string }>> {
  const [compounds, proteins, runs] = await Promise.all([
    query<any>("SELECT * FROM phytochemicals WHERE study_id = ?", [studyId]),
    query<any>("SELECT * FROM target_proteins WHERE study_id = ?", [studyId]),
    query<any>("SELECT * FROM docking_runs WHERE study_id = ?", [studyId]),
  ])
  const done = new Set(
    runs
      .filter((r) => {
        if (r.status === "SKIPPED") return true
        const modes = typeof r.modes === "string" ? JSON.parse(r.modes) : r.modes
        return Array.isArray(modes) && modes.length > 0 && Number.isFinite(r.best_binding_affinity_kcal_mol)
      })
      .map((r) => `${r.compound_id}__${r.protein_id}`),
  )
  const pairs: Array<{ compoundId: string; proteinId: string }> = []
  for (const compound of compounds) {
    for (const protein of proteins) {
      if (done.has(`${compound.id}__${protein.id}`)) continue
      const uniprotIds = typeof protein.uniprot_ids === "string" ? JSON.parse(protein.uniprot_ids) : (protein.uniprot_ids || [])
      const spec = profileSpecForProtein({
        pdbId: typeof protein.pdb_id === "string" ? protein.pdb_id : undefined,
        uniprotIds: Array.isArray(uniprotIds)
          ? uniprotIds.filter((id: unknown): id is string => typeof id === "string")
          : [],
      })
      if (!spec || !isCompleteDockingProfile(spec)) continue
      pairs.push({ compoundId: compound.id, proteinId: protein.id })
    }
  }
  return pairs
}
