import { config as loadDotenv } from "dotenv";
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type MemberSeed = {
  name: string;
  phone: string;       // unique key for deduplication across runs
  curp: string;
  birthDate: string;   // "YYYY-MM-DD" — stored as String, no timezone issues
  levelName: string;   // resolved to levelId at runtime via OrgLevels collection
  parentPhone: string | null; // resolved to parentId + path at runtime
  active: boolean;
};

const ENV_FILES = [process.env.DOTENV_CONFIG_PATH, ".env.local", ".env"].filter(
  (value): value is string => Boolean(value)
);

for (const envFile of ENV_FILES) {
  loadDotenv({ path: envFile, override: false });
}

const COLLECTION_ORG_MEMBERS = "OrgMembers";
const COLLECTION_ORG_LEVELS  = "OrgLevels";

// ── Hierarchy ─────────────────────────────────────────────────────────────────
//
//   Coordinador General
//   ├── Distrital Norte   (María López Torres)
//   │   └── Coordinador   (Ana García Pérez)
//   │       ├── Seccional (Laura Flores Jiménez)
//   │       └── Seccional (Pedro Ramírez Cruz)
//   └── Distrital Sur     (Roberto Castillo Vega)
//       └── Coordinador   (Juan Hernández Morales)
//           ├── Seccional (Sofía Martínez Guerrero)
//           └── Seccional (Alejandro Torres Sánchez)
//
// Activistas are intentionally excluded — create them manually.
// Order matters: each entry must appear after its parent.
// ─────────────────────────────────────────────────────────────────────────────

