import type { EndpointSpec } from "@/lib/predictions/types"

export const hippoYapSpec: EndpointSpec = {
  endpoint: "hippo_yap",
  label: "Hippo–YAP (exploratory)",
  outputLabels: [
    "YAP–TEAD residual activity proxy (% at 250 µg/mL)",
    "Estimated YAP suppression proxy (% at 250 µg/mL)",
    "p-YAP Ser127 proxy (score, not measured phosphorylation)",
    "Nuclear YAP residual proxy (%, not localization microscopy)",
    "TEAD transcriptional proxy (% at 250 µg/mL)",
  ],
  context:
    "Exploratory SIMULATION of Hippo–YAP / YAP–TEAD pathway proxies from compound–target identity and optional docking affinity as a pathway-engagement cue. Proxies are not measured phosphorylation, nuclear localization, or reporter-assay readouts. Not Western blot or qPCR. No validated pathway model is registered.",
}

export const hippoYapModel = null
