import { config as loadDotenv } from "dotenv";
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type AuthorityType = "delegate" | "sub_delegate" | "mayor" | "ejidal_commissioner";

type AuthoritySeed = {
  type: AuthorityType;
  name: string;
  phone: string;
  curp: string;
  birthDate: string;
};

const ENV_FILES = [process.env.DOTENV_CONFIG_PATH, ".env.local", ".env"].filter(
  (value): value is string => Boolean(value)
);

for (const envFile of ENV_FILES) {
  loadDotenv({ path: envFile, override: false });
}

const COLLECTION_AUTHORITIES = "Authorities";

const authoritySeeds: AuthoritySeed[] = [
  {
    type: "mayor",
    name: "Pedro Francisco Balam Dzul",
    phone: "9971000001",
    curp: "BADP680915HQRLDR01",
    birthDate: "1968-09-15",
  },
  {
    type: "delegate",
    name: "Juan Carlos García López",
    phone: "9971000002",
    curp: "GALJ800512HQRRCR02",
    birthDate: "1980-05-12",
  },
  {
    type: "sub_delegate",
    name: "María Elena Martínez Chan",
    phone: "9971000003",
    curp: "MACE750320MQRTLN03",
    birthDate: "1975-03-20",
  },
  {
    type: "ejidal_commissioner",
    name: "Rosa Isidra Poot Nah",
    phone: "9971000004",
    curp: "PONR720605MQRTSR04",
    birthDate: "1972-06-05",
  },
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

async function findExistingDocumentByCurp(curp: string) {
  const db       = getFirestore();
  const snapshot = await db.collection(COLLECTION_AUTHORITIES).where("curp", "==", curp).get();
  if (snapshot.docs.length > 1) {
    throw new Error(`Multiple ${COLLECTION_AUTHORITIES} documents found for CURP: ${curp}`);
  }
  return snapshot.docs[0] ?? null;
}

async function main() {
  const isDryRun = hasArg("--dry-run");

  getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  initializeAdmin();

  console.log(
    `${isDryRun ? "[dry-run] " : ""}Seeding ${COLLECTION_AUTHORITIES} for project: ${getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID")}\n`
  );

  let created = 0;
  let updated = 0;

  for (const seed of authoritySeeds) {
    const existingDoc = await findExistingDocumentByCurp(seed.curp);
    const targetRef   = existingDoc?.ref ?? getFirestore().collection(COLLECTION_AUTHORITIES).doc();
    const payload = {
      type:      seed.type,
      name:      seed.name,
      phone:     seed.phone,
      curp:      seed.curp,
      birthDate: seed.birthDate,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!existingDoc) {
      created++;
      console.log(`create "${seed.name}" (${seed.type}) -> docId=${targetRef.id}`);
      if (!isDryRun) {
        await targetRef.set({ ...payload, createdAt: FieldValue.serverTimestamp() });
      }
    } else {
      updated++;
      console.log(`update "${seed.name}" (${seed.type}) -> docId=${targetRef.id}`);
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
