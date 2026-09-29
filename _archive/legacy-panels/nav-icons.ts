import type { ElementType } from "react"
import {
  BarChart3, Microscope, Atom, FlaskConical, Cpu, Zap,
  Beaker, Activity, Dna, Database, BookOpen, Calendar,
} from "lucide-react"
import type { NavItem } from "@/data/tabs"

export const NAV_ICONS: Record<NavItem["iconName"], ElementType> = {
  BarChart3,
  Microscope,
  Atom,
  FlaskConical,
  Cpu,
  Zap,
  Beaker,
  Activity,
  Dna,
  Database,
  BookOpen,
  Calendar,
}
