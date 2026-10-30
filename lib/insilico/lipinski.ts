/**
 * Lipinski rule-of-five screen from retrieved descriptors.
 * Uses only values passed in. Does not estimate missing numbers.
 */

export interface LipinskiInput {
  molecularWeight?: number | null
  xLogP?: number | null
  hBondDonors?: number | null
  hBondAcceptors?: number | null
}

export interface LipinskiRule {
  label: string
  value: string | null
  /** Null when that descriptor was not retrieved. */
  pass: boolean | null
}

export interface LipinskiScreen {
  rules: LipinskiRule[]
  overall: "pass" | "fail" | "incomplete"
  overallLabel: string
}

export function screenLipinski(input: LipinskiInput): LipinskiScreen {
  const rules: LipinskiRule[] = [
    rule("Molecular Weight", input.molecularWeight, (value) => `${value} g/mol`, (value) => value <= 500),
    rule("XLogP", input.xLogP, (value) => String(value), (value) => value <= 5),
    rule("H-Bond Donors", input.hBondDonors, (value) => String(value), (value) => value <= 5),
    rule("H-Bond Acceptors", input.hBondAcceptors, (value) => String(value), (value) => value <= 10),
  ]
  if (rules.some((item) => item.pass == null)) {
    return { rules, overall: "incomplete", overallLabel: "Lipinski screening incomplete" }
  }
  const pass = rules.every((item) => item.pass === true)
  return {
    rules,
    overall: pass ? "pass" : "fail",
    overallLabel: pass ? "Passes Lipinski screening" : "Does not pass Lipinski screening",
  }
}

function rule(
  label: string,
  raw: number | null | undefined,
  format: (value: number) => string,
  passes: (value: number) => boolean,
): LipinskiRule {
  if (raw == null || Number.isNaN(raw)) return { label, value: null, pass: null }
  return { label, value: format(raw), pass: passes(raw) }
}
