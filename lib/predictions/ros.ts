import type { EndpointSpec } from "@/lib/predictions/types"

export const rosSpec: EndpointSpec = {
  endpoint: "ros",
  label: "ROS (exploratory)",
  outputLabels: [
    "Exploratory relative ROS index (fold-scale at 250 µg/mL, not fluorescence)",
    "Exploratory Hill midpoint (µg/mL, demonstration only)",
  ],
  context:
    "Exploratory SIMULATION of a relative oxidative-stress index for compound × cell line. Optional oxidative-stress protein targets (e.g. KEAP1, NFE2L2/NRF2, NQO1, HMOX1, SOD1, CAT, GPX1, NOX4) are investigation context and structure/docking inspection only — they do not drive the ROS index and are not experimental biomarkers. Not DCFH-DA fluorescence, not ΔΨm, not experimental ROS. Docking affinities are excluded from ROS math. No validated model is registered.",
}

export const rosModel = null
