"use client"

import { Shield } from "lucide-react"
import { ComparisonWorkspace } from "@/components/analysis/ComparisonWorkspace"
import { InterpretationWorkspace } from "@/components/analysis/InterpretationWorkspace"
import { StatisticsWorkspace } from "@/components/analysis/StatisticsWorkspace"
import { PredictionWorkspace } from "@/components/insilico/prediction/PredictionWorkspace"
import { AssayWorkspace } from "@/components/lab/AssayWorkspace"
import { CharacterizationWorkspace } from "@/components/lab/CharacterizationWorkspace"
import DockingWorkspace from "@/components/panels/insilico/DockingWorkspace"
import { PlaceholderModule } from "@/components/panels/PlaceholderModule"
import CellLinesCatalog from "@/components/panels/research/CellLinesCatalog"
import FormulationPanel from "@/components/panels/research/FormulationPanel"
import PhytochemicalsCatalog from "@/components/panels/research/PhytochemicalsCatalog"
import ProteinsCatalog from "@/components/panels/research/ProteinsCatalog"
import ReferencesCatalog from "@/components/panels/research/ReferencesCatalog"
import { InSilicoOverview } from "@/components/study/InSilicoOverview"
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

function AdmetModule() {
  return (
    <PlaceholderModule
      icon={Shield}
      title="ADMET / Drug-Likeness"
      subtitle="Physicochemical and ADME screening for selected phytochemicals."
      evidence={["PREDICTED", "LITERATURE", "REFERENCE"]}
      phase="insilico"
      contractNote="Evidence follows origin, not module placement: SwissADME/RDKit → PREDICTED; cited papers → LITERATURE; database identity metadata → REFERENCE. Never relabel values as PREDICTED only because they appear here."
      upcoming={[
        "Import SwissADME / RDKit / literature / database values with per-value provenance preserved",
        "Display MW, LogP, HBD/HBA, TPSA, Lipinski, drug-likeness with the correct EvidenceBadge for each origin",
        "No ADMET numbers are computed or invented on this page yet",
      ]}
    />
  )
}

interface WorkspaceModulesProps {
  step: StepId
  tab: string
  readiness: StudyReadiness | null
  onOpenTab: (tab: string) => void
}

export function WorkspaceModules({ step, tab, readiness, onOpenTab }: WorkspaceModulesProps) {
  if (step === "setup" && tab === "formulation") return <FormulationPanel />
  if (step === "setup" && tab === "phytochemicals") return <PhytochemicalsCatalog />
  if (step === "setup" && tab === "proteins") return <ProteinsCatalog />
  if (step === "setup" && tab === "cell-line") return <CellLinesCatalog />
  if (step === "setup" && tab === "references") return <ReferencesCatalog />

  if (step === "insilico" && tab === "overview") {
    return (
      <InSilicoOverview
        compounds={readiness ? readiness.compounds : null}
        admetRuns={readiness ? readiness.admetRuns : null}
        onOpenAdmet={() => onOpenTab("admet")}
      />
    )
  }
  if (step === "insilico" && tab === "admet") return <AdmetModule />

  if (step === "docking") return <DockingWorkspace />

  if (step === "predictions") {
    const endpoint = PREDICTION_ENDPOINTS[tab]
    if (endpoint) return <PredictionWorkspace endpoint={endpoint} />
  }

  if (step === "laboratory" && tab === "dpph") return <AssayWorkspace assay="dpph" />
  if (step === "laboratory" && tab === "ldh") return <AssayWorkspace assay="ldh" />
  if (step === "laboratory" && tab === "characterization") return <CharacterizationWorkspace />

  if (step === "analysis" && tab === "statistics") return <StatisticsWorkspace />
  if (step === "analysis" && tab === "comparison") return <ComparisonWorkspace />
  if (step === "analysis" && tab === "interpretation") return <InterpretationWorkspace />

  return null
}
