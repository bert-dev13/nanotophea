import { describeLaboratory } from "@/lib/ai/context"
import { dockingFocusMatches, representativeDocking, wantsRunHistory } from "@/lib/ai/docking-groups"
import type { AiChatMessage, AiPageContext, StudyAISlice } from "@/lib/ai/types"

export type ChatIntent =
  | "GENERAL_CONVERSATION"
  | "PLATFORM_QUESTION"
  | "STUDY_QUESTION"
  | "RESULT_EXPLANATION"
  | "EVIDENCE_COMPARISON"
  | "SCIENTIFIC_CONCEPT"
  | "RECOMMENDATION"
  | "LIMITATION"
  | "WORKFLOW_HELP"

type ContextScope =
  | "none"
  | "overview"
  | "setup"
  | "screening"
  | "docking"
  | "predictions"
  | "laboratory"
  | "statistics"
  | "endpoint"
  | "comparison"
  | "analysis"
  | "recommendation"
  | "limitations"
  | "workflow"
  | "concept"

export interface ConversationPlan {
  intent: ChatIntent
  scope: ContextScope
  endpoint: string | null
  focus: string | null
  question: string
  guidance: string
}

const ENDPOINTS: Array<[string, RegExp]> = [
  ["dpph", /\bdpph\b/i],
  ["mtt", /\bmtt\b/i],
  ["ldh", /\bldh\b/i],
  ["ros", /\bros\b/i],
  ["bax", /\bbax\b/i],
  ["hippo", /hippo|yap1|yap\b/i],
]

export function planConversation(messages: AiChatMessage[], page: AiPageContext = { workflowStep: "", currentPage: "" }): ConversationPlan {
  const latestIndex = messages.findLastIndex((message) => message.role === "user")
  const latest = latestIndex >= 0 ? messages[latestIndex]?.content ?? "" : ""
  const direct = classify(latest, page)
  let resolved: ConversationPlan
  if (direct) {
    resolved = { ...direct, question: latest }
  } else if (isFollowUp(latest)) {
    const prior = [...messages.slice(0, latestIndex)].reverse().find((message) => message.role === "user")
    const inherited = prior ? classify(prior.content, page) : null
    resolved = inherited && inherited.scope !== "none"
      ? {
        ...inherited,
        question: latest,
        intent: inherited.intent === "RECOMMENDATION" || inherited.intent === "PLATFORM_QUESTION" ? "RESULT_EXPLANATION" : inherited.intent,
        guidance: `${inherited.guidance} The latest question refers to the previous turn. Answer that reference directly and do not ask the researcher to repeat results already discussed.`,
      }
      : generalPlan(latest)
  } else {
    resolved = generalPlan(latest)
  }
  return { ...applyPageFocus(resolved, page, latest), question: latest }
}

