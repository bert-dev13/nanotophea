import type { NanoparticleFormulation } from "@/lib/domain/models"
import {
  appendPreparationHistory,
  defaultNanoparticleIngredients,
  emptyNanoparticlePreparationProtocol,
  NanoparticleIngredientSchema,
  parseNanoparticlePreparationProtocol,
  type NanoparticleIngredient,
  type NanoparticlePreparationProtocol,
} from "@/lib/setup/nanoparticlePreparationProtocol"

export type MassUnit = "g" | "mg"
export type VolumeUnit = "mL" | "L"

export interface FormulationEditForm {
  chitosanAmount: string
  chitosanUnit: MassUnit | ""
  chitosanConcentration: string
  chitosanConcentrationUnit: string
  tppAmount: string
  tppUnit: MassUnit | ""
  tppConcentration: string
  tppConcentrationUnit: string
  maltodextrinAmount: string
  maltodextrinUnit: MassUnit | ""
  solventName: string
  solventAmount: string
  solventUnit: VolumeUnit | ""
  /** Researcher-supplied ratio text (Chitosan:TPP). Empty = not manually set. */
  ratioManual: string
}

const MASS_UNITS = new Set(["g", "mg"])
const VOLUME_UNITS = new Set(["mL", "L", "ml", "l"])

export function emptyFormulationEditForm(): FormulationEditForm {
  return {
    chitosanAmount: "",
    chitosanUnit: "g",
    chitosanConcentration: "",
    chitosanConcentrationUnit: "mg/mL",
    tppAmount: "",
    tppUnit: "g",
    tppConcentration: "",
    tppConcentrationUnit: "mg/mL",
    maltodextrinAmount: "7.00",
    maltodextrinUnit: "g",
    solventName: "",
    solventAmount: "",
    solventUnit: "mL",
    ratioManual: "",
  }
}

function findIngredient(
  ingredients: NanoparticleIngredient[],
  id: string,
): NanoparticleIngredient | undefined {
  return ingredients.find((row) => row.id === id)
}

export function formulationEditFormFromRecord(
  record: NanoparticleFormulation | null | undefined,
): FormulationEditForm {
  const base = emptyFormulationEditForm()
  if (!record) return base
  const protocol = parseNanoparticlePreparationProtocol(record.preparationProtocol)
  const chitosan = findIngredient(protocol.ingredients, "chitosan")
  const tpp = findIngredient(protocol.ingredients, "tpp")
  const maltodextrin = findIngredient(protocol.ingredients, "maltodextrin")
  const solvent = findIngredient(protocol.ingredients, "solvent")

  const chitosanUnit = normalizeMassUnit(chitosan?.unit) || "g"
  const tppUnit = normalizeMassUnit(tpp?.unit) || "g"
  const maltUnit = normalizeMassUnit(maltodextrin?.unit) || "g"
  const solventUnit = normalizeVolumeUnit(solvent?.unit) || "mL"

  const ratioManual =
    protocol.formulationRatio?.provenance === "manual"
      ? protocol.formulationRatio.value || ""
      : ""

  return {
    chitosanAmount: (chitosan?.amount ?? "").trim(),
    chitosanUnit,
    chitosanConcentration:
      (chitosan?.concentration ?? "").trim() || (record.chitosanConcentration ?? "").trim(),
    chitosanConcentrationUnit:
      (chitosan?.concentrationUnit ?? "").trim() ||
      (record.chitosanConcentrationUnit ?? "").trim() ||
      "mg/mL",
    tppAmount: (tpp?.amount ?? "").trim(),
    tppUnit,
    tppConcentration: (tpp?.concentration ?? "").trim() || (record.tppConcentration ?? "").trim(),
    tppConcentrationUnit:
      (tpp?.concentrationUnit ?? "").trim() ||
      (record.tppConcentrationUnit ?? "").trim() ||
      "mg/mL",
    maltodextrinAmount: (maltodextrin?.amount ?? "").trim() || "7.00",
    maltodextrinUnit: maltUnit,
    solventName: (solvent?.solventName ?? "").trim() || (record.chitosanSolvent ?? "").trim(),
    solventAmount: (solvent?.amount ?? "").trim(),
    solventUnit,
    ratioManual,
  }
}

export function normalizeMassUnit(unit?: string | null): MassUnit | "" {
  const u = (unit ?? "").trim().toLowerCase()
  if (u === "g") return "g"
  if (u === "mg") return "mg"
  return ""
}

export function normalizeVolumeUnit(unit?: string | null): VolumeUnit | "" {
  const u = (unit ?? "").trim()
  if (u === "mL" || u === "ml") return "mL"
  if (u === "L" || u === "l") return "L"
  return ""
}

function parsePositiveNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, ".")
  if (!trimmed) return null
  const n = Number.parseFloat(trimmed)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** Convert mass to grams when unit is g or mg. Returns null if incompatible/missing. */
