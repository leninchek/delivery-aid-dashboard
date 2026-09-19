import { config as loadDotenv } from "dotenv";
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type CommunitySeed = {
  name: string;
  active: boolean;
};

const ENV_FILES = [process.env.DOTENV_CONFIG_PATH, ".env.local", ".env"].filter(
  (value): value is string => Boolean(value)
);

for (const envFile of ENV_FILES) {
  loadDotenv({ path: envFile, override: false });
}

const COLLECTION_CITIES      = "Cities";
const COLLECTION_COMMUNITIES = "Communities";
const TARGET_CITY            = "Felipe Carrillo Puerto";

const communitySeeds: CommunitySeed[] = [
  { name: "Tihosuco",              active: true },
  { name: "Noh-Bec",               active: true },
  { name: "X-Hazil",               active: true },
  { name: "Señor",                 active: true },
  { name: "Chan Santa Cruz",       active: true },
  { name: "Uh-May",                active: true },
  { name: "Chancenote",            active: true },
  { name: "Peto",                  active: true },
  { name: "Felipe Carrillo Puerto", active: true },
  { name: "Sabán",                 active: true },
  { name: "Dziuché",               active: true },
  { name: "Tahdziú",               active: true },
  { name: "Xcháac",                active: true },
  { name: "Valladolid",            active: true },
  { name: "Chacchoben",            active: true },
  // Detectadas en catálogo "COMUNIDADES MPIO" (ROTOPLAS SUBSIDIO JUNIO 2025.xlsx).
  // Transcritas en Title Case tal como aparecen en la fuente (en mayúsculas, sin
  // acentos) — revisar ortografía/acentos antes de dar por definitivo el catálogo.
  { name: "Andres Q. Roo",             active: true },
  { name: "Asentamiento Ma. Elena",    active: true },
  { name: "Betania",                   active: true },
  { name: "Cantzepchen",               active: true },
  { name: "Cecilio Chi",               active: true },
  { name: "Chan Cah Derrepente",       active: true },
  { name: "Chan Che Comandante",       active: true },
  { name: "Chan Chen Chuc",            active: true },
  { name: "Chanka Veracruz",           active: true },
  { name: "Chumpon",                   active: true },
  { name: "Chumyaxche",                active: true },
  { name: "Chun-On",                   active: true },
  { name: "Chun-Yan",                  active: true },
  { name: "Chunhuas",                  active: true },
  { name: "Chunhuhub",                 active: true },
  { name: "Dzoyola",                   active: true },
  { name: "Dzula",                     active: true },
  { name: "Emiliano Zapata",           active: true },
  { name: "Filomeno Mata",             active: true },
  { name: "Francisco I. Madero",       active: true },
  { name: "Francisco May",             active: true },
  { name: "Hobompich",                 active: true },
  { name: "Ignacio Manuel A.",         active: true },
  { name: "Jose Ma. Pino Suarez",      active: true },
  { name: "Jose Ma. Pino Suarez Nte.", active: true },
  { name: "Kampokolche",               active: true },
  { name: "Kankabzonot",               active: true },
  { name: "Kopchen",                   active: true },
  { name: "La Noria",                  active: true },
  { name: "Laguna Kana",               active: true },
  { name: "Melchor Ocampo",            active: true },
  { name: "Mixtequilla",               active: true },
  { name: "Naranjal Poniente",         active: true },
  { name: "Noh-Kancab",                active: true },
  { name: "Noh Cah",                   active: true },
  { name: "Nueva Loria",               active: true },
  { name: "Nuevo Israel",              active: true },
  { name: "Petcacab",                  active: true },
  { name: "Polinkin",                  active: true },
  { name: "Polyuc",                    active: true },
  { name: "Presidente Juarez",         active: true },
  { name: "Punta Herrero",             active: true },
  { name: "Ramonal",                   active: true },
  { name: "Reforma Agraria",           active: true },
  { name: "Sahcab Chen",               active: true },
  { name: "San Andres",                active: true },
  { name: "San Antonio Norte",         active: true },
  { name: "San Antonio Nuevo C.",      active: true },
  { name: "San Antonio Señor",         active: true },
  { name: "San Bartolo",               active: true },
  { name: "San Felipe Berriozabal",    active: true },
  { name: "San Francisco Ake",         active: true },
  { name: "San Hipolito",              active: true },
  { name: "San Jose I",                active: true },
  { name: "San Jose II",               active: true },
  { name: "San Luis",                  active: true },
  { name: "San Ramon",                 active: true },
  { name: "San Silverio",              active: true },
  { name: "Santa Amalia",              active: true },
  { name: "Santa Isabel",              active: true },
  { name: "Santa Lucia",               active: true },
  { name: "Santa Maria Pte.",          active: true },
  { name: "Santa Rosa",                active: true },
  { name: "Tabi",                      active: true },
  { name: "Tac-Chivo",                 active: true },
  { name: "Tepich",                    active: true },
  { name: "Tixcacal Guardia",          active: true },
  { name: "Trapich",                   active: true },
  { name: "Tres Reyes",                active: true },
  { name: "Tusik",                     active: true },
  { name: "Tuzik Norte",               active: true },
  { name: "Tzucum",                    active: true },
  { name: "X-Conha",                   active: true },
  { name: "X-Hazil 1",                 active: true },
  { name: "X-Hazil Norte",             active: true },
  { name: "X-Hazil Sur",               active: true },
  { name: "X-Yatil",                   active: true },
  { name: "X-Pichil",                  active: true },
  { name: "Xaan",                      active: true },
  { name: "Yalchen",                   active: true },
  { name: "Yaxchechal",                active: true },
  { name: "Yaxley",                    active: true },
  { name: "Yoactun",                   active: true },
  { name: "Yodzonot Chico",            active: true },
  { name: "Yodzonot Nuevo",            active: true },
];

