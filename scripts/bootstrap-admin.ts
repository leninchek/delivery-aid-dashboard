import { config as loadDotenv } from "dotenv";
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const ENV_FILES = [process.env.DOTENV_CONFIG_PATH, ".env.local", ".env"].filter(
  (value): value is string => Boolean(value)
);

for (const envFile of ENV_FILES) {
  loadDotenv({ path: envFile, override: false });
}

const COLLECTION_SYSTEM_USERS = "SystemUsers";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasArg(flag: string) {
  return process.argv.some((a) => a === flag || a.startsWith(`${flag}=`));
}

function getArg(flag: string): string | undefined {
  const prefix = `${flag}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
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

  const email    = getArg("--email")    ?? process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = getArg("--password") ?? process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name     = getArg("--name")     ?? process.env.BOOTSTRAP_ADMIN_NAME;

  if (!email || !EMAIL_REGEX.test(email)) {
    throw new Error(
      'Falta un correo válido. Usa --email="admin@ejemplo.com" o la variable BOOTSTRAP_ADMIN_EMAIL.'
    );
  }
  if (!password || password.length < 6) {
    throw new Error(
      'Falta una contraseña de al menos 6 caracteres. Usa --password="..." o BOOTSTRAP_ADMIN_PASSWORD.'
    );
  }
  if (!name?.trim()) {
    throw new Error('Falta el nombre. Usa --name="..." o BOOTSTRAP_ADMIN_NAME.');
  }

  const projectId = getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  initializeAdmin();

  const auth = getAuth();
  const db   = getFirestore();

  console.log(`${isDryRun ? "[dry-run] " : ""}Bootstrap de admin Back Office — proyecto: ${projectId}`);
  console.log(`  email: ${email}`);
  console.log(`  name:  ${name.trim()}\n`);

  let uid = "<pendiente>";
  let authUserExists = false;

  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    authUserExists = true;
    console.log(`Ya existe una cuenta de Auth con este correo -> uid=${uid} (no se toca la contraseña)`);
  } catch (err: unknown) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
  }

  if (!authUserExists) {
    console.log(`${isDryRun ? "[dry-run] " : ""}create Auth user -> ${email}`);
    if (!isDryRun) {
      const created = await auth.createUser({ email, password, displayName: name.trim() });
      uid = created.uid;
    }
  }

  const payload = {
    email:          email.toLowerCase(),
    name:           name.trim(),
    type:           "backoffice",
    backofficeRole: "admin",
    active:         true,
    updatedAt:      FieldValue.serverTimestamp(),
  };

  console.log(`${isDryRun ? "[dry-run] " : ""}set ${COLLECTION_SYSTEM_USERS}/${uid} -> backofficeRole=admin, active=true`);

  if (!isDryRun) {
    const docRef      = db.collection(COLLECTION_SYSTEM_USERS).doc(uid);
    const existingDoc = await docRef.get();
    if (existingDoc.exists) {
      await docRef.set(payload, { merge: true });
    } else {
      await docRef.set({ ...payload, createdAt: FieldValue.serverTimestamp() });
    }
  }

  console.log(`\n${isDryRun ? "[dry-run] listo" : "Listo"}. Inicia sesión en el Back Office con: ${email}`);
}

main().catch((error) => {
  console.error("Bootstrap failed.");
  if (error instanceof Error) console.error(error.message);
  else console.error(error);
  process.exit(1);
});
