"use client"

import { Shield } from "lucide-react"
import { PlaceholderModule } from "@/components/panels/PlaceholderModule"

export default function Page() {
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
