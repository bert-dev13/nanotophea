import type { TabId } from "@/types"

export type { TabId }

export interface NavItem {
  id: TabId
  label: string
  href: string
  color: string
  iconName:
    | "BarChart3" | "Microscope" | "Atom" | "FlaskConical" | "Cpu" | "Zap"
    | "Beaker" | "Activity" | "Dna" | "Database" | "BookOpen" | "Calendar"
}

export const NAV_ITEMS: NavItem[] = [
  { id: "overview",       label: "Overview",         href: "/",              color: "#00d4aa", iconName: "BarChart3" },
  { id: "celllines",      label: "Cell Lines",        href: "/cell-lines",    color: "#00d4aa", iconName: "Microscope" },
  { id: "proteins",       label: "Proteins",          href: "/proteins",      color: "#a78bfa", iconName: "Atom" },
  { id: "phytochemicals", label: "Phytochemicals",    href: "/phytochemicals",color: "#34d399", iconName: "FlaskConical" },
  { id: "dockinglab",     label: "Docking Lab",       href: "/docking-lab",   color: "#4fc3f7", iconName: "Cpu" },
  { id: "dpph",           label: "DPPH Assay",        href: "/dpph",          color: "#34d399", iconName: "Zap" },
  { id: "mtt",            label: "MTT Assay",          href: "/mtt",           color: "#4fc3f7", iconName: "FlaskConical" },
  { id: "ldh",            label: "LDH Assay",          href: "/ldh",           color: "#f472b6", iconName: "Beaker" },
  { id: "ros",            label: "ROS Assay",         href: "/ros",           color: "#a78bfa", iconName: "Zap" },
  { id: "bax",            label: "BAX Pathway",       href: "/bax",           color: "#fb923c", iconName: "Activity" },
  { id: "yap",            label: "Hippo–YAP",         href: "/yap",           color: "#4fc3f7", iconName: "Dna" },
  { id: "docking",        label: "AutoDock Vina",     href: "/docking",       color: "#34d399", iconName: "Cpu" },
  { id: "results",        label: "Results Record",    href: "/results",       color: "#fbbf24", iconName: "Database" },
  { id: "interpreter",    label: "Interpreter",       href: "/interpreter",   color: "#fbbf24", iconName: "BookOpen" },
  { id: "dosage",         label: "Dosage Planner",    href: "/dosage",        color: "#4ade80", iconName: "Calendar" },
]
