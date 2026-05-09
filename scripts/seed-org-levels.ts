import { config as loadDotenv } from "dotenv";
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type OrgLevelSeed = {
  name: string;
  rank: number;
  canUseApp: boolean;
  capabilities: string[];
  active: boolean;
};

const ENV_FILES = [process.env.DOTENV_CONFIG_PATH, ".env.local", ".env"].filter(
  (value): value is string => Boolean(value)
);

for (const envFile of ENV_FILES) {
  loadDotenv({ path: envFile, override: false });
}

const COLLECTION_ORG_LEVELS = "OrgLevels";

const orgLevelSeeds: OrgLevelSeed[] = [
  {
    name: "Coordinador General",
    rank: 1,
    canUseApp: false,
    capabilities: [],
    active: true,
  },
  {
    name: "Distrital",
    rank: 2,
    canUseApp: false,
    capabilities: [],
    active: true,
  },
  {
    name: "Coordinador",
    rank: 3,
    canUseApp: true,
    capabilities: [
      "can_create_direct_delivery",
      "can_create_indirect_delivery",
      "can_view_own_promoted",
      "can_edit_own_promoted",
      "can_delete_own_promoted",
      "can_view_own_deliveries",
      "can_view_notifications",
    ],
    active: true,
  },
  {
    name: "Seccional",
    rank: 4,
    canUseApp: true,
    capabilities: [
      "can_create_direct_delivery",
      "can_create_indirect_delivery",
      "can_view_own_promoted",
      "can_edit_own_promoted",
      "can_delete_own_promoted",
      "can_view_own_deliveries",
      "can_view_notifications",
    ],
    active: true,
  },
  {
    name: "Activista",
    rank: 5,
    canUseApp: true,
    capabilities: [
      "can_create_direct_delivery",
      "can_register_promoted",
      "can_create_indirect_delivery",
      "can_view_own_promoted",
      "can_edit_own_promoted",
      "can_delete_own_promoted",
      "can_view_own_deliveries",
      "can_view_notifications",
    ],
    active: true,
  },
];

function hasArg(flag: string) {
  return process.argv.includes(flag);
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function initializeAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const adminProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const publicProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();

  if (serviceAccountJson) {
    const rawServiceAccount = JSON.parse(serviceAccountJson) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    const serviceAccount: ServiceAccount = {
      projectId: rawServiceAccount.project_id,
      clientEmail: rawServiceAccount.client_email,
      privateKey: rawServiceAccount.private_key,
    };

    return initializeApp({
      credential: cert(serviceAccount),
      projectId: publicProjectId || adminProjectId || serviceAccount.projectId,
    });
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (adminProjectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId: adminProjectId,
        clientEmail,
        privateKey,
      }),
      projectId: adminProjectId,
    });
  }

  const projectId = publicProjectId || adminProjectId || undefined;
  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

async function findExistingDocumentByName(name: string) {
  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTION_ORG_LEVELS)
    .where("name", "==", name)
    .get();

  if (snapshot.docs.length > 1) {
    throw new Error(`Multiple ${COLLECTION_ORG_LEVELS} documents found for name: ${name}`);
  }

  return snapshot.docs[0] ?? null;
}

async function main() {
  const isDryRun = hasArg("--dry-run");

  getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  initializeAdmin();

  const db = getFirestore();

  let created = 0;
  let updated = 0;
  const skipped = 0;

  console.log(
    `${isDryRun ? "[dry-run] " : ""}Seeding ${COLLECTION_ORG_LEVELS} for project ${getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID")}`
  );

  for (const seed of orgLevelSeeds) {
    const existingDoc = await findExistingDocumentByName(seed.name);
    const targetRef = existingDoc?.ref ?? db.collection(COLLECTION_ORG_LEVELS).doc();
    const payload = {
      name: seed.name,
      rank: seed.rank,
      canUseApp: seed.canUseApp,
      capabilities: seed.capabilities,
      active: seed.active,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!existingDoc) {
      created += 1;
      console.log(`create "${seed.name}" (rank=${seed.rank}) -> docId=${targetRef.id}`);
      if (!isDryRun) {
        await targetRef.set({
          ...payload,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      continue;
    }

    updated += 1;
    console.log(`update "${seed.name}" (rank=${seed.rank}) -> docId=${targetRef.id}`);
    if (!isDryRun) {
      await targetRef.set(payload, { merge: true });
    }
  }

  console.log(`summary created=${created} updated=${updated} skipped=${skipped}`);
}

main().catch((error) => {
  console.error("Seed failed.");
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
