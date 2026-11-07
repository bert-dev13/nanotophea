import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { studyAccessAllowed } from "./access"
import { parseChatRequest } from "./chat-request"
import { planConversation, renderConversationContext } from "./conversation"
import { assembleStudyAIContext } from "./context"
import { allowAiRequest } from "./rate-limit"
import { RESEARCH_ASSISTANT_SYSTEM_PROMPT } from "./system-prompt"
import { AI_MISSING_EXPERIMENT, type StudyAISlice } from "./types"
import { parseInterpretationDraft } from "./together"

function slice(patch: Partial<StudyAISlice> = {}): StudyAISlice {
  return {
    title: "NANOHEPATOTEA",
    compounds: ["Quercetin"],
    proteins: ["KEAP1", "YAP1"],
    cellLines: ["HepG2"],
    admetCount: 1,
    adme: [],
    docking: [{ pair: "Quercetin × KEAP1", affinityKcalMol: -8.084 }],
    dockingSkipped: [],
    predictions: [{ endpoint: "MTT", evidence: "SIMULATION", lines: ["IC50: 262.33 µg/mL"] }],
    laboratory: [
      { endpoint: "DPPH", status: "recorded" },
      { endpoint: "MTT", status: "pending" },
      { endpoint: "LDH", status: "recorded" },
      { endpoint: "ROS", status: "not_tested" },
      { endpoint: "BAX", status: "pending" },
      { endpoint: "Hippo–YAP", status: "pending" },
    ],
    statistics: [],
    comparisons: [],
    characterization: [],
    interpretation: { overall: "", relationship: "", limitations: "", conclusion: "" },
    coverage: { tested: 2, endpoints: 6 },
    ...patch,
  }
}

describe("study access", () => {
  it("allows the owner and members and rejects everyone else", () => {
    const study = { ownerId: "owner", memberIds: ["member"] }
    assert.equal(studyAccessAllowed(study, "owner"), true)
    assert.equal(studyAccessAllowed(study, "member"), true)
    assert.equal(studyAccessAllowed(study, "other"), false)
    assert.equal(studyAccessAllowed(null, "owner"), false)
  })
})

describe("study context", () => {
  it("does not turn a missing experiment into a zero or an experimental result", () => {
    const context = assembleStudyAIContext(slice(), { workflowStep: "analysis", currentPage: "06 · Analysis & Interpretation", currentEndpoint: "MTT" })
    assert.match(context, new RegExp(AI_MISSING_EXPERIMENT))
    assert.doesNotMatch(context, /MTT: EXPERIMENTAL/)
    assert.doesNotMatch(context, /MTT.*\b0\b/)
    assert.match(context, /2 of 6 endpoints/)
    assert.match(context, /Quercetin × KEAP1: -8.084 kcal\/mol/)
    assert.match(context, /\[SIMULATION\]/)
  })
})

describe("assistant guardrails", () => {
  it("tells the model not to invent results or treat simulation as experiment", () => {
    assert.match(RESEARCH_ASSISTANT_SYSTEM_PROMPT, /Never invent laboratory results/)
    assert.match(RESEARCH_ASSISTANT_SYSTEM_PROMPT, /Never invent ADME properties/)
    assert.match(RESEARCH_ASSISTANT_SYSTEM_PROMPT, /Never treat missing values as zero/)
    assert.match(RESEARCH_ASSISTANT_SYSTEM_PROMPT, /Never convert SIMULATION into EXPERIMENTAL/)
    assert.match(RESEARCH_ASSISTANT_SYSTEM_PROMPT, new RegExp(AI_MISSING_EXPERIMENT))
    assert.match(RESEARCH_ASSISTANT_SYSTEM_PROMPT, /Do not automatically produce Overall Interpretation/)
    assert.match(RESEARCH_ASSISTANT_SYSTEM_PROMPT, /Do not classify Vina scores as strong, moderate, or weak/)
    assert.match(RESEARCH_ASSISTANT_SYSTEM_PROMPT, /Do not invent concentrations/)
  })

  it("accepts an ordinary question after a long previous answer", () => {
    const parsed = parseChatRequest({
      studyId: "study-1",
      intent: "chat",
      page: { workflowStep: "", currentPage: "Entire study", currentEndpoint: null },
      messages: [
        { role: "assistant", content: "x".repeat(2000) },
        { role: "user", content: "What is NANOTOPHEA?" },
      ],
    })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.data.messages.at(-1)?.content, "What is NANOTOPHEA?")
    assert.equal(parsed.data.messages[0]?.content.length, 2000)
  })

  it("accepts a single message without a study evidence payload", () => {
    const parsed = parseChatRequest({ message: "Can you understand Chinese?" })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.data.studyId, undefined)
    assert.equal(parsed.data.messages[0]?.content, "Can you understand Chinese?")
  })

  it("parses a draft without treating it as a saved interpretation", () => {
    const draft = parseInterpretationDraft('```json\n{"overall":"A","relationship":"B","limitations":"C","conclusion":"D"}\n```')
    assert.deepEqual(draft, { overall: "A", relationship: "B", limitations: "C", conclusion: "D" })
    assert.equal(parseInterpretationDraft("no json"), null)
  })

  it("rate limits repeated requests", () => {
    const uid = `limit-${Date.now()}`
    for (let index = 0; index < 12; index += 1) assert.equal(allowAiRequest(uid, 1_000 + index), true)
    assert.equal(allowAiRequest(uid, 1_010), false)
  })
})

