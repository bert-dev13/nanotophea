import { NextResponse } from "next/server"
import { runPrediction } from "@/lib/predictions/engine"
import { runPrototype } from "@/lib/predictions/prototype"
import type { PredictionEndpoint, PredictionFeatures } from "@/lib/predictions/types"

const ENDPOINTS = new Set<PredictionEndpoint>(["dpph", "mtt", "ldh", "ros", "bax", "hippo_yap"])

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    endpoint?: string
    features?: PredictionFeatures
    mode?: string
  } | null
  if (!body || !body.endpoint || !ENDPOINTS.has(body.endpoint as PredictionEndpoint) || !body.features?.phytochemicalId) {
    return NextResponse.json({ error: "Prediction request is incomplete." }, { status: 400 })
  }
  const features: PredictionFeatures = {
    ...body.features,
    docking: (body.features.docking ?? []).filter((row) => Number.isFinite(row.affinityKcalMol)),
    admeDescriptors: body.features.admeDescriptors ?? {},
    targetProteinIds: body.features.targetProteinIds ?? [],
  }
  if (body.mode === "prototype") {
    return NextResponse.json(runPrototype(body.endpoint as PredictionEndpoint, features))
  }
  return NextResponse.json(runPrediction(body.endpoint as PredictionEndpoint, features))
}
