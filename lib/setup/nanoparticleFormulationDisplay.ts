import type { NanoparticleFormulation } from "@/lib/domain/models"
import {
  defaultNanoparticleIngredients,
  parseNanoparticlePreparationProtocol,
  type NanoparticleIngredient,
} from "@/lib/setup/nanoparticlePreparationProtocol"

export type FormulationValueSource = "study" | "default" | "not_recorded"

export interface FormulationDisplayRow {
  id: string
  name: string
  value: string
  detail?: string
  source: FormulationValueSource
  functionInFormulation?: string
}

const NOT_RECORDED = "Not recorded"

function fmtAmount(amount?: string | null, unit?: string | null): string | null {
  const a = (amount ?? "").trim()
  if (!a) return null
  const u = (unit ?? "").trim()
  return u ? `${a} ${u}` : a
}

function studyHasFormulationFields(record: NanoparticleFormulation | null | undefined): boolean {
  if (!record) return false
  const protocol = parseNanoparticlePreparationProtocol(record.preparationProtocol)
  const hasIngredientAmounts = protocol.ingredients.some((row) => {
    if (row.id === "maltodextrin" && row.isPreset) {
      const amount = fmtAmount(row.amount, row.unit)
      const prescribed = fmtAmount(row.prescribedAmount, row.prescribedUnit) || "7.00 g"
      return Boolean(amount && amount !== prescribed)
    }
    return Boolean(
      (row.amount ?? "").trim() ||
        (row.concentration ?? "").trim() ||
        (row.solventName ?? "").trim(),
    )
  })
  return Boolean(
    hasIngredientAmounts ||
      record.chitosanConcentration ||
      record.tppConcentration ||
      record.chitosanTppRatio ||
      (protocol.formulationRatio?.value ?? "").trim() ||
      record.chitosanSolvent,
  )
}

/** Build read-only overview rows from study record and protocol defaults. Does not invent missing amounts. */
export function buildNanoparticleFormulationOverview(record: NanoparticleFormulation | null | undefined): {
  dataSource: "study" | "default"
  systemName: string
  ratio: FormulationDisplayRow
  ingredients: FormulationDisplayRow[]
} {
  const hasStudy = studyHasFormulationFields(record)
  const protocol = parseNanoparticlePreparationProtocol(record?.preparationProtocol)
  const ingredientsFromProtocol =
    protocol.ingredients.length > 0 ? protocol.ingredients : defaultNanoparticleIngredients()
  const byId = new Map(ingredientsFromProtocol.map((row) => [row.id, row]))

  const chitosanIng = byId.get("chitosan")
  const tppIng = byId.get("tpp")
  const maltodextrinIng = byId.get("maltodextrin")
  const solventIng = byId.get("solvent")

  const chitosanMass = fmtAmount(chitosanIng?.amount, chitosanIng?.unit)
  const chitosanConc =
    fmtAmount(chitosanIng?.concentration, chitosanIng?.concentrationUnit) ||
    fmtAmount(record?.chitosanConcentration, record?.chitosanConcentrationUnit)
  const chitosanValue = chitosanMass || chitosanConc

  const tppMass = fmtAmount(tppIng?.amount, tppIng?.unit)
  const tppConc =
    fmtAmount(tppIng?.concentration, tppIng?.concentrationUnit) ||
    fmtAmount(record?.tppConcentration, record?.tppConcentrationUnit)
  const tppValue = tppMass || tppConc

  const chitosanRow: FormulationDisplayRow = chitosanValue
    ? {
        id: "chitosan",
        name: "Chitosan",
        value: chitosanValue,
        source: "study",
        functionInFormulation: "Polycationic polymer / nanoparticle matrix",
        detail: [chitosanMass && chitosanConc && chitosanMass !== chitosanConc ? `Conc. ${chitosanConc}` : null]
          .filter(Boolean)
          .join(" · ") || undefined,
      }
    : {
        id: "chitosan",
        name: "Chitosan",
        value: NOT_RECORDED,
        source: "not_recorded",
        functionInFormulation: "Polycationic polymer / nanoparticle matrix",
      }

  const tppRow: FormulationDisplayRow = tppValue
    ? {
        id: "tpp",
        name: "Tripolyphosphate (TPP)",
        value: tppValue,
        source: "study",
        functionInFormulation: "Polyanionic crosslinker",
        detail: [tppMass && tppConc && tppMass !== tppConc ? `Conc. ${tppConc}` : null]
          .filter(Boolean)
          .join(" · ") || undefined,
      }
    : {
        id: "tpp",
        name: "Tripolyphosphate (TPP)",
        value: NOT_RECORDED,
        source: "not_recorded",
        functionInFormulation: "Polyanionic crosslinker",
      }

  const maltodextrinRow = displayMaltodextrin(maltodextrinIng)

  const solventName = (solventIng?.solventName ?? "").trim() || (record?.chitosanSolvent ?? "").trim()
  const solventAmount = fmtAmount(solventIng?.amount, solventIng?.unit)
  const solventValue = [solventName || null, solventAmount].filter(Boolean).join(" · ")
  const solventRow: FormulationDisplayRow = solventValue
    ? {
        id: "solvent",
        name: "Solvent / Vehicle",
        value: solventValue,
        source: "study",
        functionInFormulation: "Dissolution / suspension medium",
      }
    : {
        id: "solvent",
        name: "Solvent / Vehicle",
        value: NOT_RECORDED,
        source: "not_recorded",
        functionInFormulation: "Dissolution / suspension medium",
      }

  const otherRows = ingredientsFromProtocol
    .filter((row) => !["chitosan", "tpp", "maltodextrin", "solvent"].includes(row.id))
    .map((row) => displayOther(row))

  const ratio = displayRatio(record, protocol.formulationRatio?.value, protocol.formulationRatio?.provenance)

  return {
    dataSource: hasStudy ? "study" : "default",
    systemName: record?.systemName || "Chitosan–TPP Nanoparticle System",
    ratio,
    ingredients: [chitosanRow, tppRow, maltodextrinRow, solventRow, ...otherRows],
  }
}

