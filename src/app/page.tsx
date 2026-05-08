"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { getFirestoreDb, getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";

type ActivityItem = {
  id: string;
  source: string;
  label: string;
  at: Date | null;
};

function parseTimestamp(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }

  return null;
}

function formatDate(value: Date | null): string {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default function Home() {
  const [orgLevelsCount, setOrgLevelsCount] = useState(0);
  const [aidTypesCount, setAidTypesCount] = useState(0);
  const [authoritiesCount, setAuthoritiesCount] = useState(0);
  const [citiesCount, setCitiesCount] = useState(0);
  const [communitiesCount, setCommunitiesCount] = useState(0);
  const [routesCount, setRoutesCount] = useState(0);
  const [orgMembersCount, setOrgMembersCount] = useState(0);
  const [activeOrgMembersCount, setActiveOrgMembersCount] = useState(0);
  const [appUsersCount, setAppUsersCount] = useState(0);
  const [activeAppUsersCount, setActiveAppUsersCount] = useState(0);
  const [pushCampaignsCount, setPushCampaignsCount] = useState(0);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = hasFirebaseConfig();
  const missingVars = getMissingFirebaseEnvVars();

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    const firestoreDb = getFirestoreDb();

    if (!firestoreDb) {
      setIsLoading(false);
      return;
    }

    const unsubscribers = [
      onSnapshot(
        collection(firestoreDb, "OrgLevels"),
        (snapshot) => setOrgLevelsCount(snapshot.size),
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        collection(firestoreDb, "AidTypes"),
        (snapshot) => setAidTypesCount(snapshot.size),
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        collection(firestoreDb, "Authorities"),
        (snapshot) => setAuthoritiesCount(snapshot.size),
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        collection(firestoreDb, "Cities"),
        (snapshot) => setCitiesCount(snapshot.size),
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        collection(firestoreDb, "Communities"),
        (snapshot) => setCommunitiesCount(snapshot.size),
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        collection(firestoreDb, "Routes"),
        (snapshot) => setRoutesCount(snapshot.size),
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        collection(firestoreDb, "OrgMembers"),
        (snapshot) => {
          setOrgMembersCount(snapshot.size);
          setActiveOrgMembersCount(
            snapshot.docs.filter((docItem) => docItem.get("active") ?? true).length
          );

          const items = snapshot.docs.map((docItem) => ({
            id: docItem.id,
            source: "OrgMembers",
            label: docItem.get("name") || "Miembro actualizado",
            at: parseTimestamp(docItem.get("updatedAt") || docItem.get("createdAt")),
          }));

          setActivityItems((current) => [
            ...current.filter((item) => item.source !== "OrgMembers"),
            ...items,
          ]);
        },
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        collection(firestoreDb, "SystemUsers"),
        (snapshot) => {
          const appUsers = snapshot.docs.filter((docItem) => docItem.get("type") === "app");
          setAppUsersCount(appUsers.length);
          setActiveAppUsersCount(
            appUsers.filter((docItem) => docItem.get("active") ?? true).length
          );

          const items = appUsers.map((docItem) => ({
            id: docItem.id,
            source: "SystemUsers",
            label: docItem.get("email") || docItem.id,
            at: parseTimestamp(docItem.get("updatedAt") || docItem.get("createdAt")),
          }));

          setActivityItems((current) => [
            ...current.filter((item) => item.source !== "SystemUsers"),
            ...items,
          ]);
        },
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        collection(firestoreDb, "PushCampaigns"),
        (snapshot) => {
          setPushCampaignsCount(snapshot.size);

          const items = snapshot.docs.map((docItem) => ({
            id: docItem.id,
            source: "PushCampaigns",
            label: docItem.get("title") || "Campana push",
            at: parseTimestamp(docItem.get("createdAt") || docItem.get("scheduledAt")),
          }));

          setActivityItems((current) => [
            ...current.filter((item) => item.source !== "PushCampaigns"),
            ...items,
          ]);
        },
        (snapshotError) => setError(snapshotError.message)
      ),
    ];

    setIsLoading(false);

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [isConfigured]);

  const recentActivity = useMemo(
    () =>
      [...activityItems]
        .sort((a, b) => {
          const atA = a.at ? a.at.getTime() : 0;
          const atB = b.at ? b.at.getTime() : 0;
          return atB - atA;
        })
        .slice(0, 8),
    [activityItems]
  );

  if (!isConfigured) {
    return <MissingConfigNotice missingVars={missingVars} />;
  }

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Panel de Control</h2>
        <p className="mt-2 text-sm text-slate-600">
          Resumen operativo del Back Office (MVP) con metricas en tiempo real.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Catalogos base</p>
          <p className="mt-2 text-3xl font-semibold">
            {orgLevelsCount + aidTypesCount + authoritiesCount + citiesCount + communitiesCount + routesCount}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            OrgLevels {orgLevelsCount} | AidTypes {aidTypesCount} | Authorities {authoritiesCount} | Cities {citiesCount} | Communities {communitiesCount} | Routes {routesCount}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">OrgMembers</p>
          <p className="mt-2 text-3xl font-semibold">{orgMembersCount}</p>
          <p className="mt-2 text-xs text-slate-600">Activos: {activeOrgMembersCount}</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Accesos App</p>
          <p className="mt-2 text-3xl font-semibold">{appUsersCount}</p>
          <p className="mt-2 text-xs text-slate-600">Activos: {activeAppUsersCount}</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Push Campaigns</p>
          <p className="mt-2 text-3xl font-semibold">{pushCampaignsCount}</p>
          <p className="mt-2 text-xs text-slate-600">MVP de campañas en progreso</p>
        </article>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Actividad reciente</h3>
          {isLoading ? <span className="text-xs text-slate-500">Cargando...</span> : null}
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <ul className="mt-4 divide-y divide-slate-200 text-sm">
          {recentActivity.map((item) => (
            <li key={`${item.source}-${item.id}`} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-500">{item.source}</p>
              </div>
              <p className="text-xs text-slate-500" suppressHydrationWarning>{formatDate(item.at)}</p>
            </li>
          ))}

          {recentActivity.length === 0 ? (
            <li className="py-6 text-center text-slate-500">
              Aun no hay actividad registrada.
            </li>
          ) : null}
        </ul>
      </article>
    </section>
  );
}
