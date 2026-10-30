import type { PredictionEndpoint } from "@/lib/domain/models"
import { simulateBax } from "@/lib/predictions/prototype/bax"
import { simulateDpph } from "@/lib/predictions/prototype/dpph"
import { simulateHippoYap } from "@/lib/predictions/prototype/hippo-yap"
import { simulateLdh } from "@/lib/predictions/prototype/ldh"
import { simulateMtt } from "@/lib/predictions/prototype/mtt"
import { simulateRos } from "@/lib/predictions/prototype/ros"
import type { PrototypePredictionResult } from "@/lib/predictions/prototype/types"
import type { PredictionFeatures } from "@/lib/predictions/types"

const RUNNERS: Record<PredictionEndpoint, (features: PredictionFeatures) => PrototypePredictionResult> = {
  dpph: simulateDpph,
  mtt: simulateMtt,
  ldh: simulateLdh,
  ros: simulateRos,
  bax: simulateBax,
  hippo_yap: simulateHippoYap,
}

export function runPrototype(endpoint: PredictionEndpoint, features: PredictionFeatures): PrototypePredictionResult {
  return RUNNERS[endpoint](features)
}
