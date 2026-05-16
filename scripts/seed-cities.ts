import { config as loadDotenv } from "dotenv";
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
  {
    name: "Othón P. Blanco",
    state: "Quintana Roo",
    active: true,
  },
  {
    name: "Benito Juárez",
    state: "Quintana Roo",
    active: true,
  },
  {
    name: "Felipe Carrillo Puerto",
    state: "Quintana Roo",
    active: true,
  },
  {
    name: "Lázaro Cárdenas",
    state: "Quintana Roo",
    active: true,
  },
  {
    name: "Cozumel",
    state: "Quintana Roo",
    active: true,
  },
  {
    name: "José María Morelos",
    state: "Quintana Roo",
    active: true,
  },
  {
    name: "Isla Mujeres",
    state: "Quintana Roo",
    active: true,
  },
  {
    name: "Solidaridad",
    state: "Quintana Roo",
    active: true,
  },
  {
    name: "Tulum",
    state: "Quintana Roo",
    active: true,
  },
  {
    name: "Bacalar",
    state: "Quintana Roo",
    active: true,
  },
  {
    name: "Puerto Morelos",
    state: "Quintana Roo",
    active: true,
  },
];

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
    .collection(COLLECTION_CITIES)
    .where("name", "==", name)
    .get();

  return snapshot.docs[0];
}

async function seedCities() {
  initializeAdmin();

  const db = getFirestore();

  console.log("Starting cities seed...");
  console.log(`Collection: ${COLLECTION_CITIES}`);

  let skipped = 0;
  let added = 0;
  let failed = 0;

  for (const citySeed of citySeeds) {
    try {
      const existing = await findExistingDocumentByName(citySeed.name);

      if (existing) {
        console.log(`[SKIP] ${citySeed.name} already exists`);
        skipped++;
        continue;
      }

      await db.collection(COLLECTION_CITIES).add(citySeed);
      console.log(`[ADD] ${citySeed.name}`);
      added++;
    } catch (error) {
      console.error(`[ERROR] Failed to add ${citySeed.name}:`, error);
      failed++;
    }
  }

  console.log("\n✅ Seed completed!");
  console.log(`Total: ${citySeeds.length} | Added: ${added} | Skipped: ${skipped} | Failed: ${failed}`);

  return { added, skipped, failed };
}

if (require.main === module) {
  seedCities()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}

export { seedCities };
