import { config as loadDotenv } from "dotenv";
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type CommunitySeed = {
  name: string;
  cityId: string;
  active: boolean;
};

const ENV_FILES = [process.env.DOTENV_CONFIG_PATH, ".env.local", ".env"].filter(
  (value): value is string => Boolean(value)
);

for (const envFile of ENV_FILES) {
  loadDotenv({ path: envFile, override: false });
}

const COLLECTION_CITIES = "Cities";
const COLLECTION_COMMUNITIES = "Communities";
const TARGET_CITY = "Felipe Carrillo Puerto";

const communitySeeds: Omit<CommunitySeed, "cityId">[] = [
  // Comunidades principales
  {
    name: "Tihosuco",
    active: true,
  },
  {
    name: "Noh-Bec",
    active: true,
  },
  {
    name: "X-Hazil",
    active: true,
  },
  {
    name: "Señor",
    active: true,
  },
  {
    name: "Chan Santa Cruz",
    active: true,
  },
  {
    name: "Uh-May",
    active: true,
  },
  {
    name: "Chancenote",
    active: true,
  },
  {
    name: "Peto",
    active: true,
  },
  {
    name: "Felipe Carrillo Puerto",
    active: true,
  },
  {
    name: "Sabán",
    active: true,
  },
  {
    name: "Dziuché",
    active: true,
  },
  {
    name: "Tahdziú",
    active: true,
  },
  {
    name: "Xcháac",
    active: true,
  },
  {
    name: "Valladolid",
    active: true,
  },
  {
    name: "Chacchoben",
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

async function findCityByName(cityName: string) {
  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTION_CITIES)
    .where("name", "==", cityName)
    .get();

  return snapshot.docs[0];
}

async function findExistingDocumentByName(name: string) {
  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTION_COMMUNITIES)
    .where("name", "==", name)
    .get();

  return snapshot.docs[0];
}

async function seedCommunities() {
  initializeAdmin();

  const db = getFirestore();

  console.log("Starting communities seed...");
  console.log(`Collection: ${COLLECTION_COMMUNITIES}`);
  console.log(`Finding city: ${TARGET_CITY}...`);

  // Find the city first
  const cityDoc = await findCityByName(TARGET_CITY);
  if (!cityDoc) {
    throw new Error(`City "${TARGET_CITY}" not found in ${COLLECTION_CITIES}. Please run seed:cities first.`);
  }

  const cityId = cityDoc.id;
  console.log(`✓ Found city ID: ${cityId}\n`);

  let skipped = 0;
  let added = 0;
  let failed = 0;

  for (const communitySeed of communitySeeds) {
    try {
      const existing = await findExistingDocumentByName(communitySeed.name);

      if (existing) {
        console.log(`[SKIP] ${communitySeed.name} already exists`);
        skipped++;
        continue;
      }

      const communityWithCity: CommunitySeed = {
        ...communitySeed,
        cityId,
      };

      await db.collection(COLLECTION_COMMUNITIES).add(communityWithCity);
      console.log(`[ADD] ${communitySeed.name}`);
      added++;
    } catch (error) {
      console.error(`[ERROR] Failed to add ${communitySeed.name}:`, error);
      failed++;
    }
  }

  console.log("\n✅ Seed completed!");
  console.log(`Total: ${communitySeeds.length} | Added: ${added} | Skipped: ${skipped} | Failed: ${failed}`);

  return { added, skipped, failed };
}

if (require.main === module) {
  seedCommunities()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}

export { seedCommunities };
