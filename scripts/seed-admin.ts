/**
 * One-shot Admin seed: Auth user + Firestore profile + demo study + Research Data.
 *
 * Usage: npx tsx scripts/seed-admin.ts
 *
 * Requires service.json (gitignored) at repo root.
 */
import { getAdminAuth, getAdminDb } from "../lib/firebase/admin"

const EMAIL = "admin@demo.com"
const PASSWORD = "admin123"
const DISPLAY_NAME = "NANOTOPHEA Admin"

function nowIso() {
  return new Date().toISOString()
}

function retrievedDate() {
  return nowIso().slice(0, 10)
}

async function ensureAuthUser() {
  const auth = getAdminAuth()
  try {
    const existing = await auth.getUserByEmail(EMAIL)
    await auth.updateUser(existing.uid, {
      password: PASSWORD,
      displayName: DISPLAY_NAME,
      emailVerified: true,
      disabled: false,
    })
    console.log(`Auth user updated: ${EMAIL} (${existing.uid})`)
    return existing.uid
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? String((e as { code: string }).code) : ""
    if (code !== "auth/user-not-found") throw e
    const created = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: DISPLAY_NAME,
      emailVerified: true,
    })
    console.log(`Auth user created: ${EMAIL} (${created.uid})`)
    return created.uid
  }
}

async function upsertProfile(uid: string) {
  const db = getAdminDb()
  const now = nowIso()
  const ref = db.collection("users").doc(uid)
  const snap = await ref.get()
  const profile = {
    id: uid,
    email: EMAIL,
    displayName: DISPLAY_NAME,
    photoURL: null,
    defaultRole: "OWNER",
    createdAt: snap.exists ? (snap.data()?.createdAt as string) || now : now,
    updatedAt: now,
  }
  await ref.set(profile, { merge: true })
  console.log(`Firestore profile upserted: users/${uid}`)
  return profile
}

async function ensureDemoStudy(uid: string) {
  const db = getAdminDb()
  const now = nowIso()

  const existing = await db
    .collection("studies")
    .where("ownerId", "==", uid)
    .limit(1)
    .get()

  if (!existing.empty) {
    const studyId = existing.docs[0]!.id
    console.log(`Demo study already exists: ${studyId}`)
    return studyId
  }

  const studyRef = db.collection("studies").doc()
  const study = {
    id: studyRef.id,
    title: "NanoHepatoTea Demo Study",
    shortTitle: "NANOTOPHEA",
    description: "Seeded demo study for Research Data verification.",
    status: "active",
    primaryCellLine: "HepG2",
    formulationSummary: "2 g dried Phyllanthus niruri leaf + 1 g Chitosan–TPP per tea bag",
    fairYear: "2026",
    researcherNames: [DISPLAY_NAME],
    adviserNames: [],
    ownerId: uid,
    memberIds: [uid],
    createdAt: now,
    updatedAt: now,
    contractVersion: "2026-09-29",
  }
  await studyRef.set(study)
  await studyRef.collection("members").doc(uid).set({
    id: uid,
    userId: uid,
    email: EMAIL,
    displayName: DISPLAY_NAME,
    role: "OWNER",
    addedAt: now,
    addedBy: uid,
  })
  console.log(`Demo study created: ${studyRef.id}`)
  return studyRef.id
}

/** Repair OWNER membership for every study owned by this admin UID. */
async function repairOwnedStudyMemberships(uid: string) {
  const db = getAdminDb()
  const now = nowIso()
  const snap = await db.collection("studies").where("ownerId", "==", uid).get()
  let repaired = 0
  for (const docSnap of snap.docs) {
    const studyId = docSnap.id
    const data = docSnap.data()
    const memberRef = db.collection("studies").doc(studyId).collection("members").doc(uid)
    const memberSnap = await memberRef.get()
    if (!memberSnap.exists || memberSnap.data()?.role !== "OWNER") {
      await memberRef.set({
        id: uid,
        userId: uid,
        email: EMAIL,
        displayName: DISPLAY_NAME,
        role: "OWNER",
        addedAt: now,
        addedBy: uid,
      })
      repaired += 1
      console.log(`Repaired OWNER membership: studies/${studyId}/members/${uid}`)
    }
    const memberIds = Array.isArray(data.memberIds) ? (data.memberIds as string[]) : []
    if (!memberIds.includes(uid)) {
      await docSnap.ref.update({
        memberIds: [...memberIds, uid],
        updatedAt: now,
      })
      console.log(`Repaired memberIds on study ${studyId}`)
    }
  }
  if (repaired === 0) {
    console.log(`OWNER memberships OK for ${snap.size} owned study/studies`)
  }
}

