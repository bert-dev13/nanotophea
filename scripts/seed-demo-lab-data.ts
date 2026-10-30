import { listStudiesForUser, getStudy } from "../lib/repositories/studyRepository";
import { createLabDataset } from "../lib/repositories/labRepository";
import { execute } from "../lib/db/mysql";

/**
 * Simple script to seed synthetic laboratory results for the first study of a demo user.
 * Creates one record for each of the six required assay endpoints.
 * New records are stored with provenance.evidenceClass = 'SYNTHETIC'. Existing rows are not rewritten.
 */
async function main() {
  const dummyUserId = 'demo-user';
  // Ensure dummy user exists (minimal fields)
  await execute(
    `INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email)`,
    [dummyUserId, 'demo@example.com', 'Demo User', new Date().toISOString(), new Date().toISOString()]
  );

  const studies = await listStudiesForUser(dummyUserId);
  if (studies.length === 0) {
    throw new Error('No studies found for demo user. Create a study first.');
  }
  const study = await getStudy(studies[0].id);
  if (!study) throw new Error('Failed to fetch study details');

  const actor = { id: dummyUserId };

  const demoDatasets = [
    {
      assayType: 'dpph',
      datasetName: 'DEMO-DPPH-001',
      instrument: 'UV-Vis Spectrophotometer',
      wavelengthNm: 517,
      observations: [
        { treatment: 'Solvent control', replicates: [0.702, 0.698, 0.705] },
        { treatment: 'Ascorbic acid', replicates: [0.112, 0.108, 0.110] },
        { treatment: '50 µg/mL', replicates: [0.548, 0.541, 0.545] },
        { treatment: '100 µg/mL', replicates: [0.431, 0.425, 0.428] },
        { treatment: '250 µg/mL', replicates: [0.264, 0.258, 0.261] },
        { treatment: '500 µg/mL', replicates: [0.143, 0.139, 0.141] },
      ],
    },
    {
      assayType: 'mtt',
      datasetName: 'DEMO-MTT-001',
      instrument: 'Plate Reader',
      observations: [
        { treatment: 'Control', replicates: [0.95, 0.97, 0.96] },
        { treatment: 'NanoHepatoTea 10 µg/mL', replicates: [0.78, 0.80, 0.79] },
        { treatment: 'NanoHepatoTea 50 µg/mL', replicates: [0.55, 0.57, 0.56] },
      ],
    },
    {
      assayType: 'ldh',
      datasetName: 'DEMO-LDH-001',
      instrument: 'Microplate Spectrophotometer',
      observations: [
        { treatment: 'Control', replicates: [0.10, 0.12, 0.11] },
        { treatment: 'NanoHepatoTea 20 µg/mL', replicates: [0.45, 0.48, 0.46] },
      ],
    },
    {
      assayType: 'ros',
      datasetName: 'DEMO-ROS-001',
      instrument: 'Fluorescence Reader',
      observations: [
        { treatment: 'Control', replicates: [120, 115, 118] },
        { treatment: 'NanoHepatoTea 5 µg/mL', replicates: [250, 260, 255] },
      ],
    },
    {
      assayType: 'bax',
      datasetName: 'DEMO-BAX-001',
      instrument: 'ELISA Plate Reader',
      observations: [
        { treatment: 'Control', replicates: [0.30, 0.32, 0.31] },
        { treatment: 'NanoHepatoTea 15 µg/mL', replicates: [0.65, 0.68, 0.66] },
      ],
    },
    {
      assayType: 'hippo_yap',
      datasetName: 'DEMO-HIPPO-001',
      instrument: 'Immunofluorescence Microscope',
      observations: [
        { treatment: 'Control', replicates: [0.55, 0.57, 0.56] },
        { treatment: 'NanoHepatoTea 25 µg/mL', replicates: [0.80, 0.82, 0.81] },
      ],
    },
  ];

  for (const data of demoDatasets) {
    const record = {
      ...data,
      provenance: {
        evidenceClass: 'SYNTHETIC',
        source: 'Software test record',
        recordedAt: new Date().toISOString(),
      },
      notes: 'DEMO / SYNTHETIC DATA — FOR SYSTEM TESTING ONLY',
      datePerformed: new Date().toISOString(),
    } as any;
    await createLabDataset(study.id, actor, record);
    console.log(`Inserted ${data.assayType.toUpperCase()} demo record`);
  }
  console.log('All demo lab data seeded successfully');
}

main().catch((e) => {
  console.error('Error seeding demo lab data:', e);
  process.exit(1);
});
