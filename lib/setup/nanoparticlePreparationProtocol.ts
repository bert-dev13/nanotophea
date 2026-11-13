import { z } from "zod"

/** Step progress for optional nanoparticle preparation documentation. */
export const PreparationStepStatusSchema = z.enum(["pending", "completed", "skipped"])
export type PreparationStepStatus = z.infer<typeof PreparationStepStatusSchema>

export const YesNoSchema = z.enum(["yes", "no", ""])
export const ThermalStabilitySchema = z.enum(["yes", "no", "not_established", ""])

export const NanoparticleIngredientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  amount: z.string().optional().default(""),
  unit: z.string().optional().default(""),
  /** Optional concentration (not used as mass for ratio). */
  concentration: z.string().optional().default(""),
  concentrationUnit: z.string().optional().default(""),
  /** For solvent rows: researcher-specified solvent name/type (name may stay generic). */
  solventName: z.string().optional().default(""),
  functionInFormulation: z.string().optional().default(""),
  preparationNotes: z.string().optional().default(""),
  /** Preset from protocol (e.g. maltodextrin 7.00 g); researcher may still edit actuals. */
  isPreset: z.boolean().optional().default(false),
  prescribedAmount: z.string().optional(),
  prescribedUnit: z.string().optional(),
})
export type NanoparticleIngredient = z.infer<typeof NanoparticleIngredientSchema>

export const FormulationRatioRecordSchema = z.object({
  value: z.string().optional().default(""),
  /** manual = researcher-supplied; calculated = from compatible mass amounts; none = not recorded */
  provenance: z.enum(["manual", "calculated", "none"]).default("none"),
})
export type FormulationRatioRecord = z.infer<typeof FormulationRatioRecordSchema>

export const StabilizationStepSchema = z.object({
  status: PreparationStepStatusSchema.default("pending"),
  prescribedStirringRpm: z.string().default("200–300"),
  prescribedDurationMin: z.string().default("30"),
  prescribedTemperatureNote: z.string().default("Room temperature"),
  actualStirringRpm: z.string().optional().default(""),
  actualDurationMin: z.string().optional().default(""),
  roomTemperatureC: z.string().optional().default(""),
  visibleAggregation: YesNoSchema.default(""),
  visiblePrecipitation: YesNoSchema.default(""),
  observations: z.string().optional().default(""),
  updatedAt: z.string().optional(),
})
export type StabilizationStep = z.infer<typeof StabilizationStepSchema>

export const MaltodextrinStepSchema = z.object({
  status: PreparationStepStatusSchema.default("pending"),
  prescribedAmountG: z.string().default("7.00"),
  prescribedStirringMin: z.string().default("5–10"),
  actualAmountG: z.string().optional().default(""),
  actualDurationMin: z.string().optional().default(""),
  uniformDispersion: YesNoSchema.default(""),
  observations: z.string().optional().default(""),
  updatedAt: z.string().optional(),
})
export type MaltodextrinStep = z.infer<typeof MaltodextrinStepSchema>

export const DryingTraysStepSchema = z.object({
  status: PreparationStepStatusSchema.default("pending"),
  prescribedTrayCount: z.string().default("2–3"),
  trayCount: z.string().optional().default(""),
  trayType: z.string().optional().default(""),
  dryingSheet: z.string().optional().default(""),
  thinLayerDistribution: YesNoSchema.default(""),
  observations: z.string().optional().default(""),
  updatedAt: z.string().optional(),
})
export type DryingTraysStep = z.infer<typeof DryingTraysStepSchema>

export const OvenDryingStepSchema = z.object({
  status: PreparationStepStatusSchema.default("pending"),
  prescribedTemperatureC: z.string().default("50"),
  actualTemperatureC: z.string().optional().default(""),
  dryingDuration: z.string().optional().default(""),
  initialMassG: z.string().optional().default(""),
  finalMassG: z.string().optional().default(""),
  constantMassAchieved: YesNoSchema.default(""),
  thermalStabilityAbove60: ThermalStabilitySchema.default("not_established"),
  observations: z.string().optional().default(""),
  updatedAt: z.string().optional(),
})
export type OvenDryingStep = z.infer<typeof OvenDryingStepSchema>

export const PreparationEditHistoryEntrySchema = z.object({
  at: z.string(),
  actorId: z.string().optional(),
  section: z.string(),
  note: z.string().optional(),
})
export type PreparationEditHistoryEntry = z.infer<typeof PreparationEditHistoryEntrySchema>

const defaultStabilization = (): StabilizationStep => StabilizationStepSchema.parse({})
const defaultMaltodextrin = (): MaltodextrinStep =>
  MaltodextrinStepSchema.parse({ actualAmountG: "7.00" })
const defaultDryingTrays = (): DryingTraysStep => DryingTraysStepSchema.parse({})
const defaultOvenDrying = (): OvenDryingStep =>
  OvenDryingStepSchema.parse({ thermalStabilityAbove60: "not_established" })

export const NanoparticlePreparationProtocolSchema = z.object({
  version: z.literal(1).default(1),
  ingredients: z.array(NanoparticleIngredientSchema).default([]),
  formulationRatio: FormulationRatioRecordSchema.default({ value: "", provenance: "none" }),
  stabilization: StabilizationStepSchema.default(defaultStabilization),
  maltodextrin: MaltodextrinStepSchema.default(defaultMaltodextrin),
  dryingTrays: DryingTraysStepSchema.default(defaultDryingTrays),
  ovenDrying: OvenDryingStepSchema.default(defaultOvenDrying),
  editHistory: z.array(PreparationEditHistoryEntrySchema).default([]),
})
export type NanoparticlePreparationProtocol = z.infer<typeof NanoparticlePreparationProtocolSchema>

