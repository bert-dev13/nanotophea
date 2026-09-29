"use client"

/** Compact scientific disclaimer under the content top bar. */
export function ScientificNotice() {
  return (
    <div
      className="nano-notice border-b px-4 sm:px-6 py-1.5"
      style={{ background: "var(--notice-bg)", borderColor: "var(--border-subtle)" }}
      role="note"
    >
      <p className="text-[11px] leading-snug text-[var(--muted-foreground)]">
        Computational outputs do not constitute experimental proof. Evidence classes follow the Study
        Design Contract.
      </p>
    </div>
  )
}