const memberSeeds: MemberSeed[] = [
  // ── Coordinador General ────────────────────────────────────────────────────
  {
    name:        "Carlos Mendoza Ruiz",
    phone:       "5500000001",
    curp:        "MERC750315HQRNDZ07",
    birthDate:   "1975-03-15",
    levelName:   "Coordinador General",
    parentPhone: null,
    active:      true,
  },

  // ── Distritales ───────────────────────────────────────────────────────────
  {
    name:        "María López Torres",
    phone:       "5500000002",
    curp:        "LOTM820722MQRPRZ06",
    birthDate:   "1982-07-22",
    levelName:   "Distrital",
    parentPhone: "5500000001",
    active:      true,
  },
  {
    name:        "Roberto Castillo Vega",
    phone:       "5500000003",
    curp:        "CAVR781108HQRSTL02",
    birthDate:   "1978-11-08",
    levelName:   "Distrital",
    parentPhone: "5500000001",
    active:      true,
  },

  // ── Coordinadores ─────────────────────────────────────────────────────────
  {
    name:        "Ana García Pérez",
    phone:       "5500000004",
    curp:        "GAPA900530MQRRCP04",
    birthDate:   "1990-05-30",
    levelName:   "Coordinador",
    parentPhone: "5500000002",
    active:      true,
  },
  {
    name:        "Juan Hernández Morales",
    phone:       "5500000005",
    curp:        "HEMJ850914HQRRNL08",
    birthDate:   "1985-09-14",
    levelName:   "Coordinador",
    parentPhone: "5500000003",
    active:      true,
  },

  // ── Seccionales ───────────────────────────────────────────────────────────
  {
    name:        "Laura Flores Jiménez",
    phone:       "5500000006",
    curp:        "FOLJ950218MQRLRM03",
    birthDate:   "1995-02-18",
    levelName:   "Seccional",
    parentPhone: "5500000004",
    active:      true,
  },
  {
    name:        "Pedro Ramírez Cruz",
    phone:       "5500000007",
    curp:        "RACP930825HQRMRZ09",
    birthDate:   "1993-08-25",
    levelName:   "Seccional",
    parentPhone: "5500000004",
    active:      true,
  },
  {
    name:        "Sofía Martínez Guerrero",
    phone:       "5500000008",
    curp:        "MAGS971203MQRRTR05",
    birthDate:   "1997-12-03",
    levelName:   "Seccional",
    parentPhone: "5500000005",
    active:      true,
  },
  {
    name:        "Alejandro Torres Sánchez",
    phone:       "5500000009",
    curp:        "TOSA910417HQRRSN01",
    birthDate:   "1991-04-17",
    levelName:   "Seccional",
    parentPhone: "5500000005",
    active:      true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function loadOrgLevelsByName(): Promise<Map<string, string>> {
  const db       = getFirestore();
  const snapshot = await db.collection(COLLECTION_ORG_LEVELS).get();
  const map      = new Map<string, string>();
  for (const doc of snapshot.docs) {
    const name = doc.get("name") as string | undefined;
    if (name) map.set(name, doc.id);
  }
  return map;
}

async function findMemberByPhone(phone: string) {
  const db       = getFirestore();
  const snapshot = await db
    .collection(COLLECTION_ORG_MEMBERS)
    .where("phone", "==", phone)
    .get();
  if (snapshot.docs.length > 1) {
    throw new Error(`Multiple ${COLLECTION_ORG_MEMBERS} documents found for phone: ${phone}`);
  }
  return snapshot.docs[0] ?? null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = hasArg("--dry-run");

  getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  initializeAdmin();

  const db = getFirestore();

  console.log(
    `${isDryRun ? "[dry-run] " : ""}Seeding ${COLLECTION_ORG_MEMBERS} for project: ${getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID")}`
  );
  console.log("Prerequisite: run seed:org-levels first so level IDs can be resolved.\n");

  const levelsByName = await loadOrgLevelsByName();

  if (levelsByName.size === 0) {
    if (!isDryRun) throw new Error("No OrgLevels found. Run `npm run seed:org-levels` first.");
    console.log("[dry-run] No OrgLevels in Firestore — using placeholder IDs for simulation.\n");
    for (const seed of memberSeeds) {
      if (!levelsByName.has(seed.levelName)) {
        levelsByName.set(seed.levelName, `<${seed.levelName}>`);
      }
    }
  }

  // phone → { id, path } — populated as members are created/found, top-down
  const runtime = new Map<string, { id: string; path: string[] }>();

  let created = 0;
  let updated = 0;
  let failed  = 0;

  for (const seed of memberSeeds) {
    try {
      const levelId = levelsByName.get(seed.levelName);
      if (!levelId) {
        console.error(`[ERROR] OrgLevel not found: "${seed.levelName}" — skipping "${seed.name}"`);
        failed++;
        continue;
      }

      let parentId: string | null   = null;
      let parentPath: string[]      = [];

      if (seed.parentPhone !== null) {
        const parentEntry = runtime.get(seed.parentPhone);
        if (!parentEntry) {
          console.error(
            `[ERROR] Parent (phone=${seed.parentPhone}) not resolved yet — skipping "${seed.name}". Check that the parent entry appears earlier in memberSeeds.`
          );
          failed++;
          continue;
        }
        parentId   = parentEntry.id;
        parentPath = parentEntry.path;
      }

      const memberPath  = parentId ? [...parentPath, parentId] : [];
      const existingDoc = await findMemberByPhone(seed.phone);
      const targetRef   = existingDoc?.ref ?? db.collection(COLLECTION_ORG_MEMBERS).doc();

      const payload = {
        name:       seed.name,
        phone:      seed.phone,
        curp:       seed.curp,
        birthDate:  seed.birthDate,
        levelId,
        parentId,
        path:       memberPath,
        assignment: { cityId: null, communityId: null, routeId: null },
        appUserId:  null,
        active:     seed.active,
        updatedAt:  FieldValue.serverTimestamp(),
      };

      if (!existingDoc) {
        created++;
        console.log(`create "${seed.name}" (${seed.levelName}) -> docId=${targetRef.id}`);
        if (!isDryRun) {
          await targetRef.set({ ...payload, createdAt: FieldValue.serverTimestamp() });
        }
      } else {
        updated++;
        console.log(`update "${seed.name}" (${seed.levelName}) -> docId=${targetRef.id}`);
        if (!isDryRun) {
          await targetRef.set(payload, { merge: true });
        }
      }

      // Always register in runtime so children can resolve this member as parent
      runtime.set(seed.phone, { id: targetRef.id, path: memberPath });

    } catch (error) {
      failed++;
      console.error(
        `[ERROR] Failed to process "${seed.name}":`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log(`\nsummary  created=${created}  updated=${updated}  failed=${failed}`);
}

main().catch((error) => {
  console.error("Seed failed.");
  if (error instanceof Error) console.error(error.message);
  else console.error(error);
  process.exit(1);
});