export function massToGrams(amount: string, unit: string): number | null {
  const n = parsePositiveNumber(amount)
  const u = normalizeMassUnit(unit)
  if (n == null || !u) return null
  return u === "mg" ? n / 1000 : n
}

/**
 * Calculate Chitosan:TPP mass ratio only from compatible mass amounts.
 * Does not use concentrations or invent defaults.
 */
export function calculateChitosanTppRatio(
  chitosanAmount: string,
  chitosanUnit: string,
  tppAmount: string,
  tppUnit: string,
): string | null {
  const chitosanG = massToGrams(chitosanAmount, chitosanUnit)
  const tppG = massToGrams(tppAmount, tppUnit)
  if (chitosanG == null || tppG == null || tppG === 0) return null
  const ratio = chitosanG / tppG
  if (!Number.isFinite(ratio)) return null
  // Compact display: up to 3 significant figures for the relative mass
  const rounded = ratio >= 10 ? ratio.toFixed(1) : ratio >= 1 ? ratio.toFixed(2) : ratio.toPrecision(3)
  return `${trimTrailingZeros(rounded)}:1`
}

function trimTrailingZeros(value: string): string {
  if (!value.includes(".")) return value
  return value.replace(/\.?0+$/, "")
}

export function validateFormulationEditForm(form: FormulationEditForm): string | null {
  const checkMass = (label: string, amount: string, unit: string) => {
    if (!amount.trim()) return null
    if (parsePositiveNumber(amount) == null) return `${label} amount must be a non-negative number.`
    if (!normalizeMassUnit(unit)) return `${label} unit must be g or mg.`
    return null
  }
  const chitosanErr = checkMass("Chitosan", form.chitosanAmount, form.chitosanUnit)
  if (chitosanErr) return chitosanErr
  const tppErr = checkMass("TPP", form.tppAmount, form.tppUnit)
  if (tppErr) return tppErr
  const maltErr = checkMass("Maltodextrin", form.maltodextrinAmount, form.maltodextrinUnit)
  if (maltErr) return maltErr

  if (form.chitosanConcentration.trim() && parsePositiveNumber(form.chitosanConcentration) == null) {
    return "Chitosan concentration must be a non-negative number."
  }
  if (form.tppConcentration.trim() && parsePositiveNumber(form.tppConcentration) == null) {
    return "TPP concentration must be a non-negative number."
  }

  if (form.solventAmount.trim()) {
    if (parsePositiveNumber(form.solventAmount) == null) {
      return "Solvent amount must be a non-negative number."
    }
    if (!normalizeVolumeUnit(form.solventUnit)) {
      return "Solvent unit must be mL or L."
    }
  }

  return null
}

export function resolveFormulationRatio(form: FormulationEditForm): {
  value: string
  provenance: "manual" | "calculated" | "none"
} {
  const manual = form.ratioManual.trim()
  if (manual) {
    return { value: manual, provenance: "manual" }
  }
  const calculated = calculateChitosanTppRatio(
    form.chitosanAmount,
    form.chitosanUnit,
    form.tppAmount,
    form.tppUnit,
  )
  if (calculated) {
    return { value: calculated, provenance: "calculated" }
  }
  return { value: "", provenance: "none" }
}

function upsertIngredient(
  ingredients: NanoparticleIngredient[],
  next: NanoparticleIngredient,
): NanoparticleIngredient[] {
  const idx = ingredients.findIndex((row) => row.id === next.id)
  if (idx < 0) return [...ingredients, next]
  const copy = [...ingredients]
  copy[idx] = { ...copy[idx], ...next }
  return copy
}

