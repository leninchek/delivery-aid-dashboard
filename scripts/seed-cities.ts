import { config as loadDotenv } from "dotenv";
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type CitySeed = {
  name: string;
  state: string;
  active: boolean;
};

const ENV_FILES = [process.env.DOTENV_CONFIG_PATH, ".env.local", ".env"].filter(
  (value): value is string => Boolean(value)
);

for (const envFile of ENV_FILES) {
  loadDotenv({ path: envFile, override: false });
}

const COLLECTION_CITIES = "Cities";

const citySeeds: CitySeed[] = [
  { name: "Othón P. Blanco",        state: "Quintana Roo", active: true },
  { name: "Benito Juárez",           state: "Quintana Roo", active: true },
  { name: "Felipe Carrillo Puerto",  state: "Quintana Roo", active: true },
  { name: "Lázaro Cárdenas",         state: "Quintana Roo", active: true },
  { name: "Cozumel",                 state: "Quintana Roo", active: true },
  { name: "José María Morelos",      state: "Quintana Roo", active: true },
  { name: "Isla Mujeres",            state: "Quintana Roo", active: true },
  { name: "Solidaridad",             state: "Quintana Roo", active: true },
  { name: "Tulum",                   state: "Quintana Roo", active: true },
  { name: "Bacalar",                 state: "Quintana Roo", active: true },
  { name: "Puerto Morelos",          state: "Quintana Roo", active: true },
];

function hasArg(flag: string) {
  return process.argv.includes(flag);
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function initializeAdmin() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const adminProjectId     = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const publicProjectId    = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();

  if (serviceAccountJson) {
    const raw = JSON.parse(serviceAccountJson) as {
      project_id?: string; client_email?: string; private_key?: string;
    };
    const serviceAccount: ServiceAccount = {
      projectId:   raw.project_id,
      clientEmail: raw.client_email,
      privateKey:  raw.private_key,
    };
    return initializeApp({
      credential: cert(serviceAccount),
      projectId:  publicProjectId || adminProjectId || serviceAccount.projectId,
    });
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (adminProjectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId: adminProjectId, clientEmail, privateKey }),
      projectId:  adminProjectId,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId:  publicProjectId || adminProjectId || undefined,
  });
}

async function findExistingDocumentByName(name: string) {
  const db       = getFirestore();
  const snapshot = await db.collection(COLLECTION_CITIES).where("name", "==", name).get();
  if (snapshot.docs.length > 1) {
    throw new Error(`Multiple ${COLLECTION_CITIES} documents found for name: ${name}`);
  }
  return snapshot.docs[0] ?? null;
}

async function main() {
  const isDryRun = hasArg("--dry-run");

  getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  initializeAdmin();

  const db = getFirestore();

  console.log(
    `${isDryRun ? "[dry-run] " : ""}Seeding ${COLLECTION_CITIES} for project: ${getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID")}`
  );

  let created = 0;
  let updated = 0;

  for (const seed of citySeeds) {
    const existingDoc = await findExistingDocumentByName(seed.name);
    const targetRef   = existingDoc?.ref ?? db.collection(COLLECTION_CITIES).doc();
    const payload = {
      name:      seed.name,
      state:     seed.state,
      active:    seed.active,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!existingDoc) {
      created++;
      console.log(`create "${seed.name}" -> docId=${targetRef.id}`);
      if (!isDryRun) {
        await targetRef.set({ ...payload, createdAt: FieldValue.serverTimestamp() });
      }
    } else {
      updated++;
      console.log(`update "${seed.name}" -> docId=${targetRef.id}`);
      if (!isDryRun) {
        await targetRef.set(payload, { merge: true });
      }
    }
  }

  console.log(`\nsummary  created=${created}  updated=${updated}`);
}

main().catch((error) => {
  console.error("Seed failed.");
  if (error instanceof Error) console.error(error.message);
  else console.error(error);
  process.exit(1);
});
