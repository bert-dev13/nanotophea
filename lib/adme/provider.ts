/**
 * Configured ADME provider.
 *
 * The research protocol calls for SwissADME. That service has no supported
 * programmatic API, so the configured provider is ADMET-AI. Callers display
 * `provider.name` and must not rename it to SwissADME.
 */
import { loadAdmetAiProvider } from "@/lib/adme/providers/admetAi"
import {
  ADME_METHOD_LABEL,
  ADME_MODEL_NAME,
  ADME_PROVIDER_NAME,
  type AdmeEngineIdentity,
  type AdmeProvider,
} from "@/lib/adme/types"

export type { AdmeEngineIdentity }

export function engineIdentity(provider: Pick<AdmeProvider, "name" | "version" | "method" | "model">): AdmeEngineIdentity {
  return {
    name: provider.name,
    version: provider.version,
    method: provider.method,
    model: provider.model,
  }
}

export async function getAdmeProvider(): Promise<AdmeProvider> {
  return loadAdmetAiProvider()
}

export const CONFIGURED_ADME_PROVIDER = {
  name: ADME_PROVIDER_NAME,
  method: ADME_METHOD_LABEL,
  model: ADME_MODEL_NAME,
} as const
