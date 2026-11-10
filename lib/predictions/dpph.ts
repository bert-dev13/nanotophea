import type { EndpointSpec } from "@/lib/predictions/types"

/**
 * Describes current exploratory-simulation outputs when no validated model is registered.
 * These labels are not assay measurements.
 */
export const dpphSpec: EndpointSpec = {
  endpoint: "dpph",
  label: "DPPH (exploratory)",
  outputLabels: [
    "Scavenging response (% at 100 µM, exploratory)",
    "Exploratory Hill midpoint (µM, not fitted IC50)",
    "Maximum scavenging (%)",
    "Exploratory maximum response ratio (not TEAC)",
    "Relative potency index (demonstration)",
  ],
  context:
    "Compound-level exploratory SIMULATION of radical-scavenging potential from identity/physchem cues. Study-design grid: 0 µM blank and 3.13–100 µM. Docking excluded. Not Trolox TEAC. Not experimental DPPH (µg/mL). No validated QSAR is registered.",
}

/** No validated DPPH model is registered. */
export const dpphModel = null