async function seedResearchData(studyId: string, uid: string) {
  const db = getAdminDb()
  const now = nowIso()
  const retrievedAt = retrievedDate()
  const actor = uid

  const envelope = (extra: Record<string, unknown>, evidenceClass: string, provenanceExtra: Record<string, unknown> = {}) => ({
    studyId,
    provenance: {
      evidenceClass,
      recordedAt: now,
      operatorId: actor,
      ...provenanceExtra,
    },
    createdAt: now,
    updatedAt: now,
    createdBy: actor,
    updatedBy: actor,
    ...extra,
  })

  const refsCol = db.collection(`studies/${studyId}/references`)
  const compoundsCol = db.collection(`studies/${studyId}/compounds`)
  const formsCol = db.collection(`studies/${studyId}/formulations`)
  const cellsCol = db.collection(`studies/${studyId}/cellLines`)
  const proteinsCol = db.collection(`studies/${studyId}/proteins`)

  let refId = (await refsCol.limit(1).get()).docs[0]?.id
  if (!refId) {
    const refDoc = refsCol.doc()
    refId = refDoc.id
    await refDoc.set(
      envelope(
        {
          id: refDoc.id,
          title:
            "AutoDock Vina: improving the speed and accuracy of docking with a new scoring function, efficient optimization, and multithreading",
          authors: "Trott O, Olson AJ",
          year: "2010",
          journal: "Journal of Computational Chemistry",
          doi: "10.1002/jcc.21334",
          pmid: "19499576",
          url: "https://pubmed.ncbi.nlm.nih.gov/19499576/",
          retrievedAt,
          notes: "Method reference for future docking imports — not a docking result.",
        },
        "LITERATURE",
        { citation: "PMID:19499576", source: "PubMed", retrievedAt }
      )
    )
    console.log("Reference seeded")
  }

  let compoundId = (await compoundsCol.limit(1).get()).docs[0]?.id
  if (!compoundId) {
    const compoundDoc = compoundsCol.doc()
    compoundId = compoundDoc.id
    await compoundDoc.set(
      envelope(
        {
          id: compoundDoc.id,
          name: "Quercetin",
          pubchemCid: 5280343,
          smiles: "C1=CC(=C(C=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O)O",
          formula: "C15H10O7",
          molecularWeight: 302.24,
          chemicalClass: "Flavonol",
          plantPart: "Leaves / stems (marker)",
          source: "PubChem CID 5280343",
          isPrimaryMarker: true,
          notes: "Primary marker compound for NanoHepatoTea.",
          referenceIds: [],
        },
        "REFERENCE",
        { source: "PubChem", retrievedAt }
      )
    )
    console.log("Quercetin compound seeded")
  }

  if ((await formsCol.limit(1).get()).empty) {
    const formDoc = formsCol.doc()
    await formDoc.set(
      envelope(
        {
          id: formDoc.id,
          name: "NanoHepatoTea",
          plantMaterial: "Dried Phyllanthus niruri (Sampasampalukan) leaf",
          scientificName: "Phyllanthus niruri L.",
          leafMassG: 2,
          nanocarrierMassG: 1,
          totalMassG: 3,
          markerCompound: "Quercetin",
          markerCompoundId: compoundId,
          methodNotes:
            "Chitosan–TPP nanocarrier prepared by ionic gelation; encapsulating aqueous P. niruri extract. Tea bag: 2 g dried leaf + 1 g nanocarrier powder.",
          storageNotes: "Store finished tea bags in clean, dry, sealed packaging.",
          isCanonical: true,
          referenceIds: [refId],
          notes: "Locked composition per STUDY_DESIGN_CONTRACT.md. Not a clinical dosage schedule.",
        },
        "REFERENCE",
        { source: "STUDY_DESIGN_CONTRACT.md / research protocol" }
      )
    )
    console.log("NanoHepatoTea formulation seeded")
  }

  if ((await cellsCol.limit(1).get()).empty) {
    const hepG2 = cellsCol.doc()
    await hepG2.set(
      envelope(
        {
          id: hepG2.id,
          name: "HepG2",
          fullName: "Hepatocellular carcinoma HepG2",
          organism: "Homo sapiens",
          tissueOrigin: "Liver",
          diseaseContext: "Hepatocellular carcinoma",
          lineType: "cancer",
          p53Status: "Wild-type",
          hbvStatus: "HBV+ (integrated)",
          sourceDatabase: "Common HCC research model (identity only)",
          isPrimaryExperimental: true,
          notes: "Primary experimental cell line for LDH in this study.",
          referenceIds: [],
        },
        "REFERENCE",
        { source: "STUDY_DESIGN_CONTRACT.md" }
      )
    )
    for (const cl of [
      {
        name: "L02",
        fullName: "Normal human hepatocyte L02",
        diseaseContext: "Normal hepatocyte reference",
        lineType: "normal",
        notes: "Optional REFERENCE context only.",
      },
      {
        name: "WRL-68",
        fullName: "WRL-68 hepatocyte reference",
        diseaseContext: "Normal hepatocyte reference",
        lineType: "normal",
        notes: "Optional REFERENCE context only.",
      },
    ]) {
      const doc = cellsCol.doc()
      await doc.set(
        envelope(
          {
            id: doc.id,
            organism: "Homo sapiens",
            tissueOrigin: "Liver",
            isPrimaryExperimental: false,
            referenceIds: [],
            ...cl,
          },
          "REFERENCE",
          { source: "Research protocol context catalog" }
        )
      )
    }
    console.log("Cell lines seeded")
  }

  if ((await proteinsCol.limit(1).get()).empty) {
    const proteins = [
      { name: "YAP1", gene: "YAP1", pdbId: "5YLH", pathway: "Hippo–YAP", role: "oncogene / transcriptional co-activator", functionNotes: "TEAD-associated transcriptional co-activator relevant to HCC proliferation." },
      { name: "BAX", gene: "BAX", pdbId: "4S0O", pathway: "Intrinsic apoptosis", role: "pro-apoptotic", functionNotes: "BCL-2 family pore-forming protein." },
      { name: "BCL-2", gene: "BCL2", pdbId: "2YIU", pathway: "Intrinsic apoptosis", role: "anti-apoptotic", functionNotes: "Anti-apoptotic BCL-2 family member." },
      { name: "Caspase-3", gene: "CASP3", pdbId: "2XYG", pathway: "Apoptosis execution", role: "executioner caspase", functionNotes: "Executioner caspase in apoptosis cascade." },
      { name: "Nrf2", gene: "NFE2L2", pdbId: "4IS9", pathway: "Oxidative stress / Keap1–Nrf2", role: "antioxidant regulator", functionNotes: "Master antioxidant transcription factor." },
      { name: "LATS1", gene: "LATS1", pdbId: "5YLH", pathway: "Hippo–YAP", role: "tumor suppressor kinase", functionNotes: "Hippo pathway kinase that phosphorylates YAP." },
    ]
    for (const p of proteins) {
      const doc = proteinsCol.doc()
      await doc.set(
        envelope(
          {
            id: doc.id,
            ...p,
            source: p.pdbId ? `RCSB PDB ${p.pdbId}` : "Research target catalog",
            referenceIds: [refId],
          },
          "REFERENCE",
          { source: p.pdbId ? "RCSB PDB" : "Research protocol", retrievedAt }
        )
      )
    }
    console.log("Proteins seeded")
  } else {
    console.log("Research Data collections already present")
  }
}

async function main() {
  console.log("Seeding with Firebase Admin + service.json …")
  const uid = await ensureAuthUser()
  await upsertProfile(uid)
  await repairOwnedStudyMemberships(uid)
  const studyId = await ensureDemoStudy(uid)
  await repairOwnedStudyMemberships(uid)
  await seedResearchData(studyId, uid)
  console.log("\nDone. Sign in with:")
  console.log(`  Email:    ${EMAIL}`)
  console.log(`  Password: ${PASSWORD}`)
  console.log(`  Study:    ${studyId}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
