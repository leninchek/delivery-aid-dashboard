import { config as loadDotenv } from 'dotenv';
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function main() {
  for (const f of [process.env.DOTENV_CONFIG_PATH, '.env.local', '.env']) {
    if (f) loadDotenv({ path: f, override: false });
  }

  if (getApps().length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    const adminProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
    const publicProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();

    if (serviceAccountJson) {
      const raw = JSON.parse(serviceAccountJson) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      const serviceAccount: ServiceAccount = {
        projectId: raw.project_id,
        clientEmail: raw.client_email,
        privateKey: raw.private_key,
      };
      initializeApp({
        credential: cert(serviceAccount),
        projectId: publicProjectId || adminProjectId || serviceAccount.projectId,
      });
    } else {
      initializeApp({
        credential: applicationDefault(),
        projectId: publicProjectId || adminProjectId || undefined,
      });
    }
  }

  const db = getFirestore();
  const users = await db.collection('SystemUsers').where('type', '==', 'app').where('active', '==', true).get();

  for (const u of users.docs) {
    const data = u.data() as { name?: string; email?: string; orgMemberId?: string };
    const orgMemberId = data.orgMemberId || '';
    let levelId = '';
    let levelName = '';
    let canView = false;

    if (orgMemberId) {
      const orgMember = await db.collection('OrgMembers').doc(orgMemberId).get();
      levelId = (orgMember.data()?.levelId as string) || '';
      if (levelId) {
        const level = await db.collection('OrgLevels').doc(levelId).get();
        const lvl = level.data() as { name?: string; capabilities?: string[] } | undefined;
        levelName = lvl?.name || '';
        const caps = Array.isArray(lvl?.capabilities) ? lvl?.capabilities : [];
        canView = caps.includes('can_view_own_promoted');
      }
    }

    console.log(`${data.name || '(sin nombre)'} <${data.email || 'sin-email'}> uid=${u.id}`);
    console.log(`  orgMemberId=${orgMemberId} levelId=${levelId} levelName=${levelName}`);
    console.log(`  can_view_own_promoted=${canView}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
