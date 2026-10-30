export function ExperimentalCoverage({
  tested,
  endpoints,
}: {
  tested: number | null
  endpoints: Array<{ id: string; label: string; recorded: boolean }>
}) {
  return (
    <section className="ai-coverage-map">
      <h3>Experimental coverage</h3>
      <p>{tested == null ? "—" : `${tested} / 6`}</p>
      <ul>
        {endpoints.map((endpoint) => (
          <li key={endpoint.id} data-recorded={endpoint.recorded ? "true" : "false"}>
            <span aria-hidden>{endpoint.recorded ? "●" : "○"}</span>
            {endpoint.label}
          </li>
        ))}
      </ul>
      <dl>
        <div><dt>●</dt><dd>Experimental result recorded</dd></div>
        <div><dt>○</dt><dd>No experimental result recorded</dd></div>
      </dl>
    </section>
  )
}