export function renderConversationContext(slice: StudyAISlice, plan: ConversationPlan, page: AiPageContext = { workflowStep: "", currentPage: "" }): string {
  if (plan.scope === "none") return ""
  const lines = [`Study: ${slice.title}`, `Phytochemicals: ${listed(slice.compounds)}`, `Target proteins: ${listed(slice.proteins)}`, `Cell lines: ${listed(slice.cellLines)}`]
  if (page.currentPage && plan.scope !== "overview") lines.push(`Selected scope: ${page.currentPage}${plan.focus ? ` / ${plan.focus}` : ""}`)
  if (plan.scope === "setup") {
    lines.push("Answer from the research setup above. Do not dump docking scores, predictions, or laboratory values unless the question asks for them.")
    return lines.join("\n")
  }
  if (plan.scope === "screening") {
    lines.push("In-silico screening (PREDICTED ADME):")
    if (slice.adme.length === 0) lines.push("- No ADME assessment is recorded.")
    for (const row of slice.adme) {
      lines.push(`- ${row.compound} (${row.source})`)
      for (const line of row.lines.slice(0, 12)) lines.push(`  ${line}`)
    }
    return lines.join("\n")
  }
  if (plan.scope === "workflow" && page.currentPage) lines.push(`Current page: ${page.currentPage}`)

  const wantsCoverage = ["overview", "analysis", "recommendation", "limitations", "workflow", "laboratory", "comparison"].includes(plan.scope)
  if (wantsCoverage) {
    lines.push("Laboratory coverage. A stored row is experimental only when its evidence class says EXPERIMENTAL:")
    for (const row of relevantLab(slice, plan)) lines.push(`- ${row.endpoint}: ${describeLaboratory(row)}`)
  }

  const wantsDocking = plan.scope === "docking" || plan.scope === "overview" || plan.scope === "recommendation" || plan.scope === "concept"
  if (wantsDocking) appendDocking(lines, slice, plan)

  const wantsPredictions = plan.scope === "predictions" || plan.scope === "endpoint" || plan.scope === "comparison" || plan.scope === "analysis" || (plan.scope === "concept" && plan.endpoint)
  if (wantsPredictions || plan.scope === "overview") {
    lines.push("Biological predictions:")
    const rows = slice.predictions.filter((row) => !plan.endpoint || endpointName(row.endpoint) === plan.endpoint)
    if (rows.length === 0) lines.push("- No matching prediction is recorded.")
    for (const row of rows) {
      const detailed = plan.scope !== "overview" && plan.scope !== "analysis"
      lines.push(`- ${row.endpoint} [${row.evidence}]`)
      if (detailed) {
        if (row.lines.length === 0) lines.push("  No stored prediction values.")
        for (const line of row.lines) lines.push(`  ${line}`)
      }
    }
  }

  if (plan.scope === "endpoint" || plan.scope === "laboratory" || plan.scope === "comparison" || (plan.scope === "concept" && plan.endpoint)) {
    if (!wantsCoverage) lines.push("Laboratory status:")
    for (const row of relevantLab(slice, plan)) {
      if (!wantsCoverage) lines.push(`- ${row.endpoint}: ${describeLaboratory(row)}`)
      for (const line of (row.lines ?? []).slice(0, 6)) lines.push(`  ${line}`)
    }
  }

  if (plan.scope === "statistics" || plan.scope === "endpoint" || plan.scope === "comparison" || plan.scope === "laboratory" || plan.scope === "analysis") {
    lines.push("Statistics:")
    const stats = slice.statistics.filter((row) => !plan.endpoint || endpointName(row.endpoint) === plan.endpoint)
    if (stats.length === 0) lines.push("- No statistical analysis is recorded for this question.")
    for (const row of stats) {
      const p = row.pValue == null ? "p value not recorded" : `p = ${row.pValue}`
      lines.push(`- ${row.endpoint} ${row.measurement}: ${row.message || "calculated"} (${p})`)
      if (plan.scope !== "analysis") {
        for (const mean of row.means.slice(0, 6)) lines.push(`  ${mean}`)
      }
    }
  }

  if (plan.scope === "comparison" || plan.scope === "endpoint" || plan.scope === "analysis") {
    lines.push("Stored comparison limits. Do not call a prediction experimentally validated unless a comparison below supports that:")
    const comparisons = slice.comparisons.filter((row) => !plan.endpoint || endpointName(row.endpoint) === plan.endpoint)
    if (comparisons.length === 0) lines.push("- No comparison record is stored.")
    for (const row of comparisons) lines.push(`- ${row.endpoint}: ${row.mode}, compatibility ${row.status}${row.reason ? `. ${row.reason}` : ""}`)
  }

  if (plan.scope === "analysis" || plan.scope === "limitations" || plan.focus === "Conclusion" || plan.focus === "Overall Analysis") {
    appendInterpretation(lines, slice, plan.focus)
  }

  return lines.join("\n")
}

