import path from "node:path";
const root = path.resolve(__dirname, "..");
process.chdir(root);
process.env.VINA_BIN = process.env.VINA_BIN || path.join(root, "tools", "vina", "vina.exe");
process.env.DOCKING_PYTHON = process.env.DOCKING_PYTHON || path.join(root, ".adme-venv", "Scripts", "python.exe");

import { resolveDockingProfile } from '../services/docking/resolveProfile';
import { executeVina } from '../services/docking/vina';
import { CATALOG_PROTEINS } from '../lib/catalog/reusableResearchCatalog';
import { DOCKING_PROFILE_SPECS, profileSpecForProtein } from '../lib/docking/profiles';
import type { ApprovedDockingConfiguration } from '../lib/domain/models';

const READY_TARGETS = [
  { key: 'yap1', name: 'YAP1', pdbId: '3KYS' },
  { key: 'bax', name: 'BAX', pdbId: '4ZIE' },
  { key: 'bcl2', name: 'BCL-2', pdbId: '4LVT' },
  { key: 'casp3', name: 'Caspase-3', pdbId: '2XYG' },
  { key: 'keap1', name: 'KEAP1', pdbId: '8EJR' },
  { key: 'tp53', name: 'p53', pdbId: '2VUK' },
  { key: 'egfr', name: 'EGFR', pdbId: '1M17' },
  { key: 'casp9', name: 'Caspase-9', pdbId: '1JXQ' },
  { key: 'mmp9', name: 'MMP-9', pdbId: '1GKC' },
  { key: 'mtor', name: 'mTOR', pdbId: '4JT5' },
  { key: 'lats1', name: 'LATS1', pdbId: 'LATS1_AF' },
  { key: 'ccnd1', name: 'Cyclin D1', pdbId: '5L2I' },
];

async function run() {
  console.log('=== STARTING AUDIT OF 10 READY TARGETS ===');
  for (const t of READY_TARGETS) {
    console.log(`\n--- Auditing ${t.name} (PDB: ${t.pdbId}) ---`);
    const catalogItem = CATALOG_PROTEINS.find((p: { key: string; name: string }) => p.key === t.key || p.name.toLowerCase() === t.name.toLowerCase());
    const spec = profileSpecForProtein({ pdbId: t.pdbId, name: t.name, targetId: t.key });
    if (!spec) {
      console.error(`FAIL: No profile spec found for ${t.name}`);
      continue;
    }
    console.log(`Spec ID: ${spec.id}, Receptor: ${spec.dockingReceptor}, Receptor UniProt: ${spec.receptorUniprotId}`);
    
    // Resolve profile
    const resolved = await resolveDockingProfile(catalogItem ?? { pdbId: t.pdbId, name: t.name, targetId: t.key });
    if (!resolved.ok) {
      console.error(`FAIL resolveDockingProfile: ${resolved.reason}`);
      continue;
    }
    const prof = resolved.profile;
    console.log(`Resolved successfully! Receptor chains: [${prof.receptorChains.join(', ')}], Ref entity: ${prof.referenceEntity}, Ref chain: ${prof.referenceChain}`);
    console.log(`Grid: center=(${prof.centerX.toFixed(2)}, ${prof.centerY.toFixed(2)}, ${prof.centerZ.toFixed(2)}), size=(${prof.sizeX.toFixed(2)}, ${prof.sizeY.toFixed(2)}, ${prof.sizeZ.toFixed(2)})`);

    // Prepare configuration
    const config: ApprovedDockingConfiguration = {
      proteinId: t.key,
      centerX: prof.centerX,
      centerY: prof.centerY,
      centerZ: prof.centerZ,
      sizeX: prof.sizeX,
      sizeY: prof.sizeY,
      sizeZ: prof.sizeZ,
      exhaustiveness: prof.exhaustiveness,
      numModes: prof.numModes,
      energyRange: prof.energyRange,
      approvedAt: prof.verifiedAt,
      approvedBy: 'audit',
    };

    const restore = prof.referenceResidue && prof.restoreAs && prof.restoreAtomNames ? {
      residue: prof.referenceResidue,
      as: prof.restoreAs,
      atomNames: prof.restoreAtomNames,
    } : undefined;

    // Run Vina test with Gallic Acid (CID 370)
    console.log('Running AutoDock Vina test execution with Gallic Acid (CID 370)...');
    try {
      const start = Date.now();
      const outcome = await executeVina({
        cid: 370,
        pdbId: prof.pdbId,
        receptorChains: prof.receptorChains,
        receptorRestore: restore,
        configuration: config,
      });
      const dur = ((Date.now() - start)/1000).toFixed(1);
      console.log(`Vina SUCCESS in ${dur}s! Receptor tool: ${outcome.receptorTool}, Ligand tool: ${outcome.ligandTool}`);
      const logLines = outcome.log.split('\n').filter((l: string) => l.includes('1 ') || l.includes('affinity') || l.includes('Estimated Free Energy') || l.includes('mode |'));
      console.log('Log excerpt:', logLines.slice(0, 5).join('; '));
    } catch (err: any) {
      console.error(`FAIL executeVina: ${err.message}`);
    }
  }
}

run().catch(console.error);
