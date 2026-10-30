import { DOCKING_PROFILE_SPECS, isCompleteDockingProfile, dockingProfileReport } from '../lib/docking/profiles';
import { CATALOG_PROTEINS } from '../lib/catalog/reusableResearchCatalog';

console.log('Total Profiles in DOCKING_PROFILE_SPECS:', DOCKING_PROFILE_SPECS.length);
for (const s of DOCKING_PROFILE_SPECS) {
  console.log(`- ${s.id} (${s.biologicalTarget}): isComplete = ${isCompleteDockingProfile(s)}`);
}

console.log('\nCatalog Proteins Readiness Check:');
for (const p of CATALOG_PROTEINS) {
  const report = dockingProfileReport(p);
  console.log(`- ${p.name} (${p.key}): ready = ${report.ready}, status = ${report.status}, pdbId = ${report.pdbId}`);
}