/** Apply edit form into preparation protocol + top-level nanoparticle fields for persistence. */
export function buildFormulationSavePayload(
  record: NanoparticleFormulation | null | undefined,
  form: FormulationEditForm,
): Partial<NanoparticleFormulation> {
  const existing = record
    ? parseNanoparticlePreparationProtocol(record.preparationProtocol)
    : emptyNanoparticlePreparationProtocol()

  let ingredients =
    existing.ingredients.length > 0 ? [...existing.ingredients] : defaultNanoparticleIngredients()

  ingredients = upsertIngredient(
    ingredients,
    NanoparticleIngredientSchema.parse({
      id: "chitosan",
      name: "Chitosan",
      amount: form.chitosanAmount.trim(),
      unit: form.chitosanAmount.trim() ? form.chitosanUnit || "g" : "",
      concentration: form.chitosanConcentration.trim(),
      concentrationUnit: form.chitosanConcentration.trim()
        ? form.chitosanConcentrationUnit.trim() || "mg/mL"
        : "",
      functionInFormulation: "Polycationic polymer / nanoparticle matrix",
      isPreset: false,
    }),
  )

  ingredients = upsertIngredient(
    ingredients,
    NanoparticleIngredientSchema.parse({
      id: "tpp",
      name: "Tripolyphosphate (TPP)",
      amount: form.tppAmount.trim(),
      unit: form.tppAmount.trim() ? form.tppUnit || "g" : "",
      concentration: form.tppConcentration.trim(),
      concentrationUnit: form.tppConcentration.trim()
        ? form.tppConcentrationUnit.trim() || "mg/mL"
        : "",
      functionInFormulation: "Polyanionic crosslinker",
      isPreset: false,
    }),
  )

  ingredients = upsertIngredient(
    ingredients,
    NanoparticleIngredientSchema.parse({
      id: "maltodextrin",
      name: "Maltodextrin",
      amount: form.maltodextrinAmount.trim() || "7.00",
      unit: form.maltodextrinUnit || "g",
      functionInFormulation: "Drying carrier",
      isPreset: true,
      prescribedAmount: "7.00",
      prescribedUnit: "g",
    }),
  )

  ingredients = upsertIngredient(
    ingredients,
    NanoparticleIngredientSchema.parse({
      id: "solvent",
      name: "Solvent / vehicle",
      solventName: form.solventName.trim(),
      amount: form.solventAmount.trim(),
      unit: form.solventAmount.trim() ? form.solventUnit || "mL" : "",
      functionInFormulation: "Dissolution / suspension medium",
      isPreset: false,
    }),
  )

  const ratio = resolveFormulationRatio(form)
  const protocol: NanoparticlePreparationProtocol = appendPreparationHistory(
    {
      ...existing,
      ingredients,
      formulationRatio: {
        value: ratio.value,
        provenance: ratio.provenance,
      },
      maltodextrin: {
        ...existing.maltodextrin,
        actualAmountG: form.maltodextrinAmount.trim() || existing.maltodextrin.actualAmountG || "7.00",
      },
    },
    "formulation_edit",
    "Saved study-specific formulation quantities",
  )

  return {
    systemName: record?.systemName || "Chitosan–TPP Nanoparticle System",
    carrierType: record?.carrierType || "chitosan_tpp",
    recordType: record?.recordType || "research",
    chitosanConcentration: form.chitosanConcentration.trim() || null,
    chitosanConcentrationUnit: form.chitosanConcentration.trim()
      ? form.chitosanConcentrationUnit.trim() || "mg/mL"
      : record?.chitosanConcentrationUnit || "mg/mL",
    chitosanMolecularWeight: record?.chitosanMolecularWeight ?? null,
    chitosanMwUnit: record?.chitosanMwUnit || "kDa",
    chitosanDeacetylationDegree: record?.chitosanDeacetylationDegree ?? null,
    chitosanSolvent: form.solventName.trim() || record?.chitosanSolvent || null,
    chitosanPh: record?.chitosanPh ?? null,
    tppConcentration: form.tppConcentration.trim() || null,
    tppConcentrationUnit: form.tppConcentration.trim()
      ? form.tppConcentrationUnit.trim() || "mg/mL"
      : record?.tppConcentrationUnit || "mg/mL",
    tppPh: record?.tppPh ?? null,
    chitosanTppRatio: ratio.value || null,
    mixingMethod: record?.mixingMethod ?? null,
    additionMethod: record?.additionMethod ?? null,
    stirringRate: record?.stirringRate ?? null,
    stirringDuration: record?.stirringDuration ?? null,
    temperature: record?.temperature ?? null,
    preparationNotes: record?.preparationNotes ?? null,
    preparationProtocol: protocol as unknown as Record<string, unknown>,
    particleSizeNm: record?.particleSizeNm ?? null,
    pdi: record?.pdi ?? null,
    zetaPotentialMv: record?.zetaPotentialMv ?? null,
    encapsulationEfficiencyPercent: record?.encapsulationEfficiencyPercent ?? null,
    loadingCapacityPercent: record?.loadingCapacityPercent ?? null,
    instrument: record?.instrument ?? null,
    measurementMethod: record?.measurementMethod ?? null,
    experimentDate: record?.experimentDate ?? null,
    researcher: record?.researcher ?? null,
    sampleBatchId: record?.sampleBatchId ?? null,
    characterizationNotes: record?.characterizationNotes ?? null,
    computationalStatus: record?.computationalStatus || "not_configured",
    computationalNotes: record?.computationalNotes ?? null,
    provenance: {
      evidenceClass: record?.recordType === "test_synthetic" ? "SYNTHETIC" : "REFERENCE",
      source: "Study-specific Chitosan–TPP formulation edit",
      recordedAt: new Date().toISOString(),
    },
  }
}

export function previewCalculatedRatio(form: FormulationEditForm): string | null {
  if (form.ratioManual.trim()) return null
  return calculateChitosanTppRatio(
    form.chitosanAmount,
    form.chitosanUnit,
    form.tppAmount,
    form.tppUnit,
  )
}

export { MASS_UNITS, VOLUME_UNITS }
