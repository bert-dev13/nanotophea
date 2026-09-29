"use client"

export function AppFooter() {
  return (
    <footer
      className="mt-auto border-t px-4 sm:px-6 py-3"
      style={{ background: "#fff", borderColor: "var(--border-subtle)" }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-[var(--muted-foreground)]">
          NANOTOPHEA · Research platform · Not a clinical dosing tool
        </p>
        <p className="font-mono text-[10px] tracking-wide text-[var(--nav-section)]">
          REFERENCE · LITERATURE · PREDICTED · EXPERIMENTAL · INTERPRETATION · SIMULATION
        </p>
      </div>
    </footer>
  )
}
