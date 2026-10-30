export const ENTER_HREF = "/?signin=1"

export const NAV_LINKS = [
  { href: "#platform", label: "Platform" },
  { href: "#workflow", label: "Workflow" },
] as const

export const WORKFLOW = [
  {
    n: "01",
    title: "Research Setup",
    text: "Select phytochemicals, target proteins and cell lines.",
  },
  {
    n: "02",
    title: "In-Silico Screening",
    text: "Review molecular properties and available screening information.",
  },
  {
    n: "03",
    title: "Molecular Docking",
    text: "Evaluate protein–ligand interactions using AutoDock Vina.",
  },
  {
    n: "04",
    title: "Biological Predictions",
    text: "Organize computational DPPH, MTT, LDH, ROS, BAX and Hippo–YAP assessments.",
  },
  {
    n: "05",
    title: "Laboratory Validation",
    text: "Record available experimental measurements and characterization.",
  },
  {
    n: "06",
    title: "Analysis & Interpretation",
    text: "Analyze available evidence and support researcher-authored interpretation.",
  },
] as const