describe("conversation planning", () => {
  const history = (question: string, previous?: string) => [
    ...(previous ? [{ role: "user" as const, content: previous }, { role: "assistant" as const, content: "The recorded docking scores are listed above." }] : []),
    { role: "user" as const, content: question },
  ]

  it("keeps ordinary questions out of the study record", () => {
    for (const question of ["Can you understand Chinese?", "Thanks", "What is NANOTOPHEA?"]) {
      const plan = planConversation(history(question))
      const context = renderConversationContext(slice(), plan)
      assert.equal(context, "")
      assert.notEqual(plan.intent, "RESULT_EXPLANATION")
    }
    assert.equal(planConversation(history("What is HEPATOTEA?")).intent, "PLATFORM_QUESTION")
    assert.equal(planConversation(history("What is NANO-HEPATOTEA?")).intent, "PLATFORM_QUESTION")
    assert.equal(planConversation(history("What is NANOTOPHEA?")).intent, "PLATFORM_QUESTION")
    assert.equal(planConversation(history("Thanks")).intent, "GENERAL_CONVERSATION")
  })

  it("uses docking evidence for docking questions and follow-ups", () => {
    const explained = planConversation(history("Explain my docking results"))
    assert.equal(explained.scope, "docking")
    const context = renderConversationContext(slice(), explained)
    assert.match(context, /Quercetin × KEAP1: -8.084 kcal\/mol/)
    assert.doesNotMatch(context, /IC50/)

    const followUp = planConversation(history("Which one is better?", "Explain my docking results"))
    assert.equal(followUp.scope, "docking")
    assert.match(followUp.guidance, /previous turn/)
  })

  it("grounds recommendations in coverage without assay protocols", () => {
    const plan = planConversation(history("What are your recommendations?"))
    assert.equal(plan.intent, "RECOMMENDATION")
    assert.match(plan.guidance, /Do not invent concentrations/)
    const context = renderConversationContext(slice(), plan)
    assert.match(context, /DPPH: experimental result recorded/)
    assert.match(context, new RegExp(AI_MISSING_EXPERIMENT))
    assert.doesNotMatch(context, /IC50/)
  })

  it("scopes a selected docking target and collapses reruns", () => {
    const plan = planConversation(history("Summarize my research findings"), {
      workflowStep: "docking",
      currentPage: "Molecular Docking",
      currentEndpoint: null,
      focusLabel: "YAP1",
    })
    assert.equal(plan.scope, "docking")
    assert.equal(plan.focus, "YAP1")
    assert.match(plan.guidance, /Summary, Key Findings/)
    const context = renderConversationContext(slice({
      docking: [
        { pair: "Quercetin × KEAP1", affinityKcalMol: -8.084, updatedAt: "2026-01-01T00:00:00.000Z" },
        { pair: "Quercetin × YAP1", affinityKcalMol: -7.1, updatedAt: "2026-01-01T00:00:00.000Z" },
        { pair: "Quercetin × YAP1 repeat", affinityKcalMol: -7.552, updatedAt: "2026-02-01T00:00:00.000Z" },
      ],
    }), plan)
    assert.match(context, /Quercetin × YAP1: -7\.552 kcal\/mol/)
    assert.match(context, /latest of 2 runs/)
    assert.doesNotMatch(context, /KEAP1: -8/)
    assert.doesNotMatch(context, /YAP1 repeat/)
  })

  it("does not describe a synthetic laboratory record as an experiment", () => {
    const plan = planConversation(history("Explain my laboratory results"), {
      workflowStep: "laboratory",
      currentPage: "Laboratory Validation",
      currentEndpoint: "MTT",
      focusLabel: "MTT",
    })
    const context = renderConversationContext(slice({
      laboratory: [{ endpoint: "MTT", status: "recorded", evidence: "SYNTHETIC" }],
    }), plan)
    assert.match(context, /SYNTHETIC record only/)
    assert.doesNotMatch(context, /MTT: EXPERIMENTAL/)
    assert.doesNotMatch(context, /experimental result recorded/)
  })

  it("keeps a full report request detailed", () => {
    const plan = planConversation(history("Give me a full report of my study"))
    assert.match(plan.guidance, /detailed report/)
    assert.doesNotMatch(plan.guidance, /Default answer shape/)
  })

  it("keeps a concept question from dumping every endpoint value", () => {
    const plan = planConversation(history("Why is KEAP1 important?"))
    assert.equal(plan.intent, "SCIENTIFIC_CONCEPT")
    const context = renderConversationContext(slice({
      docking: [
        { pair: "Quercetin × KEAP1", affinityKcalMol: -8.084 },
        { pair: "Quercetin × YAP1", affinityKcalMol: -7.518 },
      ],
    }), plan)
    assert.match(context, /KEAP1: -8.084/)
    assert.doesNotMatch(context, /-7\.518/)
    assert.doesNotMatch(context, /IC50/)
  })
})

describe("client bundle boundary", () => {
  it("keeps the Together client and API key on the server", () => {
    const files = walk(join(process.cwd(), "components")).concat(walk(join(process.cwd(), "app")))
    const offenders = files.filter((file) => {
      if (file.endsWith(`${join("app", "api", "ai", "chat", "route.ts")}`)) return false
      const source = readFileSync(file, "utf8")
      return source.includes("TOGETHER_API_KEY") || source.includes("together-ai")
    })
    assert.deepEqual(offenders, [])
  })
})

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return walk(path)
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : []
  })
}
