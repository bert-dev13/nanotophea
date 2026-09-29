import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard, Leaf, FlaskConical, Atom, Microscope, Library,
  Shield, Cpu, Beaker, Activity, Dna, Droplets, Database,
  BarChart3, GitCompare, BookOpen, Zap,
} from "lucide-react"

export interface NavLink {
  label: string
  href: string
  icon: LucideIcon
}

export interface NavGroup {
  id: string
  label: string
  links: NavLink[]
  children?: { label: string; links: NavLink[] }[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    links: [
      { label: "Study Home", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    id: "research",
    label: "Research Data",
    links: [
      { label: "Formulation", href: "/research/formulation", icon: Leaf },
      { label: "Phytochemicals", href: "/research/phytochemicals", icon: FlaskConical },
      { label: "Target Proteins", href: "/research/proteins", icon: Atom },
      { label: "Cell Lines", href: "/research/cell-lines", icon: Microscope },
      { label: "References", href: "/research/references", icon: Library },
    ],
  },
  {
    id: "insilico",
    label: "In-Silico Analysis",
    links: [
      { label: "ADMET", href: "/insilico/admet", icon: Shield },
      { label: "Molecular Docking", href: "/insilico/docking", icon: Cpu },
    ],
    children: [
      {
        label: "Predictions",
        links: [
          { label: "DPPH", href: "/insilico/predictions/dpph", icon: Zap },
          { label: "MTT", href: "/insilico/predictions/mtt", icon: Beaker },
          { label: "LDH", href: "/insilico/predictions/ldh", icon: Droplets },
          { label: "ROS", href: "/insilico/predictions/ros", icon: Activity },
          { label: "BAX", href: "/insilico/predictions/bax", icon: Activity },
          { label: "Hippo–YAP", href: "/insilico/predictions/yap", icon: Dna },
        ],
      },
    ],
  },
  {
    id: "lab",
    label: "Laboratory Results",
    links: [
      { label: "Experimental DPPH", href: "/lab/dpph", icon: Zap },
      { label: "Experimental LDH", href: "/lab/ldh", icon: Droplets },
      { label: "Characterization", href: "/lab/characterization", icon: Database },
    ],
  },
  {
    id: "analysis",
    label: "Analysis",
    links: [
      { label: "Statistics", href: "/analysis/statistics", icon: BarChart3 },
      { label: "Prediction vs Experimental", href: "/analysis/compare", icon: GitCompare },
      { label: "Interpretation", href: "/analysis/interpretation", icon: BookOpen },
    ],
  },
]

/** Old → new redirects for bookmarks during transition */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/cell-lines": "/research/cell-lines",
  "/proteins": "/research/proteins",
  "/phytochemicals": "/research/phytochemicals",
  "/docking": "/insilico/docking",
  "/docking-lab": "/insilico/docking",
  "/dpph": "/insilico/predictions/dpph",
  "/mtt": "/insilico/predictions/mtt",
  "/ldh": "/insilico/predictions/ldh",
  "/ros": "/insilico/predictions/ros",
  "/bax": "/insilico/predictions/bax",
  "/yap": "/insilico/predictions/yap",
  "/results": "/analysis/compare",
  "/interpreter": "/analysis/interpretation",
  "/dosage": "/",
}
