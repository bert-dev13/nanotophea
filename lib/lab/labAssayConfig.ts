import type { LucideIcon } from "lucide-react"
import { Droplets, Zap } from "lucide-react"
import type { LabAssay, LabTreatmentCode } from "@/lib/domain/models"

export interface LabTreatmentDefinition {
  code: LabTreatmentCode
  label: string
  /** Locked µg/mL for T3–T6; undefined for controls */
  concentrationUgPerMl?: number
  role: "negative_control" | "positive_control" | "treatment"
}

export interface LabAssayConfig {
  assay: "dpph" | "ldh"
  title: string
  subtitle: string
  banner: string
  contractNote: string
  icon: LucideIcon
  concentrationUnit: "ug_per_mL"
  concentrationUnitLabel: "µg/mL"
  requiresHepG2: boolean
  defaultWavelengthNm?: number
  primaryMetricKey: string
  primaryMetricLabel: string
  measurementKeys: { key: string; label: string; unit?: string }[]
  treatments: LabTreatmentDefinition[]
}

const SHARED_TREATMENTS: LabTreatmentDefinition[] = [
  { code: "T1", label: "Negative / solvent control", role: "negative_control" },
  { code: "T2", label: "Positive control", role: "positive_control" },
  { code: "T3", label: "NanoHepatoTea", concentrationUgPerMl: 50, role: "treatment" },
  { code: "T4", label: "NanoHepatoTea", concentrationUgPerMl: 100, role: "treatment" },
  { code: "T5", label: "NanoHepatoTea", concentrationUgPerMl: 250, role: "treatment" },
  { code: "T6", label: "NanoHepatoTea", concentrationUgPerMl: 500, role: "treatment" },
]

export const DPPH_ASSAY_CONFIG: LabAssayConfig = {
  assay: "dpph",
  title: "Experimental DPPH",
  subtitle: "Wet-lab DPPH radical-scavenging results for NanoHepatoTea.",
  banner: "EXPERIMENTAL DPPH — Laboratory",
  contractNote:
    "T1 solvent control; T2 ascorbic acid (record actual concentration used); T3–T6 at 50/100/250/500 µg/mL; R1–R3. Wavelength 517 nm. Never invent missing measurements.",
  icon: Zap,
  concentrationUnit: "ug_per_mL",
  concentrationUnitLabel: "µg/mL",
  requiresHepG2: false,
  defaultWavelengthNm: 517,
  primaryMetricKey: "radicalScavengingPercent",
  primaryMetricLabel: "% radical scavenging",
  measurementKeys: [
    { key: "absorbance", label: "Absorbance (A517)", unit: "AU" },
    { key: "radicalScavengingPercent", label: "% radical scavenging", unit: "%" },
  ],
  treatments: SHARED_TREATMENTS.map((t) =>
    t.code === "T1"
      ? { ...t, label: "Negative / solvent control" }
      : t.code === "T2"
        ? { ...t, label: "Positive control (ascorbic acid)" }
        : t
  ),
}

export const LDH_ASSAY_CONFIG: LabAssayConfig = {
  assay: "ldh",
  title: "Experimental LDH",
  subtitle: "Wet-lab LDH cytotoxicity on HepG2.",
  banner: "EXPERIMENTAL LDH — Laboratory",
  contractNote:
    "HepG2 only. T1 spontaneous/vehicle; T2 maximum LDH release / lysis control (record actual reagent); T3–T6 at 50/100/250/500 µg/mL; R1–R3. Do not invent protocol reagents.",
  icon: Droplets,
  concentrationUnit: "ug_per_mL",
  concentrationUnitLabel: "µg/mL",
  requiresHepG2: true,
  primaryMetricKey: "percentCytotoxicity",
  primaryMetricLabel: "% cytotoxicity",
  measurementKeys: [
    { key: "absorbanceA490", label: "Absorbance A490", unit: "AU" },
    { key: "ldhRelease", label: "LDH release", unit: "as reported" },
    { key: "percentCytotoxicity", label: "% cytotoxicity", unit: "%" },
  ],
  treatments: SHARED_TREATMENTS.map((t) =>
    t.code === "T1"
      ? { ...t, label: "Spontaneous / vehicle control" }
      : t.code === "T2"
        ? { ...t, label: "Maximum LDH release / lysis control" }
        : t
  ),
}

export function getLabAssayConfig(assay: "dpph" | "ldh"): LabAssayConfig {
  return assay === "dpph" ? DPPH_ASSAY_CONFIG : LDH_ASSAY_CONFIG
}

export const CHARACTERIZATION_ASSAYS = [
  "hplc",
  "proximate",
  "nutritive",
  "pb",
  "sensory",
  "microbial",
  "stability",
] as const satisfies readonly LabAssay[]

export type CharacterizationAssay = (typeof CHARACTERIZATION_ASSAYS)[number]

export const CHARACTERIZATION_LABELS: Record<CharacterizationAssay, string> = {
  hplc: "HPLC",
  proximate: "Proximate Analysis",
  nutritive: "Nutritive Analysis",
  pb: "Heavy Metal — Pb",
  sensory: "Sensory / Organoleptic",
  microbial: "Microbial",
  stability: "Stability",
}

export const LOCKED_TREATMENT_CONCENTRATIONS: Record<"T3" | "T4" | "T5" | "T6", number> = {
  T3: 50,
  T4: 100,
  T5: 250,
  T6: 500,
}