function appendDocking(lines: string[], slice: StudyAISlice, plan: ConversationPlan) {
  const history = wantsRunHistory(plan.question)
  const grouped = representativeDocking(slice.docking, history)
  const related = /\b(compare|versus|vs|other)\b/i.test(plan.question)
  let rows = plan.scope === "concept" ? grouped.filter((row) => mentions(plan.question, row.pair)) : grouped
  let skipped = plan.scope === "concept" ? slice.dockingSkipped.filter((row) => mentions(plan.question, row.pair)) : slice.dockingSkipped
  if (plan.focus && plan.scope !== "concept") {
    const selected = rows.filter((row) => dockingFocusMatches(row.pair, plan.focus!))
    const other = rows.filter((row) => !dockingFocusMatches(row.pair, plan.focus!))
    rows = selected.length === 0 ? [] : related ? [...selected, ...other] : selected
    skipped = skipped.filter((row) => dockingFocusMatches(row.pair, plan.focus!))
    if (selected.length === 0) {
      lines.push(`Docking results (PREDICTED, AutoDock Vina):`)
      lines.push(`- No docking result is recorded for ${plan.focus}.`)
      return
    }
  }
  if (plan.scope !== "concept" || rows.length > 0 || skipped.length > 0) {
    lines.push("Docking results (PREDICTED, AutoDock Vina). More negative scores are more favorable only within this docking setup. Reruns of the same compound and target are one pair:")
    if (rows.length === 0 && skipped.length === 0) lines.push("- No docking result is recorded.")
    for (const row of rows) lines.push(`- ${dockingLine(row, history)}`)
    for (const row of skipped) {
      lines.push(`- ${row.pair}: no docking result. ${row.reason}. Binding affinity: none. Do not infer an affinity.`)
    }
  }
}

function appendInterpretation(lines: string[], slice: StudyAISlice, focus: string | null) {
  const interpretation = slice.interpretation
  const written = [interpretation.overall, interpretation.relationship, interpretation.limitations, interpretation.conclusion].some(Boolean)
  lines.push("Recorded interpretation (not a new measurement):")
  if (!written) {
    lines.push("- No interpretation is recorded.")
    return
  }
  if ((!focus || focus === "Overall Analysis") && interpretation.overall) lines.push(`- Overall: ${interpretation.overall}`)
  if ((!focus || focus === "Overall Analysis" || focus === "Prediction vs Laboratory") && interpretation.relationship) {
    lines.push(`- Prediction versus laboratory: ${interpretation.relationship}`)
  }
  if ((!focus || focus === "Limitations" || focus === "Overall Analysis") && interpretation.limitations) lines.push(`- Limitations: ${interpretation.limitations}`)
  if ((!focus || focus === "Conclusion" || focus === "Overall Analysis") && interpretation.conclusion) lines.push(`- Conclusion: ${interpretation.conclusion}`)
}

function relevantLab(slice: StudyAISlice, plan: ConversationPlan) {
  return slice.laboratory.filter((item) => !plan.endpoint || endpointName(item.endpoint) === plan.endpoint)
}

