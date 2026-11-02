"use client"

import { ComparisonWorkspace } from "@/components/analysis/ComparisonWorkspace"
import { InterpretationWorkspace } from "@/components/analysis/InterpretationWorkspace"
import { StatisticsWorkspace } from "@/components/analysis/StatisticsWorkspace"
import { PredictionWorkspace } from "@/components/insilico/prediction/PredictionWorkspace"
import { AssayWorkspace } from "@/components/lab/AssayWorkspace"
import { CharacterizationWorkspace } from "@/components/lab/CharacterizationWorkspace"
import { useStudy } from "@/components/providers/StudyProvider"
import CellLinesCatalog from "@/components/panels/research/CellLinesCatalog"
import FormulationPanel from "@/components/panels/research/FormulationPanel"
import PhytochemicalsCatalog from "@/components/panels/research/PhytochemicalsCatalog"
import ProteinsCatalog from "@/components/panels/research/ProteinsCatalog"
import ReferencesCatalog from "@/components/panels/research/ReferencesCatalog"
import { NanoparticleFormulationWorkspace } from "@/components/study/setup/NanoparticleFormulationWorkspace"
import type { PredictionEndpoint } from "@/lib/domain/models"
import type { StepId, StudyReadiness } from "@/lib/workflow/studyFlow"

const PREDICTION_ENDPOINTS: Record<string, PredictionEndpoint> = {
  dpph: "dpph",
  mtt: "mtt",
  ldh: "ldh",
  ros: "ros",
  bax: "bax",
  "hippo-yap": "hippo_yap",
}

interface WorkspaceModulesProps {
  step: StepId
  tab: string
  readiness: StudyReadiness | null
  onOpenTab: (tab: string) => void
  onOpenSetup?: (tab: string) => void
}

export function WorkspaceModules({ step, tab, readiness, onOpenTab, onOpenSetup }: WorkspaceModulesProps) {
  const { activeStudy } = useStudy()
  if (step === "setup" && (tab === "nanoparticle" || tab === "formulation")) {
    return <NanoparticleFormulationWorkspace studyId={activeStudy?.id || ""} />
  }
  if (step === "setup" && tab === "phytochemicals") return <PhytochemicalsCatalog />
  if (step === "setup" && tab === "proteins") return <ProteinsCatalog />
  if (step === "setup" && tab === "cell-line") return <CellLinesCatalog />
  if (step === "setup" && tab === "references") return <ReferencesCatalog />

  if (step === "predictions") {
    const endpoint = PREDICTION_ENDPOINTS[tab]
    if (endpoint) return <PredictionWorkspace endpoint={endpoint} />
  }

  if (step === "laboratory" && tab === "dpph") return <AssayWorkspace assay="dpph" />
  if (step === "laboratory" && tab === "ldh") return <AssayWorkspace assay="ldh" />
  if (step === "laboratory" && tab === "characterization") return <CharacterizationWorkspace />

  if (step === "analysis" && tab === "overview") return null
  if (step === "analysis" && tab === "statistics") return <StatisticsWorkspace />
  if (step === "analysis" && tab === "comparison") return <ComparisonWorkspace />
  if (step === "analysis" && tab === "interpretation") return <InterpretationWorkspace />

  return null
}
