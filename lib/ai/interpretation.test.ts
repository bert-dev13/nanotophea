import assert from "node:assert/strict"
import test from "node:test"
import { evidenceVersion } from "./evidence-version"
import { INTERPRETATION_SYSTEM_PROMPT } from "./interpretation-prompt"
import { parseStructuredInterpretation } from "./interpretation-schema"

test("interpretation prompt keeps simulation distinct from experiment", () => {
  assert.match(INTERPRETATION_SYSTEM_PROMPT, /Interpret ONLY the evidence supplied in STUDY_CONTEXT/)
  assert.match(INTERPRETATION_SYSTEM_PROMPT, /SIMULATION is NOT experimental evidence/)
  assert.match(INTERPRETATION_SYSTEM_PROMPT, /experimental evidence is currently unavailable/)
  assert.match(INTERPRETATION_SYSTEM_PROMPT, /do not invent citations/)
  assert.doesNotMatch(INTERPRETATION_SYSTEM_PROMPT, /researcher has final responsibility/)
})

test("structured interpretation keeps only supplied text", () => {
  const draft = parseStructuredInterpretation(`{
    "overallInterpretation": "The available computational results suggest a direction for review.",
    "computationalVsExperimental": "DPPH has both layers. MTT has no laboratory result.",
    "endpointFindings": { "dpph": "Experimental DPPH is recorded.", "mtt": "", "hippo_yap": "Experimental evidence is currently unavailable for this endpoint." },
    "limitations": "MTT has no laboratory result.",
    "conclusion": "Further experimental evidence is required."
  }`)
  assert.equal(draft?.endpointFindings.mtt, null)
  assert.equal(draft?.endpointFindings.hippoYap, "Experimental evidence is currently unavailable for this endpoint.")
})

test("a clinical efficacy claim is rejected and nothing is treated as saved", () => {
  const draft = parseStructuredInterpretation('{"overallInterpretation":"Quercetin is clinically effective.","computationalVsExperimental":"Comparison.","endpointFindings":{},"limitations":"Limited coverage.","conclusion":"Further work."}')
  assert.equal(draft, null)
  const cautious = parseStructuredInterpretation('{"overallInterpretation":"The recorded results do not show that Quercetin is clinically effective.","computationalVsExperimental":"No compatible comparison is recorded.","endpointFindings":{},"limitations":"Experimental coverage is limited.","conclusion":"Additional experimental evidence is required."}')
  assert.match(cautious?.overallInterpretation ?? "", /not show/)
})

test("evidence version changes only when the supplied context changes", () => {
  const first = evidenceVersion("DPPH experimental")
  assert.equal(evidenceVersion("DPPH experimental"), first)
  assert.notEqual(evidenceVersion("DPPH experimental\nMTT experimental"), first)
})