function classify(text: string, page: AiPageContext): ConversationPlan | null {
  const value = text.trim()
  if (!value) return null
  const lower = value.toLowerCase()
  const endpoint = namedEndpoint(lower) ?? namedEndpoint((page.currentEndpoint ?? "").toLowerCase())

  if (isSmallTalk(lower)) {
    return plan("GENERAL_CONVERSATION", "none", null, "Answer in one or two natural sentences. Do not mention study results unless the researcher asked about them. Do not use report headings.")
  }
  if (isPlatform(lower)) {
    return plan("PLATFORM_QUESTION", "none", null, "Explain NANO-HEPATOTEA in one short paragraph, using only the platform description in your instructions. Do not add collaboration features, curated libraries, traditional-use claims, or this study's measurements.")
  }
  if (isRecommendation(lower)) {
    return plan("RECOMMENDATION", "recommendation", endpoint, "Give a short, cautious recommendation from the recorded evidence gaps. Do not invent concentrations, assay protocols, instrument settings, experimental thresholds, or ADME values. Do not write a formal report.")
  }
  if (isLimitation(lower)) {
    return plan("LIMITATION", "limitations", endpoint, "State only limitations supported by the supplied evidence. Do not invent missing measurements or citations.")
  }
  if (isWorkflow(lower)) {
    return plan("WORKFLOW_HELP", "workflow", null, "Explain where this study is in the NANO-HEPATOTEA workflow and what recorded evidence is still missing. Keep it practical and short.")
  }
  if (isComparison(lower)) {
    return plan("EVIDENCE_COMPARISON", endpoint ? "endpoint" : "comparison", endpoint, "Compare only compatible recorded evidence. If units, concentrations, or conditions are not both recorded, say a direct numerical comparison is not available. Do not treat simulation as experimental validation.")
  }
  if (isDockingQuestion(lower) || /what does\s*[-−]?\d/.test(lower)) {
    return plan("RESULT_EXPLANATION", "docking", endpoint, "Explain the recorded docking result. A more negative Vina score is more favorable only within this same docking setup. Do not label scores strong, moderate, or weak using universal cutoffs, and do not treat the score as experimental proof.")
  }
  if (/\b(statistical analysis|statistics|anova|scheff[eé])\b/.test(lower)) {
    return plan("RESULT_EXPLANATION", "statistics", endpoint, "Explain only the calculated statistics present in STUDY_CONTEXT. Do not compute new p-values.")
  }
  if (/\b(laboratory results?|experimental results?)\b/.test(lower)) {
    return plan("RESULT_EXPLANATION", "laboratory", endpoint, "Explain recorded laboratory evidence. If an endpoint has no experimental result, say so and do not fill in a value.")
  }
  if (/\b(biological predictions?|simulations?)\b/.test(lower)) {
    return plan("RESULT_EXPLANATION", "predictions", endpoint, "Explain the recorded biological predictions as SIMULATION. Do not describe them as experimental validation.")
  }
  if (/\badme\b|\bscreening\b/.test(lower)) {
    return plan("RESULT_EXPLANATION", "overview", endpoint, "Explain only recorded screening or ADME values. Do not invent ADME properties.")
  }
  if (isConcept(lower)) {
    return plan("SCIENTIFIC_CONCEPT", endpoint || mentionsStudyTarget(lower) ? "concept" : "none", endpoint, "Explain the scientific concept naturally. Use a recorded study value only when it directly answers the question, and keep the distinction between prediction and experiment.")
  }
  if (isStudyQuestion(lower)) {
    return plan("STUDY_QUESTION", "overview", null, "Summarize the current study from the supplied evidence.")
  }
  if (/explain (this|these|my results)/.test(lower) && page.currentEndpoint) {
    return plan("RESULT_EXPLANATION", "endpoint", namedEndpoint(page.currentEndpoint.toLowerCase()), "Explain the selected endpoint using only its recorded evidence.")
  }
  if (/[\u3400-\u9fff]/.test(value)) {
    return plan("STUDY_QUESTION", "overview", endpoint, "Answer in the language the researcher used. Use only the parts of STUDY_CONTEXT that the question needs, and do not produce a report template.")
  }
  return null
}

function plan(intent: ChatIntent, scope: ContextScope, endpoint: string | null, guidance: string, question = ""): ConversationPlan {
  return { intent, scope, endpoint, focus: null, question, guidance }
}

function generalPlan(question: string): ConversationPlan {
  return plan("GENERAL_CONVERSATION", "none", null, "Answer naturally and briefly. Do not produce a research report, and do not invent study results.", question)
}

