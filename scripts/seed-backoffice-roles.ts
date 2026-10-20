import { config as loadDotenv } from "dotenv";
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type RoleSeed = {
  id:          string;
  name:        string;
  permissions: string[];
};

const ENV_FILES = [process.env.DOTENV_CONFIG_PATH, ".env.local", ".env"].filter(
  (value): value is string => Boolean(value)
);

for (const envFile of ENV_FILES) {
  loadDotenv({ path: envFile, override: false });
}

const COLLECTION_BACKOFFICE_ROLES = "BackofficeRoles";

// "admin" NO se incluye aquí — está hardcodeado en el sistema (SystemUsers.backofficeRole
// === "admin"), nunca es un documento de BackofficeRoles. Ver README "Roles y permisos".
const roleSeeds: RoleSeed[] = [
  {
    id:          "supervisor",
    name:        "Supervisor",
    // Igual que data_entry + reports: en el Back Office hay pocas personas, de
    // confianza, a diferencia de la App (más operativa). Supervisor puede hacer
    // todo lo operativo (captura, catálogos, reportes) -- la única diferencia
    // real con admin es que no configura el sistema (roles, cuentas BO, niveles
    // organizacionales, tipos de entrega, acceso App, campañas push).
    permissions: ["capture", "catalogs", "reports"],
  },
  {
    id:          "data_entry",
    name:        "Capturista",
    permissions: ["capture", "catalogs"],
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

async function main() {
  const isDryRun = hasArg("--dry-run");

  getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  initializeAdmin();

  const db = getFirestore();

  console.log(
    `${isDryRun ? "[dry-run] " : ""}Seeding ${COLLECTION_BACKOFFICE_ROLES} for project: ${getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID")}`
  );

  let created = 0;
  let updated = 0;

  for (const seed of roleSeeds) {
    const docRef      = db.collection(COLLECTION_BACKOFFICE_ROLES).doc(seed.id);
    const existingDoc = await docRef.get();
    const payload = {
      name:        seed.name,
      permissions: seed.permissions,
      protected:   true,
      updatedAt:   FieldValue.serverTimestamp(),
    };

    if (!existingDoc.exists) {
      created++;
      console.log(`create ${COLLECTION_BACKOFFICE_ROLES}/${seed.id} -> name="${seed.name}" permissions=[${seed.permissions.join(", ")}]`);
      if (!isDryRun) {
        await docRef.set({ ...payload, createdAt: FieldValue.serverTimestamp() });
      }
    } else {
      updated++;
      console.log(`update ${COLLECTION_BACKOFFICE_ROLES}/${seed.id} -> permissions=[${seed.permissions.join(", ")}]`);
      if (!isDryRun) {
        await docRef.set(payload, { merge: true });
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
