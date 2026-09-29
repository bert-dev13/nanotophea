/**
 * Endpoint configurations for Phase 6 in-silico prediction workspaces.
 * Units and subject types follow STUDY_DESIGN_CONTRACT.md — no scientific defaults invented.
 */
import type { LucideIcon } from "lucide-react"
import { Activity, Beaker, Dna, Droplets, Zap } from "lucide-react"
import type {
  PredictionConcentrationUnit,
  PredictionEndpoint,
} from "@/lib/domain/models"

export type PredictionSubjectType = "compound" | "formulation"

export interface PredictionEndpointConfig {
  endpoint: PredictionEndpoint
  /** App route path */
  href: string
  title: string
  shortLabel: string
  subtitle: string
  banner: string
  icon: LucideIcon
  subjectType: PredictionSubjectType
  requiresCellLine: boolean
  primaryCellLineHint: string | null
  concentrationUnit: PredictionConcentrationUnit
  concentrationUnitLabel: string
  /** Suggested grid for data entry UI only — never auto-filled as results */
  suggestedConcentrations: number[]
  defaultMetric: string
  defaultValueUnit: string
  /** Has a Laboratory Results counterpart in this study */
  hasExperimentalCounterpart: boolean
  experimentalNote: string
  forbiddenClaims: string
  contractNote: string
}

