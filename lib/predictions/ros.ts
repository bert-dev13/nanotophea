import type { EndpointSpec } from "@/lib/predictions/types"

export const rosSpec: EndpointSpec = {
  endpoint: "ros",
  label: "ROS",
  outputLabels: ["Intracellular ROS", "Oxidative stress score", "Mitochondrial permeability score"],
  context: "Oxidative-stress prediction for a selected phytochemical and cell line.",
}

export const rosModel = null