export function appendPreparationHistory(
  protocol: NanoparticlePreparationProtocol,
  section: string,
  note?: string,
  actorId?: string,
): NanoparticlePreparationProtocol {
  const entry = {
    at: new Date().toISOString(),
    actorId,
    section,
    note,
  }
  return {
    ...protocol,
    editHistory: [...(protocol.editHistory ?? []), entry].slice(-40),
  }
}

export const PREPARATION_STEPS = [
  {
    id: "stabilization" as const,
    phase: "Phase IV",
    step: "Step 8",
    title: "Stabilization of nanoparticle suspension",
    description:
      "After TPP addition, reduce stirring to 200–300 RPM and continue for 30 minutes at room temperature. Observe for aggregation or precipitation.",
  },
  {
    id: "maltodextrin" as const,
    phase: "Phase V",
    step: "Step 9",
    title: "Incorporation of maltodextrin",
    description:
      "Add 7.00 g maltodextrin powder into the suspension and stir 5–10 minutes until uniformly dispersed.",
  },
  {
    id: "dryingTrays" as const,
    phase: "Phase VI",
    step: "Step 10",
    title: "Preparation of drying trays",
    description:
      "Prepare 2–3 clean trays or glass dishes, line with oven-compatible sheets, and spread a thin even layer.",
  },
  {
    id: "ovenDrying" as const,
    phase: "Phase VI",
    step: "Step 11",
    title: "Oven drying",
    description:
      "Preheat to approximately 50°C and dry to constant mass. Avoid temperatures above 60°C unless thermal stability is established.",
  },
] as const

export type PreparationStepId = (typeof PREPARATION_STEPS)[number]["id"]

export function defaultNanoparticleIngredients(): NanoparticleIngredient[] {
  return [
    NanoparticleIngredientSchema.parse({
      id: "chitosan",
      name: "Chitosan",
      functionInFormulation: "Polycationic polymer / nanoparticle matrix",
    }),
    NanoparticleIngredientSchema.parse({
      id: "tpp",
      name: "Tripolyphosphate (TPP)",
      functionInFormulation: "Polyanionic crosslinker",
    }),
    NanoparticleIngredientSchema.parse({
      id: "solvent",
      name: "Solvent / vehicle",
      functionInFormulation: "Dissolution / suspension medium",
    }),
    NanoparticleIngredientSchema.parse({
      id: "maltodextrin",
      name: "Maltodextrin",
      amount: "7.00",
      unit: "g",
      functionInFormulation: "Drying carrier",
      isPreset: true,
      prescribedAmount: "7.00",
      prescribedUnit: "g",
    }),
  ]
}

export function emptyNanoparticlePreparationProtocol(): NanoparticlePreparationProtocol {
  return NanoparticlePreparationProtocolSchema.parse({
    version: 1,
    ingredients: defaultNanoparticleIngredients(),
    stabilization: defaultStabilization(),
    maltodextrin: defaultMaltodextrin(),
    dryingTrays: defaultDryingTrays(),
    ovenDrying: defaultOvenDrying(),
    editHistory: [],
  })
}

export function parseNanoparticlePreparationProtocol(value: unknown): NanoparticlePreparationProtocol {
  if (!value || typeof value !== "object") return emptyNanoparticlePreparationProtocol()
  try {
    const parsed = NanoparticlePreparationProtocolSchema.parse(value)
    if (!parsed.ingredients.length) {
      return { ...parsed, ingredients: defaultNanoparticleIngredients() }
    }
    // Ensure maltodextrin preset exists if researcher cleared the list partially.
    const hasMaltodextrin = parsed.ingredients.some((row) => /maltodextrin/i.test(row.name) || row.id === "maltodextrin")
    if (!hasMaltodextrin) {
      return {
        ...parsed,
        ingredients: [...parsed.ingredients, ...defaultNanoparticleIngredients().filter((row) => row.id === "maltodextrin")],
      }
    }
    return parsed
  } catch {
    return emptyNanoparticlePreparationProtocol()
  }
}

export function preparationStepStatusOf(
  protocol: NanoparticlePreparationProtocol,
  stepId: PreparationStepId,
): PreparationStepStatus {
  return protocol[stepId].status
}

export function preparationProgress(protocol: NanoparticlePreparationProtocol): {
  completed: number
  skipped: number
  pending: number
  total: number
} {
  const statuses = PREPARATION_STEPS.map((step) => protocol[step.id].status)
  return {
    completed: statuses.filter((s) => s === "completed").length,
    skipped: statuses.filter((s) => s === "skipped").length,
    pending: statuses.filter((s) => s === "pending").length,
    total: statuses.length,
  }
}

/** Warn when oven temperature exceeds 60°C without established thermal stability. */
export function ovenThermalWarning(step: OvenDryingStep): string | null {
  const temp = Number.parseFloat(String(step.actualTemperatureC ?? "").replace(/,/g, "."))
  if (!Number.isFinite(temp) || temp <= 60) return null
  if (step.thermalStabilityAbove60 === "yes") return null
  return "Actual oven temperature exceeds 60°C and thermal stability above 60°C has not been established. Record thermal stability or lower the drying temperature."
}

export function valueOrNotRecorded(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim()
  return trimmed ? trimmed : "Not recorded"
}

export function yesNoLabel(value: string | null | undefined): string {
  if (value === "yes") return "Yes"
  if (value === "no") return "No"
  return "Not recorded"
}

export function thermalStabilityLabel(value: string | null | undefined): string {
  if (value === "yes") return "Yes"
  if (value === "no") return "No"
  if (value === "not_established") return "Not established"
  return "Not recorded"
}
