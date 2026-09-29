"use client"

import { BrandLogo } from "@/components/brand/BrandLogo"

export function AppFooter() {
  return (
    <footer className="border-t px-4 py-4 mt-auto" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <div
        className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-xs"
        style={{ color: "#546e8a" }}
      >
        <span className="inline-flex items-center gap-2">
          <BrandLogo size="sm" />
          <span>NANOTOPHEA · Research platform · Not a clinical dosing tool</span>
        </span>
        <span className="font-mono">
          Evidence: REFERENCE · LITERATURE · PREDICTED · EXPERIMENTAL · INTERPRETATION · SIMULATION
        </span>
      </div>
    </footer>
  )
}
