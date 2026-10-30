import { z } from "zod"

const nullableText = z.preprocess((value) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}, z.string().max(8000).nullable())

const requiredText = nullableText.refine((value) => Boolean(value))

const endpointShape = z.object({
  dpph: nullableText.optional(),
  mtt: nullableText.optional(),
  ldh: nullableText.optional(),
  ros: nullableText.optional(),
  bax: nullableText.optional(),
  hippoYap: nullableText.optional(),
})

export const StructuredInterpretationSchema = z.object({
  overallInterpretation: requiredText,
  computationalVsExperimental: requiredText,
  endpointFindings: z.preprocess((value) => (value && typeof value === "object" ? value : {}), endpointShape),
  computationalFindings: nullableText.optional(),
  laboratoryFindings: nullableText.optional(),
  limitations: requiredText,
  conclusion: requiredText,
}).transform((value) => ({
  overallInterpretation: value.overallInterpretation as string,
  computationalVsExperimental: value.computationalVsExperimental as string,
  computationalFindings: value.computationalFindings ?? null,
  laboratoryFindings: value.laboratoryFindings ?? null,
  endpointFindings: {
    dpph: value.endpointFindings.dpph ?? null,
    mtt: value.endpointFindings.mtt ?? null,
    ldh: value.endpointFindings.ldh ?? null,
    ros: value.endpointFindings.ros ?? null,
    bax: value.endpointFindings.bax ?? null,
    hippoYap: value.endpointFindings.hippoYap ?? null,
  },
  limitations: value.limitations as string,
  conclusion: value.conclusion as string,
}))

export type StructuredInterpretation = z.infer<typeof StructuredInterpretationSchema>

const FORBIDDEN_CLAIM = /cures liver cancer|is clinically effective|clinical safety|proven treatment|confirms therapeutic|confirmed therapeutic|proves anticancer|proves efficacy|confirms efficacy|confirms safety|\bproves\b|\bpromising\b|simulation proves/i

function rejectsClaim(piece: string): boolean {
  return piece.split(/(?<=[.!?])\s+/).some((sentence) => {
    if (/\b(not|no|never|without|cannot|does not|do not|unavailable|not yet)\b/i.test(sentence)) return false
    return FORBIDDEN_CLAIM.test(sentence)
  })
}

export function parseStructuredInterpretation(text: string): StructuredInterpretation | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const value = JSON.parse(match[0]) as {
      endpointFindings?: Record<string, unknown>
      endpointInterpretations?: Record<string, unknown>
    }
    const endpoints = value.endpointFindings ?? value.endpointInterpretations
    if (endpoints && endpoints.hippoYap == null && endpoints.hippo_yap != null) {
      endpoints.hippoYap = endpoints.hippo_yap
    }
    if (!value.endpointFindings && value.endpointInterpretations) {
      value.endpointFindings = value.endpointInterpretations
    }
    const parsed = StructuredInterpretationSchema.safeParse(value)
    if (!parsed.success) return null
    const pieces = [
      parsed.data.overallInterpretation,
      parsed.data.computationalVsExperimental,
      parsed.data.computationalFindings,
      parsed.data.laboratoryFindings,
      parsed.data.limitations,
      parsed.data.conclusion,
      ...Object.values(parsed.data.endpointFindings),
    ]
    if (pieces.some((piece) => piece && rejectsClaim(piece))) return null
    return parsed.data
  } catch {
    return null
  }
}