// No agregadas — requieren confirmación manual antes de incluirse:
//  - "ALCALDIA" y "DELEGACION": en la fuente aparecen como sede/edificio del
//    subdelegado, no como nombre de comunidad rural. Confirmar si corresponden
//    a "Felipe Carrillo Puerto" (cabecera municipal, ya en el catálogo) o si
//    son una comunidad real con ese nombre.

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

async function findCityByName(cityName: string) {
  const db       = getFirestore();
  const snapshot = await db.collection(COLLECTION_CITIES).where("name", "==", cityName).get();
  return snapshot.docs[0] ?? null;
}

async function findExistingDocumentByName(name: string) {
  const db       = getFirestore();
  const snapshot = await db.collection(COLLECTION_COMMUNITIES).where("name", "==", name).get();
  if (snapshot.docs.length > 1) {
    throw new Error(`Multiple ${COLLECTION_COMMUNITIES} documents found for name: ${name}`);
  }
  return snapshot.docs[0] ?? null;
}

async function main() {
  const isDryRun = hasArg("--dry-run");

  getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  initializeAdmin();

  const db = getFirestore();

  console.log(
    `${isDryRun ? "[dry-run] " : ""}Seeding ${COLLECTION_COMMUNITIES} for project: ${getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID")}`
  );
  console.log(`Prerequisite: city "${TARGET_CITY}" must exist (run seed:cities first).\n`);

  const cityDoc = await findCityByName(TARGET_CITY);
  if (!cityDoc) {
    if (!isDryRun) throw new Error(`City "${TARGET_CITY}" not found in ${COLLECTION_CITIES}. Run seed:cities first.`);
    console.log(`[dry-run] City "${TARGET_CITY}" not in Firestore — using placeholder ID for simulation.\n`);
  }

  const cityId = cityDoc?.id ?? `<${TARGET_CITY}>`;
  if (cityDoc) console.log(`Resolved city "${TARGET_CITY}" -> docId=${cityId}\n`);

  let created = 0;
  let updated = 0;

  for (const seed of communitySeeds) {
    const existingDoc = await findExistingDocumentByName(seed.name);
    const targetRef   = existingDoc?.ref ?? db.collection(COLLECTION_COMMUNITIES).doc();
    const payload = {
      name:      seed.name,
      cityId,
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