function applyPageFocus(current: ConversationPlan, page: AiPageContext, question: string): ConversationPlan {
  if (current.intent === "GENERAL_CONVERSATION" || current.intent === "PLATFORM_QUESTION") return current
  const stage = page.workflowStep
  if (!stage) return withShape(current, question)
  if (questionLeavesStage(stage, question) && current.scope !== "overview" && current.scope !== "workflow" && current.scope !== "recommendation") {
    return withShape(current, question)
  }
  const focus = page.focusLabel?.trim() || null
  const assay = focus ? namedEndpoint(focus.toLowerCase()) : null
  const comparison = current.intent === "EVIDENCE_COMPARISON" || isComparison(question.toLowerCase())
  const limitation = current.intent === "LIMITATION" || isLimitation(question.toLowerCase())
  if (stage === "docking") {
    return withShape({
      ...current,
      intent: limitation ? "LIMITATION" : comparison ? "EVIDENCE_COMPARISON" : "RESULT_EXPLANATION",
      scope: "docking",
      endpoint: null,
      focus,
      guidance: `Prioritize the persisted molecular docking evidence${focus ? ` for ${focus}` : ""}. A more negative Vina score is more favorable only within this same docking setup. Do not label scores strong, moderate, or weak, and do not treat the score as experimental proof. Mention related evidence only when the question needs it.`,
    }, question)
  }
  if (stage === "predictions") {
    return withShape({
      ...current,
      intent: limitation ? "LIMITATION" : comparison ? "EVIDENCE_COMPARISON" : "RESULT_EXPLANATION",
      scope: comparison ? "comparison" : "predictions",
      endpoint: assay,
      focus,
      guidance: `Prioritize the persisted biological prediction${focus ? ` for ${focus}` : "s"}. These are predictions, not experimental results. Mention laboratory evidence only when it is recorded and the question needs it.`,
    }, question)
  }
  if (stage === "laboratory") {
    return withShape({
      ...current,
      intent: limitation ? "LIMITATION" : comparison ? "EVIDENCE_COMPARISON" : "RESULT_EXPLANATION",
      scope: comparison ? "comparison" : "laboratory",
      endpoint: assay,
      focus,
      guidance: `Prioritize the persisted laboratory record${focus ? ` for ${focus}` : "s"}. Describe a record as EXPERIMENTAL only when its evidence class is EXPERIMENTAL. Do not say an assay was performed merely because a row exists.`,
    }, question)
  }
  if (stage === "analysis") {
    const facet = focus
    const scope: ContextScope = facet === "Statistics"
      ? "statistics"
      : facet === "Limitations"
        ? "limitations"
        : facet === "Prediction vs Laboratory"
          ? "comparison"
          : "analysis"
    return withShape({
      ...current,
      intent: facet === "Limitations" ? "LIMITATION" : comparison ? "EVIDENCE_COMPARISON" : "RESULT_EXPLANATION",
      scope,
      endpoint: null,
      focus: facet,
      guidance: `Prioritize the recorded analysis${facet ? ` for ${facet}` : ""}. Do not treat a prediction as experimentally validated unless a stored comparison supports that.`,
    }, question)
  }
  if (stage === "setup") {
    return withShape({
      ...current,
      intent: "STUDY_QUESTION",
      scope: "setup",
      endpoint: null,
      focus: null,
      guidance: "Prioritize the recorded research setup: phytochemicals, targets, cell lines, and formulation.",
    }, question)
  }
  if (stage === "insilico") {
    return withShape({
      ...current,
      intent: "RESULT_EXPLANATION",
      scope: "screening",
      endpoint: null,
      focus: null,
      guidance: "Prioritize the persisted in-silico screening and ADME results. Do not invent ADME properties.",
    }, question)
  }
  return withShape(current, question)
}

function questionLeavesStage(stage: string, question: string): boolean {
  const lower = question.toLowerCase()
  if (stage === "docking") return /\b(dpph|mtt|ldh|\bros\b|laboratory results?|adme)\b/.test(lower) && !/dock|vina|kcal|affinity/.test(lower)
  if (stage === "laboratory") return /\b(dock|vina|adme)\b/.test(lower) && !/laboratory|experiment|assay/.test(lower)
  if (stage === "predictions") return /\b(dock|vina)\b/.test(lower) && !/predict/.test(lower)
  if (stage === "insilico") return /\b(dock|laboratory results?)\b/.test(lower) && !/adme|screen/.test(lower)
  return false
}

function withShape(value: ConversationPlan, question: string): ConversationPlan {
  if (value.scope === "none" || value.guidance.includes("Summary, Key Findings") || value.guidance.includes("detailed report")) return value
  const shape = wantsDetail(question)
    ? "The researcher asked for a detailed report. You may expand, and you may include docking run history when it is supplied. Still do not invent values. Describe laboratory evidence as EXPERIMENTAL only when STUDY_CONTEXT says EXPERIMENTAL."
    : "Default answer shape: Summary, Key Findings, Interpretation, Evidence. Keep each section to a few sentences. Do not list every database record. Use one latest valid docking result per compound and target unless the question asks about run history. Do not say an assay was performed unless the record is marked EXPERIMENTAL. Do not say predictions were experimentally validated unless a stored comparison supports that."
  return { ...value, guidance: `${value.guidance} ${shape}`.trim() }
}

