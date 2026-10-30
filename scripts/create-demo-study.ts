import { createStudy } from "../lib/repositories/studyRepository";
import { execute } from "../lib/db/mysql";

/**
 * Creates a demo study for the demo user if none exists.
 */
async function main() {
  const dummyUserId = 'demo-user';
  const now = new Date().toISOString();

  // Ensure dummy user exists
  await execute(
    `INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email), display_name = VALUES(display_name)`,
    [dummyUserId, 'demo@example.com', 'Demo User', now, now]
  );

  const owner = {
    id: dummyUserId,
    email: 'demo@example.com',
    displayName: 'Demo User',
    photoURL: null,
    createdAt: now,
    updatedAt: now,
    defaultRole: 'OWNER',
    role: undefined,
    isActive: true,
    lastLoginAt: null,
  } as any; // cast to UserProfile

  // Create a demo study
  const studyInput = {
    title: 'Demo Study for Synthetic Lab Data',
    shortTitle: 'Demo Study',
    description: 'Automatically generated study containing synthetic laboratory results for testing.',
    fairYear: '2026',
    researcherNames: ['Demo Researcher'],
    adviserNames: ['Demo Adviser'],
  };

  const study = await createStudy(owner, studyInput);
  console.log('Created demo study with ID:', study.id);
}

main().catch((e) => {
  console.error('Error creating demo study:', e);
  process.exit(1);
});