export const PREDICTION_ENDPOINTS: Record<PredictionEndpoint, PredictionEndpointConfig> = {
  dpph: {
    endpoint: "dpph",
    href: "/insilico/predictions/dpph",
    title: "In-Silico DPPH — Computational",
    shortLabel: "DPPH",
    subtitle: "Compound-level radical-scavenging prediction (µM).",
    banner: "In-Silico DPPH — Computational. Not Experimental DPPH (µg/mL T1–T6).",
    icon: Zap,
    subjectType: "compound",
    requiresCellLine: false,
    primaryCellLineHint: null,
    concentrationUnit: "uM",
    concentrationUnitLabel: "µM",
    suggestedConcentrations: [0, 3.13, 6.25, 12.5, 25, 50, 100],
    defaultMetric: "predicted_scavenging",
    defaultValueUnit: "%",
    hasExperimentalCounterpart: true,
    experimentalNote:
      "Experimental DPPH later uses 50–500 µg/mL (T1–T6, n=3) under Laboratory Results — do not mix units here without documented conversion.",
    forbiddenClaims: "Do not present this as a wet-lab DPPH assay.",
    contractNote:
      "PREDICTED only with a documented method. SIMULATION only for exploratory math, clearly labeled. No Hill/random generators.",
  },
  ldh: {
    endpoint: "ldh",
    href: "/insilico/predictions/ldh",
    title: "In-Silico LDH — Computational",
    shortLabel: "LDH",
    subtitle: "Formulation-level membrane-damage prediction (HepG2, µg/mL).",
    banner: "In-Silico LDH — Computational. Separate from Experimental LDH.",
    icon: Droplets,
    subjectType: "formulation",
    requiresCellLine: true,
    primaryCellLineHint: "HepG2",
    concentrationUnit: "ug_per_mL",
    concentrationUnitLabel: "µg/mL",
    suggestedConcentrations: [50, 100, 250, 500],
    defaultMetric: "predicted_cytotoxicity",
    defaultValueUnit: "%",
    hasExperimentalCounterpart: true,
    experimentalNote:
      "Experimental LDH uses HepG2 T1–T6 replicates under Laboratory Results. Do not import experimental controls here.",
    forbiddenClaims: "Do not equate Prediction LDH with Experimental LDH.",
    contractNote:
      "Formulation-level, HepG2, 50–500 µg/mL. Documented PREDICTED or labeled SIMULATION only.",
  },
  mtt: {
    endpoint: "mtt",
    href: "/insilico/predictions/mtt",
    title: "In-Silico MTT — Computational",
    shortLabel: "MTT",
    subtitle: "Formulation-level cytotoxicity / viability prediction (HepG2, µg/mL).",
    banner: "In-silico only — no experimental MTT counterpart in this study.",
    icon: Beaker,
    subjectType: "formulation",
    requiresCellLine: true,
    primaryCellLineHint: "HepG2",
    concentrationUnit: "ug_per_mL",
    concentrationUnitLabel: "µg/mL",
    suggestedConcentrations: [50, 100, 250, 500],
    defaultMetric: "predicted_viability",
    defaultValueUnit: "%",
    hasExperimentalCounterpart: false,
    experimentalNote: "No Laboratory MTT module under the current Study Design Contract.",
    forbiddenClaims: "Never label as wet-lab MTT, flow cytometry, or measured IC₅₀.",
    contractNote: "Computational-only endpoint. PREDICTED or SIMULATION — never EXPERIMENTAL.",
  },
  ros: {
    endpoint: "ros",
    href: "/insilico/predictions/ros",
    title: "In-Silico ROS — Computational",
    shortLabel: "ROS",
    subtitle: "Formulation-level oxidative-stress pathway prediction (HepG2, µg/mL).",
    banner: "In-silico only — no experimental ROS counterpart in this study.",
    icon: Activity,
    subjectType: "formulation",
    requiresCellLine: true,
    primaryCellLineHint: "HepG2",
    concentrationUnit: "ug_per_mL",
    concentrationUnitLabel: "µg/mL",
    suggestedConcentrations: [50, 100, 250, 500],
    defaultMetric: "predicted_ros_index",
    defaultValueUnit: "fold",
    hasExperimentalCounterpart: false,
    experimentalNote: "No Laboratory ROS module under the current Study Design Contract.",
    forbiddenClaims: "Never claim experimental DCFH / ROS assay results.",
    contractNote: "Computational-only endpoint. PREDICTED or SIMULATION — never EXPERIMENTAL.",
  },
  bax: {
    endpoint: "bax",
    href: "/insilico/predictions/bax",
    title: "In-Silico BAX — Computational",
    shortLabel: "BAX",
    subtitle: "Formulation-level apoptosis pathway prediction (HepG2, µg/mL).",
    banner: "In-silico only — no experimental BAX counterpart in this study.",
    icon: Activity,
    subjectType: "formulation",
    requiresCellLine: true,
    primaryCellLineHint: "HepG2",
    concentrationUnit: "ug_per_mL",
    concentrationUnitLabel: "µg/mL",
    suggestedConcentrations: [50, 100, 250, 500],
    defaultMetric: "predicted_bax_response",
    defaultValueUnit: "fold",
    hasExperimentalCounterpart: false,
    experimentalNote: "No Laboratory BAX / Annexin module under the current Study Design Contract.",
    forbiddenClaims: "Never claim Western blot / Annexin V experimental measurement.",
    contractNote: "Computational-only endpoint. PREDICTED or SIMULATION — never EXPERIMENTAL.",
  },
  hippo_yap: {
    endpoint: "hippo_yap",
    href: "/insilico/predictions/yap",
    title: "In-Silico Hippo–YAP — Computational",
    shortLabel: "Hippo–YAP",
    subtitle: "Formulation-level Hippo–YAP signaling prediction (HepG2, µg/mL).",
    banner: "In-silico only — no experimental Hippo–YAP counterpart in this study.",
    icon: Dna,
    subjectType: "formulation",
    requiresCellLine: true,
    primaryCellLineHint: "HepG2",
    concentrationUnit: "ug_per_mL",
    concentrationUnitLabel: "µg/mL",
    suggestedConcentrations: [50, 100, 250, 500],
    defaultMetric: "predicted_yap_suppression",
    defaultValueUnit: "%",
    hasExperimentalCounterpart: false,
    experimentalNote: "No Laboratory Hippo–YAP module under the current Study Design Contract.",
    forbiddenClaims: "Never claim experimental WB / qPCR measurement.",
    contractNote: "Computational-only endpoint. PREDICTED or SIMULATION — never EXPERIMENTAL.",
  },
}

export function getPredictionEndpoint(id: PredictionEndpoint): PredictionEndpointConfig {
  return PREDICTION_ENDPOINTS[id]
}