function wantsDetail(value: string): boolean {
  return /\b(detailed|comprehensive|full analysis|full report)\b/i.test(value)
}

function isSmallTalk(value: string): boolean {
  return /^(thanks|thank you|ty|ok(?:ay)?|got it|hello|hi|hey|good (?:morning|afternoon|evening)|salamat|谢谢|謝謝|你好|您好)[.!\s]*$/.test(value)
    || /understand (?:chinese|english|filipino|tagalog)|speak chinese|你会中文|你懂中文|能听懂中文|中文吗|中文嗎/.test(value)
}

function isPlatform(value: string): boolean {
  return /what is nano-?hepatotea|what's nano-?hepatotea|ano ang nano-?hepatotea|什么是\s*nano-?hepatotea|什麼是\s*nano-?hepatotea|what is nanotophea|what's nanotophea|ano ang nanotophea|什么是\s*nanotophea|什麼是\s*nanotophea|who are you|what can you do/i.test(value)
}

function isRecommendation(value: string): boolean {
  return /recommend|what should i|what do you suggest|suggestions?|what(?:'s| is) the next|prioriti[sz]e/.test(value)
}

function isLimitation(value: string): boolean {
  return /limitation|caveat|evidence gap|what is missing|what(?:'s| is) missing/.test(value)
}

function isWorkflow(value: string): boolean {
  return /where am i|which step|research workflow|what step|how do i continue/.test(value)
}

function isComparison(value: string): boolean {
  return /compare|versus|\bvs\b|prediction and experiment|computational and experimental/.test(value)
}

function isDockingQuestion(value: string): boolean {
  return /docking|vina|kcal|affinity|binding score|binding pose/.test(value)
}

function isConcept(value: string): boolean {
  return /^(why|what) (?:is|are|does)\b/.test(value) || /important/.test(value)
}

function isStudyQuestion(value: string): boolean {
  return /my (?:current )?study|this study|summarize my|research findings|explain my findings/.test(value)
}

function isFollowUp(value: string): boolean {
  const text = value.toLowerCase()
  return /which one|which interaction|which result|more favorable|the other one|what about that|you mentioned/.test(text)
    || /^(so|and|okay|ok)[, ]+(which|what|how)\b/.test(text)
}

function mentionsStudyTarget(value: string): boolean {
  return /keap1|yap1|quercetin|phytochemical/.test(value)
}

function namedEndpoint(value: string): string | null {
  return ENDPOINTS.find(([, pattern]) => pattern.test(value))?.[0] ?? null
}

function endpointName(label: string): string | null {
  return namedEndpoint(label.toLowerCase())
}

function listed(values: string[]): string {
  return values.length ? values.join(", ") : "none recorded"
}

function mentions(question: string, pair: string): boolean {
  const haystack = question.toLowerCase()
  return pair.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2).some((token) => haystack.includes(token))
}

function dockingLine(row: StudyAISlice["docking"][number], history = false): string {
  const provenance = [row.pdbId ? `PDB ${row.pdbId}` : "", row.method ?? ""].filter(Boolean).join("; ")
  const runs = row.runCount && row.runCount > 1 ? ` (latest of ${row.runCount} runs for this pair; do not list the rerun as a separate target)` : ""
  const older = history && row.history && row.history.length > 1
    ? ` Run history: ${row.history.map((item) => `${item.affinityKcalMol} kcal/mol${item.updatedAt ? ` at ${item.updatedAt}` : ""}`).join("; ")}.`
    : ""
  return `${row.pair}: ${row.affinityKcalMol} kcal/mol${provenance ? ` (${provenance})` : ""}${runs}${older}`
}
