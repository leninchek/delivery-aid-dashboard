import { config as loadDotenv } from "dotenv";
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type DirectDeliverySeed = {
  code: string;
  label: string;
  fromLevelNames: string[];
  toLevelNames: string[];
  requiredCapability: string;
  active: boolean;
  sortOrder: number;
};

type ResolvedSeed = {
  code: string;
  label: string;
  fromLevelIds: string[];
  toLevelIds: string[];
  requiredCapability: string;
  active: boolean;
  sortOrder: number;
};

const ENV_FILES = [process.env.DOTENV_CONFIG_PATH, ".env.local", ".env"].filter(
  (value): value is string => Boolean(value)
);

for (const envFile of ENV_FILES) {
  loadDotenv({ path: envFile, override: false });
}

const COLLECTION_DIRECT_DELIVERY_TYPES = "DirectDeliveryTypes";
const COLLECTION_ORG_LEVELS = "OrgLevels";

const directDeliverySeeds: DirectDeliverySeed[] = [
  {
    code: "coordinator_to_sectional",
    label: "Coordinador a Seccional",
    fromLevelNames: ["Coordinador"],
    toLevelNames: ["Seccional"],
    requiredCapability: "can_create_direct_delivery",
    active: true,
    sortOrder: 1,
  },
  {
    code: "sectional_to_activist",
    label: "Seccional a Activista",
    fromLevelNames: ["Seccional"],
    toLevelNames: ["Activista"],
    requiredCapability: "can_create_direct_delivery",
    active: true,
    sortOrder: 2,
  },
  {
    code: "activist_to_promoted",
    label: "Activista a Promovido",
    fromLevelNames: ["Activista"],
    toLevelNames: [],
    requiredCapability: "can_create_direct_delivery",
    active: true,
    sortOrder: 3,
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

async function resolveLevelIdByName(levelName: string, isDryRun: boolean) {
  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTION_ORG_LEVELS)
    .where("name", "==", levelName)
    .get();

  const activeDocs = snapshot.docs.filter((doc) => doc.get("active") !== false);

  if (activeDocs.length === 0) {
    if (isDryRun) return `<${levelName}>`;
    throw new Error(`No active OrgLevels document found for name: ${levelName}`);
  }

  if (activeDocs.length > 1) {
    throw new Error(`Multiple active OrgLevels documents found for name: ${levelName}`);
  }

  return activeDocs[0].id;
}

async function resolveSeeds(isDryRun: boolean) {
  const resolved: ResolvedSeed[] = [];

  for (const seed of directDeliverySeeds) {
    const fromLevelIds: string[] = [];
    for (const levelName of seed.fromLevelNames) {
      fromLevelIds.push(await resolveLevelIdByName(levelName, isDryRun));
    }

    const toLevelIds: string[] = [];
    for (const levelName of seed.toLevelNames) {
      toLevelIds.push(await resolveLevelIdByName(levelName, isDryRun));
    }

    resolved.push({
      code: seed.code,
      label: seed.label,
      fromLevelIds,
      toLevelIds,
      requiredCapability: seed.requiredCapability,
      active: seed.active,
      sortOrder: seed.sortOrder,
    });
  }

  return resolved;
}

async function findExistingDocumentByCode(code: string) {
  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTION_DIRECT_DELIVERY_TYPES)
    .where("code", "==", code)
    .get();

  if (snapshot.docs.length > 1) {
    throw new Error(`Multiple ${COLLECTION_DIRECT_DELIVERY_TYPES} documents found for code: ${code}`);
  }

  return snapshot.docs[0] ?? null;
}

async function main() {
  const isDryRun = hasArg("--dry-run");

  getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  initializeAdmin();

  const db = getFirestore();
  const resolvedSeeds = await resolveSeeds(isDryRun);

  let created = 0;
  let updated = 0;
  const skipped = 0;

  console.log(
    `${isDryRun ? "[dry-run] " : ""}Seeding ${COLLECTION_DIRECT_DELIVERY_TYPES} for project ${getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID")}`
  );

  for (const seed of resolvedSeeds) {
    const existingDoc = await findExistingDocumentByCode(seed.code);
    const targetRef = existingDoc?.ref ?? db.collection(COLLECTION_DIRECT_DELIVERY_TYPES).doc(seed.code);
    const payload = {
      code: seed.code,
      label: seed.label,
      fromLevelIds: seed.fromLevelIds,
      toLevelIds: seed.toLevelIds,
      requiredCapability: seed.requiredCapability,
      active: seed.active,
      sortOrder: seed.sortOrder,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!existingDoc) {
      created += 1;
      console.log(`create ${seed.code} -> docId=${targetRef.id}`);
      if (!isDryRun) {
        await targetRef.set({
          ...payload,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      continue;
    }

    updated += 1;
    console.log(`update ${seed.code} -> docId=${targetRef.id}`);
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