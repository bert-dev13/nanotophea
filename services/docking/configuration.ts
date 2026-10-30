import {
  ApprovedDockingConfigurationSchema,
  type ApprovedDockingConfiguration,
} from "@/lib/domain/models"
import { CONFIG_REQUIRED, ENGINE_UNAVAILABLE, type EngineStatus } from "@/services/docking/types"

export function configurationForProtein(
  rows: ApprovedDockingConfiguration[] | undefined,
  proteinId: string,
): ApprovedDockingConfiguration | null {
  const row = rows?.find((item) => item.proteinId === proteinId)
  if (!row) return null
  const parsed = ApprovedDockingConfigurationSchema.safeParse(row)
  return parsed.success ? parsed.data : null
}

/** An older approval without this PDB does not authorize a run. */
export function configurationMatchesPdb(
  configuration: { pdbId?: string } | null | undefined,
  pdbId: string | undefined,
): boolean {
  const saved = configuration?.pdbId?.trim().toUpperCase()
  const current = pdbId?.trim().toUpperCase()
  return Boolean(saved && current && saved === current)
}

/** A run may start only when Vina can execute and this target has an approved search space. */
export function dockingBlocker(
  engine: Pick<EngineStatus, "available">,
  configuration: ApprovedDockingConfiguration | null,
): typeof ENGINE_UNAVAILABLE | typeof CONFIG_REQUIRED | null {
  if (!engine.available) return ENGINE_UNAVAILABLE
  if (!configuration) return CONFIG_REQUIRED
  return null
}
