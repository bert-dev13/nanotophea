import { migrateAllStudies } from "../lib/docking/migration"

async function main() {
  console.log("=== STARTING IDEMPOTENT DOCKING DATA MIGRATION ===")
  const summaries = await migrateAllStudies()
  for (const s of summaries) {
    console.log(`\nStudy: ${s.studyId} (${s.studyTitle})`)
    console.log(`  Compounds count: ${s.compoundsCount}`)
    console.log(`  Proteins before: ${s.proteinsBeforeCount} -> after: ${s.proteinsAfterCount} (removed ${s.duplicateProteinsRemoved} duplicate records)`)
    console.log(`  Docking runs before: ${s.runsBeforeCount} -> runs preserved: ${s.runsPreservedCount}`)
    console.log(`  Canonical DockingPairs created/updated: ${s.canonicalPairsCreated}`)
    for (const p of s.pairs) {
      console.log(`    - Pair ${p.pairId} (${p.compoundName} × ${p.targetName}): ${p.runsCount} runs, latest affinity: ${p.latestAffinity} kcal/mol (runId: ${p.latestRunId})`)
    }
  }
  console.log("\n=== MIGRATION COMPLETED SUCCESSFULLY ===")
}

main().catch(console.error)
