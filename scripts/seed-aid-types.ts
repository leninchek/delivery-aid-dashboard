import { config as loadDotenv } from "dotenv";
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type AidTypeSeed = {
  name: string;
  unit: string;
  active: boolean;
};

const ENV_FILES = [process.env.DOTENV_CONFIG_PATH, ".env.local", ".env"].filter(
  (value): value is string => Boolean(value)
);

for (const envFile of ENV_FILES) {
  loadDotenv({ path: envFile, override: false });
}

const COLLECTION_AID_TYPES = "AidTypes";

const aidTypeSeeds: AidTypeSeed[] = [
  { name: "Despensa",              unit: "pieza", active: true },
  { name: "Apoyo económico",       unit: "MXN", active: true },
  { name: "Canasta navideña",      unit: "paquete", active: true },
  { name: "Pavo navideño",         unit: "pieza", active: true },
  { name: "Juguete",               unit: "pieza", active: true },
  { name: "Útiles escolares",      unit: "paquete", active: true },
  { name: "Mochila",               unit: "pieza", active: true },
  { name: "Uniforme escolar",      unit: "paquete", active: true },
  { name: "Rotoplas",              unit: "pieza", active: true },
  { name: "Lámina de zinc",        unit: "pieza", active: true },
  { name: "Cemento",               unit: "pieza", active: true },
  { name: "Cal",                   unit: "pieza", active: true },
  { name: "Block",                 unit: "pieza", active: true },
  { name: "Varilla",               unit: "pieza", active: true },
  { name: "Triciclo",              unit: "pieza", active: true },
  { name: "Bicicleta",             unit: "pieza", active: true },
  { name: "Leche, pañales y otros", unit: "pieza", active: true },
  { name: "Fruta y semilla",       unit: "pieza", active: true },
  { name: "Fertilizante",          unit: "pieza", active: true },
  { name: "Herramienta",           unit: "pieza", active: true },
  { name: "Silla de ruedas",       unit: "pieza", active: true },
  { name: "Muleta",                unit: "pieza", active: true },
  { name: "Colchón",               unit: "pieza", active: true },
  { name: "Cobija",                unit: "pieza", active: true },
  { name: "Balón",                 unit: "pieza", active: true },
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
    .collection(COLLECTION_AID_TYPES)
    .where("name", "==", name)
    .get();

  return snapshot.docs[0];
}

async function seedAidTypes() {
  initializeAdmin();

  const db = getFirestore();

  console.log("Starting aid types seed...");
  console.log(`Collection: ${COLLECTION_AID_TYPES}`);

  let skipped = 0;
  let added = 0;
  let failed = 0;

  for (const aidTypeSeed of aidTypeSeeds) {
    try {
      const existing = await findExistingDocumentByName(aidTypeSeed.name);

      if (existing) {
        console.log(`[SKIP] ${aidTypeSeed.name} already exists`);
        skipped++;
        continue;
      }

      await db.collection(COLLECTION_AID_TYPES).add(aidTypeSeed);
      console.log(`[ADD] ${aidTypeSeed.name}`);
      added++;
    } catch (error) {
      console.error(`[ERROR] Failed to add ${aidTypeSeed.name}:`, error);
      failed++;
    }
  }

  console.log("\n✅ Seed completed!");
  console.log(`Total: ${aidTypeSeeds.length} | Added: ${added} | Skipped: ${skipped} | Failed: ${failed}`);

  return { added, skipped, failed };
}

if (require.main === module) {
  seedAidTypes()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}

export { seedAidTypes };