function displayMaltodextrin(row?: NanoparticleIngredient): FormulationDisplayRow {
  const prescribed = fmtAmount(row?.prescribedAmount, row?.prescribedUnit) || "7.00 g"
  const amount = fmtAmount(row?.amount, row?.unit) || prescribed
  const isDefault = !row?.amount?.trim() || amount === prescribed
  return {
    id: "maltodextrin",
    name: "Maltodextrin",
    value: amount,
    source: isDefault ? "default" : "study",
    functionInFormulation: "Drying carrier",
    detail: isDefault ? `Protocol default: ${prescribed}` : `Protocol default: ${prescribed}`,
  }
}

function displayOther(row: NanoparticleIngredient): FormulationDisplayRow {
  const amount = fmtAmount(row.amount, row.unit)
  if (!amount) {
    return {
      id: row.id,
      name: row.name || "Ingredient",
      value: NOT_RECORDED,
      source: "not_recorded",
      functionInFormulation: row.functionInFormulation || undefined,
    }
  }
  return {
    id: row.id,
    name: row.name || "Ingredient",
    value: amount,
    source: row.isPreset ? "default" : "study",
    functionInFormulation: row.functionInFormulation || undefined,
  }
}

function displayRatio(
  record: NanoparticleFormulation | null | undefined,
  protocolValue?: string,
  provenance?: string,
): FormulationDisplayRow {
  const value = (protocolValue ?? "").trim() || (record?.chitosanTppRatio ?? "").trim()
  if (!value) {
    return {
      id: "ratio",
      name: "Formulation Ratio",
      value: NOT_RECORDED,
      source: "not_recorded",
      detail: "Chitosan:TPP · calculated only from compatible mass amounts",
    }
  }
  const detail =
    provenance === "manual"
      ? "Chitosan:TPP · researcher-supplied"
      : provenance === "calculated"
        ? "Chitosan:TPP · calculated from mass amounts"
        : "Chitosan:TPP (study record)"
  return {
    id: "ratio",
    name: "Formulation Ratio",
    value,
    source: "study",
    detail,
  }
}

export function sourceLabel(source: FormulationValueSource): string {
  if (source === "study") return "Study"
  if (source === "default") return "Default"
  return "Not recorded"
}
