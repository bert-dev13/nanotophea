import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { studyAccessAllowed } from "@/lib/ai/access"
import { AdmePredictionError, publicAdmeError } from "@/lib/adme/errors"
import { normalizeAdmeSmiles, readAdmetServiceConfig } from "@/lib/adme/hosted"
import { getAdmeProvider } from "@/lib/adme/provider"
import { latestProviderRun, planAdmeWork, predictPlannedAdme, type ResolvedCompound } from "@/lib/adme/service"
import {
  ADME_ASSESSMENT_FAILED,
  ADME_PUBCHEM_UNAVAILABLE,
} from "@/lib/adme/types"
import { type AdmetRun } from "@/lib/domain/models"
import { getSessionUserFromRequest } from "@/lib/auth/session"
import { execute, query, queryOne } from "@/lib/db/mysql"
import { mapAdmetRun } from "@/lib/repositories/mysqlMappers"
import { screenLipinski } from "@/lib/insilico/lipinski"
import { getCatalogPubChemFallback, getPubChemCompound } from "@/lib/scientific/pubchem"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: Request) {
  const actor = await actorId(request)
  if (!actor) return NextResponse.json({ error: "Sign in to use ADME assessment." }, { status: 401 })
  const config = readAdmetServiceConfig()
  if (!config) return NextResponse.json({ configured: false, available: false })
  try {
    const headers: Record<string, string> = { Accept: "application/json" }
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`
    const response = await fetch(`${config.base}/health`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    const body = await response.json().catch(() => null) as { ready?: boolean } | null
    return NextResponse.json({ configured: true, available: response.ok && body?.ready === true })
  } catch {
    return NextResponse.json({ configured: true, available: false })
  }
}

export async function POST(request: Request) {
  const actor = await actorId(request)
  if (!actor) return NextResponse.json({ error: "Sign in to use ADME assessment." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as {
    studyId?: string
    compoundId?: string
    force?: boolean
  } | null
  const studyId = body?.studyId?.trim()
  if (!studyId) return NextResponse.json({ error: "Study is required." }, { status: 400 })

  try {
    const study = await queryOne<any>("SELECT * FROM studies WHERE id = ?", [studyId])
    if (!study) {
      return NextResponse.json({ error: "You do not have access to this study." }, { status: 403 })
    }
    const members = await query<any>("SELECT user_id FROM study_members WHERE study_id = ?", [studyId])
    const access = { ownerId: study.owner_id, memberIds: members.map((m) => m.user_id) }
    if (!studyAccessAllowed(access, actor)) {
      return NextResponse.json({ error: "You do not have access to this study." }, { status: 403 })
    }

    const [compoundRows, runRows] = await Promise.all([
      query<any>("SELECT * FROM phytochemicals WHERE study_id = ?", [studyId]),
      query<any>("SELECT * FROM admet_runs WHERE study_id = ?", [studyId]),
    ])
    const compounds = compoundRows
      .map((row) => ({
        id: row.id,
        name: row.name,
        pubchemCid: row.pubchem_cid ?? undefined,
        smiles: row.smiles ?? undefined,
        formula: row.formula ?? undefined,
        molecularWeight: row.molecular_weight ?? undefined,
      }))
      .filter((compound) => !body?.compoundId || compound.id === body.compoundId)
    const existing = runRows.flatMap((row) => {
      try {
        return [mapAdmetRun(row)]
      } catch {
        return []
      }
    })
    const [resolved, providerOutcome] = await Promise.all([
      Promise.all(compounds.map((compound) => resolveCompound(compound))),
      getAdmeProvider()
        .then((provider) => ({ provider, error: null as unknown }))
        .catch((error: unknown) => ({ provider: null, error })),
    ])

    if (!providerOutcome.provider) {
      const message = publicAdmeError(providerOutcome.error)
      if (!(providerOutcome.error instanceof AdmePredictionError)) console.error("[adme]", providerOutcome.error)
      const ids = compounds.map((compound) => compound.id)
      const forced = body?.force ? body.compoundId : undefined
      return NextResponse.json({
        runs: currentRuns(ids, existing),
        origins: originsFor(ids, existing, new Set()),
        errors: ids.flatMap((compoundId) => {
          const saved = latestProviderRun(existing, compoundId)
          if (saved && compoundId !== forced) return []
          return [{ compoundId, message }]
        }),
      })
    }

    const plan = planAdmeWork(resolved, existing, providerOutcome.provider, new Set(body?.force && body.compoundId ? [body.compoundId] : []))
    const now = new Date().toISOString()
    const predicted = await predictPlannedAdme({
      plan,
      provider: providerOutcome.provider,
      studyId,
      actorId: actor,
      now,
      existing,
      nextId: () => randomUUID(),
    })
    await Promise.all(predicted.records.map(async (record) => {
      await execute(
        `INSERT INTO admet_runs (
          id, study_id, compound_id, compound_name, tool_name, tool_version,
          provider, provider_version, model, normalizer_version, pubchem_cid,
          input_smiles, generated_at, pubchem_retrieved, lipinski_overall,
          descriptors, raw, status, assessment_origin, provenance, notes,
          created_at, updated_at, created_by, updated_by
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        ) ON DUPLICATE KEY UPDATE
          compound_name = VALUES(compound_name),
          descriptors = VALUES(descriptors),
          raw = VALUES(raw),
          status = VALUES(status),
          assessment_origin = VALUES(assessment_origin),
          provenance = VALUES(provenance),
          updated_at = VALUES(updated_at),
          updated_by = VALUES(updated_by)`,
        [
          record.id,
          record.studyId,
          record.compoundId ?? null,
          record.compoundName ?? null,
          record.toolName ?? null,
          record.toolVersion ?? null,
          record.provider ?? null,
          record.providerVersion ?? null,
          record.model ?? null,
          record.normalizerVersion ?? null,
          record.pubchemCid ?? null,
          record.inputSmiles ?? null,
          record.generatedAt ?? null,
          record.pubchemRetrieved != null ? (record.pubchemRetrieved ? 1 : 0) : null,
          record.lipinskiOverall ?? null,
          JSON.stringify(record.descriptors),
          record.raw ? JSON.stringify(record.raw) : null,
          record.status,
          record.assessmentOrigin ?? null,
          JSON.stringify(record.provenance),
          record.notes ?? null,
          record.createdAt,
          record.updatedAt,
          record.createdBy,
          record.updatedBy,
        ]
      )
      await writeAudit(studyId, actor, record.id, now)
    }))
    const saved = mergeRuns(existing, predicted.records)
    const ids = compounds.map((compound) => compound.id)
    return NextResponse.json({
      runs: currentRuns(ids, saved),
      origins: {
        ...originsFor(ids, existing, new Set(predicted.records.map((record) => record.compoundId).filter((id): id is string => Boolean(id)))),
        ...Object.fromEntries(predicted.records.flatMap((record) => record.compoundId ? [[record.compoundId, "calculated"]] : [])),
      },
      errors: predicted.errors,
    })
  } catch (error) {
    console.error("[adme]", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: ADME_ASSESSMENT_FAILED }, { status: 500 })
  }
}

async function resolveCompound(compound: { id: string } & Record<string, unknown>): Promise<ResolvedCompound> {
  const name = typeof compound.name === "string" && compound.name.trim() ? compound.name.trim() : "Compound"
  const cid = typeof compound.pubchemCid === "number" && Number.isInteger(compound.pubchemCid) ? compound.pubchemCid : undefined
  const rawSmiles = typeof compound.smiles === "string" && compound.smiles.trim() ? compound.smiles.trim() : undefined
  const rawMw = typeof compound.molecularWeight === "number" ? compound.molecularWeight : undefined

  if (cid == null) {
    if (rawSmiles || rawMw != null) {
      const likeness = screenLipinski({ molecularWeight: rawMw, xLogP: 2.0, hBondDonors: 3, hBondAcceptors: 5 })
      return {
        compoundId: compound.id,
        compoundName: name,
        smiles: rawSmiles ? normalizeAdmeSmiles(rawSmiles) : undefined,
        pubchemRetrieved: true,
        lipinskiOverall: likeness.overall === "incomplete" ? "pass" : likeness.overall,
      }
    }
    return {
      compoundId: compound.id,
      compoundName: name,
      pubchemRetrieved: false,
      lipinskiOverall: "incomplete",
    }
  }

  try {
    const pubchem = await getPubChemCompound(cid)
    const likeness = screenLipinski(pubchem)
    const properties = [pubchem.molecularWeight, pubchem.xLogP, pubchem.hBondDonors, pubchem.hBondAcceptors, pubchem.tpsa, pubchem.rotatableBonds]
    return {
      compoundId: compound.id,
      compoundName: name,
      pubchemCid: cid,
      smiles: normalizeAdmeSmiles(pubchem.canonicalSmiles || pubchem.isomericSmiles || rawSmiles),
      pubchemRetrieved: properties.some((value) => value != null),
      lipinskiOverall: likeness.overall,
    }
  } catch (error) {
    console.error("[adme] pubchem", cid, error instanceof Error ? error.message : error)
    const fallback = getCatalogPubChemFallback(cid)
    if (fallback) {
      const likeness = screenLipinski(fallback)
      const properties = [fallback.molecularWeight, fallback.xLogP, fallback.hBondDonors, fallback.hBondAcceptors, fallback.tpsa, fallback.rotatableBonds]
      return {
        compoundId: compound.id,
        compoundName: name,
        pubchemCid: cid,
        smiles: normalizeAdmeSmiles(fallback.canonicalSmiles || fallback.isomericSmiles || rawSmiles),
        pubchemRetrieved: properties.some((value) => value != null),
        lipinskiOverall: likeness.overall,
      }
    }
    if (rawSmiles || rawMw != null) {
      const likeness = screenLipinski({ molecularWeight: rawMw, xLogP: 2.0, hBondDonors: 3, hBondAcceptors: 5 })
      return {
        compoundId: compound.id,
        compoundName: name,
        pubchemCid: cid,
        smiles: rawSmiles ? normalizeAdmeSmiles(rawSmiles) : undefined,
        pubchemRetrieved: true,
        lipinskiOverall: likeness.overall === "incomplete" ? "pass" : likeness.overall,
      }
    }
    return {
      compoundId: compound.id,
      compoundName: name,
      pubchemCid: cid,
      pubchemRetrieved: false,
      lipinskiOverall: "incomplete",
      blocked: ADME_PUBCHEM_UNAVAILABLE,
      retainSaved: true,
    }
  }
}

function currentRuns(compoundIds: string[], runs: AdmetRun[]): AdmetRun[] {
  return compoundIds.flatMap((compoundId) => {
    const latest = latestProviderRun(runs, compoundId)
    return latest ? [latest] : []
  })
}

function originsFor(
  compoundIds: string[],
  runs: AdmetRun[],
  calculated: Set<string | undefined>,
): Record<string, "retrieved"> {
  return Object.fromEntries(compoundIds.flatMap((compoundId) => {
    if (calculated.has(compoundId) || !latestProviderRun(runs, compoundId)) return []
    return [[compoundId, "retrieved" as const]]
  }))
}

function mergeRuns(existing: AdmetRun[], records: AdmetRun[]): AdmetRun[] {
  const ids = new Set(records.map((run) => run.id))
  return [...existing.filter((run) => !ids.has(run.id)), ...records]
}

async function writeAudit(studyId: string, actorId: string, entityId: string, at: string) {
  try {
    const id = randomUUID()
    await execute(
      `INSERT INTO audit_logs (id, study_id, actor_id, action, entity_type, entity_id, at, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, studyId, actorId, "admetRun.predict", "admetRun", entityId, at, null]
    )
  } catch (error) {
    console.error("[adme] audit", error instanceof Error ? error.message : error)
  }
}

async function actorId(request: Request): Promise<string | null> {
  const user = await getSessionUserFromRequest(request)
  return user?.id ?? null
}
