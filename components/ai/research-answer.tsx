import { Fragment } from "react"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import type { EvidenceType } from "@/types/evidence"

const EVIDENCE = new Set<EvidenceType>([
  "REFERENCE",
  "LITERATURE",
  "PREDICTED",
  "SIMULATION",
  "EXPERIMENTAL",
  "INTERPRETATION",
])

export function ResearchAnswer({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const blocks: Array<{ kind: "h" | "p" | "list" | "evidence" | "table"; lines: string[] }> = []

  const push = (kind: "h" | "p" | "list" | "evidence" | "table", line: string) => {
    const last = blocks[blocks.length - 1]
    if (last && last.kind === kind && (kind === "p" || kind === "list" || kind === "table")) last.lines.push(line)
    else blocks.push({ kind, lines: [line] })
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (evidenceLine(line)) push("evidence", line)
    else if (/^#{1,3}\s+/.test(line)) push("h", line.replace(/^#{1,3}\s+/, ""))
    else if (/^[-*]\s+/.test(line)) push("list", line.replace(/^[-*]\s+/, ""))
    else if (line.startsWith("|")) push("table", line)
    else push("p", line)
  }

  return (
    <div className="ai-note">
      {blocks.map((block, index) => {
        if (block.kind === "evidence") {
          const mark = evidenceLine(block.lines[0])
          return <p key={index} className="ai-evidence-row">{mark ? <EvidenceMarks value={mark} /> : null}</p>
        }
        if (block.kind === "h") return <h3 key={index}>{inline(block.lines[0])}</h3>
        if (block.kind === "list") {
          return (
            <ul key={index}>
              {block.lines.map((line, lineIndex) => <li key={lineIndex}>{inline(line)}</li>)}
            </ul>
          )
        }
        if (block.kind === "table") return <Table key={index} lines={block.lines} />
        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>{lineIndex > 0 ? <br /> : null}{inline(line)}</Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function Table({ lines }: { lines: string[] }) {
  const rows = lines
    .map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()))
    .filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)))
  const [head, ...body] = rows
  if (!head) return null
  return (
    <div className="ai-table-wrap">
      <table>
        <thead>
          <tr>{head.map((cell, index) => <th key={index}>{inline(cell)}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{inline(cell)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function evidenceLine(value: string): EvidenceType | "pair" | null {
  if (EVIDENCE.has(value as EvidenceType)) return value as EvidenceType
  if (/^SIMULATION\s*(?:↔|<->)\s*EXPERIMENTAL$/.test(value)) return "pair"
  return null
}

function EvidenceMarks({ value }: { value: EvidenceType | "pair" }) {
  if (value === "pair") {
    return (
      <>
        <EvidenceBadge type="SIMULATION" />
        <span aria-hidden>↔</span>
        <EvidenceBadge type="EXPERIMENTAL" />
      </>
    )
  }
  return <EvidenceBadge type={value} />
}

function inline(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*|\$[^$\n]+\$)/g)
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith("$") && part.endsWith("$")) return <span key={index} className="ai-eq">{part.slice(1, -1)}</span>
    return <span key={index}>{part}</span>
  })
}
