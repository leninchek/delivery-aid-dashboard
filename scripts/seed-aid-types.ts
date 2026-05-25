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
  { name: "Despensa",               unit: "pieza",   active: true },
  { name: "Apoyo económico",        unit: "MXN",     active: true },
  { name: "Canasta navideña",       unit: "paquete", active: true },
  { name: "Pavo navideño",          unit: "pieza",   active: true },
  { name: "Juguete",                unit: "pieza",   active: true },
  { name: "Útiles escolares",       unit: "paquete", active: true },
  { name: "Mochila",                unit: "pieza",   active: true },
  { name: "Uniforme escolar",       unit: "paquete", active: true },
  { name: "Rotoplas",               unit: "pieza",   active: true },
  { name: "Lámina de zinc",         unit: "pieza",   active: true },
  { name: "Cemento",                unit: "pieza",   active: true },
  { name: "Cal",                    unit: "pieza",   active: true },
  { name: "Block",                  unit: "pieza",   active: true },
  { name: "Varilla",                unit: "pieza",   active: true },
  { name: "Triciclo",               unit: "pieza",   active: true },
  { name: "Bicicleta",              unit: "pieza",   active: true },
  { name: "Leche, pañales y otros", unit: "pieza",   active: true },
  { name: "Fruta y semilla",        unit: "pieza",   active: true },
  { name: "Fertilizante",           unit: "pieza",   active: true },
  { name: "Herramienta",            unit: "pieza",   active: true },
  { name: "Silla de ruedas",        unit: "pieza",   active: true },
  { name: "Muleta",                 unit: "pieza",   active: true },
  { name: "Colchón",                unit: "pieza",   active: true },
  { name: "Cobija",                 unit: "pieza",   active: true },
  { name: "Balón",                  unit: "pieza",   active: true },
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
  const snapshot = await db.collection(COLLECTION_AID_TYPES).where("name", "==", name).get();
  if (snapshot.docs.length > 1) {
    throw new Error(`Multiple ${COLLECTION_AID_TYPES} documents found for name: ${name}`);
  }
  return snapshot.docs[0] ?? null;
}

async function main() {
  const isDryRun = hasArg("--dry-run");

  getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  initializeAdmin();

  const db = getFirestore();

  console.log(
    `${isDryRun ? "[dry-run] " : ""}Seeding ${COLLECTION_AID_TYPES} for project: ${getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID")}`
  );

  let created = 0;
  let updated = 0;

  for (const seed of aidTypeSeeds) {
    const existingDoc = await findExistingDocumentByName(seed.name);
    const targetRef   = existingDoc?.ref ?? db.collection(COLLECTION_AID_TYPES).doc();
    const payload = {
      name:      seed.name,
      unit:      seed.unit,
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
