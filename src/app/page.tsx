"use client";

import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { getFirestoreDb, getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { parseTimestamp } from "@/lib/report-utils";

type DirectEntry = {
  id: string;
  createdAt: Date | null;
  fromOrgId: string;
  fromName: string;
};

type IndirectEntry = {
  id: string;
  createdAt: Date | null;
  registeredByUid: string;
};

type PromotedEntry = {
  id: string;
  createdAt: Date | null;
  name: string;
};

type CampaignEntry = {
  id: string;
  title: string;
  status: string;
  statsSent: number;
  statsTotal: number;
  createdAt: Date | null;
};

type ActivityItem = {
  id: string;
  source: string;
  label: string;
  at: Date | null;
};

function formatDate(value: Date | null): string {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

const SOURCE_LABELS: Record<string, string> = {
  DirectDeliveries: "Entrega directa",
  IndirectDeliveries: "Entrega indirecta",
  OrgMembers: "Miembro organizacional",
  PushCampaigns: "Campaña push",
};

export default function Home() {
  const isConfigured = hasFirebaseConfig();
  const missingVars = getMissingFirebaseEnvVars();

  const [orgMembersCount, setOrgMembersCount] = useState(0);
  const [activeOrgMembersCount, setActiveOrgMembersCount] = useState(0);
  const [orgMembersData, setOrgMembersData] = useState<Array<{ id: string; appUserId: string | null }>>([]);
  const [appUsersCount, setAppUsersCount] = useState(0);
  const [activeAppUsersCount, setActiveAppUsersCount] = useState(0);
  const [directEntries, setDirectEntries] = useState<DirectEntry[]>([]);
  const [indirectEntries, setIndirectEntries] = useState<IndirectEntry[]>([]);
  const [promotedEntries, setPromotedEntries] = useState<PromotedEntry[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignEntry[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { todayStart, weekStart, prevWeekStart, thirtyDaysAgo } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { todayStart, weekStart, prevWeekStart, thirtyDaysAgo };
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    const db = getFirestoreDb();
    if (!db) return;

    const cutoff = Timestamp.fromDate(thirtyDaysAgo);

    const unsubs = [
      onSnapshot(collection(db, "OrgMembers"), (snap) => {
        setOrgMembersCount(snap.size);
        setActiveOrgMembersCount(snap.docs.filter((d) => d.get("active") ?? true).length);
        setOrgMembersData(snap.docs.map((d) => ({
          id: d.id,
          appUserId: (d.get("appUserId") as string) || null,
        })));
        setActivityItems((prev) => [
          ...prev.filter((i) => i.source !== "OrgMembers"),
          ...snap.docs.map((d) => ({
            id: d.id,
            source: "OrgMembers",
            label: (d.get("name") as string) || "Miembro actualizado",
            at: parseTimestamp(d.get("updatedAt") ?? d.get("createdAt")),
          })),
        ]);
      }, (err) => setError(err.message)),

      onSnapshot(collection(db, "SystemUsers"), (snap) => {
        const appUsers = snap.docs.filter((d) => d.get("type") === "app");
        setAppUsersCount(appUsers.length);
        setActiveAppUsersCount(appUsers.filter((d) => d.get("active") ?? true).length);
      }, (err) => setError(err.message)),

      onSnapshot(
        query(collection(db, "DirectDeliveries"), where("createdAt", ">=", cutoff)),
        (snap) => {
          const entries: DirectEntry[] = snap.docs.map((d) => ({
            id: d.id,
            createdAt: parseTimestamp(d.get("createdAt")),
            fromOrgId: (d.get("fromOrgId") as string) || (d.get("orgMemberId") as string) || "",
            fromName: (d.get("fromName") as string) || "Activista",
          }));
          setDirectEntries(entries);
          setActivityItems((prev) => [
            ...prev.filter((i) => i.source !== "DirectDeliveries"),
            ...entries.map((e) => ({
              id: e.id,
              source: "DirectDeliveries",
              label: `Entrega directa — ${e.fromName}`,
              at: e.createdAt,
            })),
          ]);
        },
        (err) => setError(err.message),
      ),

      onSnapshot(
        query(collection(db, "IndirectDeliveries"), where("createdAt", ">=", cutoff)),
        (snap) => {
          const entries: IndirectEntry[] = snap.docs.map((d) => ({
            id: d.id,
            createdAt: parseTimestamp(d.get("createdAt")),
            registeredByUid: (d.get("registeredBy") as string) || "",
          }));
          setIndirectEntries(entries);
          setActivityItems((prev) => [
            ...prev.filter((i) => i.source !== "IndirectDeliveries"),
            ...entries.map((e) => ({
              id: e.id,
              source: "IndirectDeliveries",
              label: "Entrega indirecta",
              at: e.createdAt,
            })),
          ]);
        },
        (err) => setError(err.message),
      ),

      onSnapshot(
        query(collection(db, "Promoted"), where("createdAt", ">=", cutoff)),
        (snap) => {
          setPromotedEntries(
            snap.docs.map((d) => ({
              id: d.id,
              createdAt: parseTimestamp(d.get("createdAt")),
              name: (d.get("name") as string) || "Promovido",
            })),
          );
        },
        (err) => setError(err.message),
      ),

      onSnapshot(collection(db, "PushCampaigns"), (snap) => {
        setCampaigns(
          snap.docs.map((d) => ({
            id: d.id,
            title: (d.get("title") as string) || "Campaña",
            status: (d.get("status") as string) || "draft",
            statsSent: (d.get("stats.sent") as number) || 0,
            statsTotal: (d.get("stats.total") as number) || 0,
            createdAt: parseTimestamp(d.get("createdAt")),
          })),
        );
        setActivityItems((prev) => [
          ...prev.filter((i) => i.source !== "PushCampaigns"),
          ...snap.docs.map((d) => ({
            id: d.id,
            source: "PushCampaigns",
            label: (d.get("title") as string) || "Campaña push",
            at: parseTimestamp(d.get("createdAt")),
          })),
        ]);
      }, (err) => setError(err.message)),
    ];

    return () => unsubs.forEach((u) => u());
  }, [isConfigured, thirtyDaysAgo]);

  const uidToMemberId = useMemo(
    () => new Map(orgMembersData.filter((m) => m.appUserId).map((m) => [m.appUserId!, m.id])),
    [orgMembersData],
  );

  // ── Computed operational metrics ──────────────────────────────────────────
  const directToday = useMemo(
    () => directEntries.filter((d) => d.createdAt && d.createdAt >= todayStart).length,
    [directEntries, todayStart],
  );
  const directThisWeek = useMemo(
    () => directEntries.filter((d) => d.createdAt && d.createdAt >= weekStart).length,
    [directEntries, weekStart],
  );
  const indirectThisWeek = useMemo(
    () => indirectEntries.filter((d) => d.createdAt && d.createdAt >= weekStart).length,
    [indirectEntries, weekStart],
  );
  const promotedThisWeek = useMemo(
    () => promotedEntries.filter((p) => p.createdAt && p.createdAt >= weekStart).length,
    [promotedEntries, weekStart],
  );
  const activeActivistsThisWeek = useMemo(() => {
    const ids = new Set<string>();
    directEntries
      .filter((d) => d.createdAt && d.createdAt >= weekStart && d.fromOrgId)
      .forEach((d) => ids.add(d.fromOrgId));
    indirectEntries
      .filter((d) => d.createdAt && d.createdAt >= weekStart && d.registeredByUid)
      .forEach((d) => {
        const memberId = uidToMemberId.get(d.registeredByUid);
        if (memberId) ids.add(memberId);
      });
    return ids.size;
  }, [directEntries, indirectEntries, weekStart, uidToMemberId]);

  const directPrevWeek = useMemo(
    () => directEntries.filter((d) => d.createdAt && d.createdAt >= prevWeekStart && d.createdAt < weekStart).length,
    [directEntries, prevWeekStart, weekStart],
  );
  const indirectPrevWeek = useMemo(
    () => indirectEntries.filter((d) => d.createdAt && d.createdAt >= prevWeekStart && d.createdAt < weekStart).length,
    [indirectEntries, prevWeekStart, weekStart],
  );
  const promotedPrevWeek = useMemo(
    () => promotedEntries.filter((p) => p.createdAt && p.createdAt >= prevWeekStart && p.createdAt < weekStart).length,
    [promotedEntries, prevWeekStart, weekStart],
  );
  const activeActivistsPrevWeek = useMemo(() => {
    const ids = new Set<string>();
    directEntries
      .filter((d) => d.createdAt && d.createdAt >= prevWeekStart && d.createdAt < weekStart && d.fromOrgId)
      .forEach((d) => ids.add(d.fromOrgId));
    indirectEntries
      .filter((d) => d.createdAt && d.createdAt >= prevWeekStart && d.createdAt < weekStart && d.registeredByUid)
      .forEach((d) => {
        const memberId = uidToMemberId.get(d.registeredByUid);
        if (memberId) ids.add(memberId);
      });
    return ids.size;
  }, [directEntries, indirectEntries, prevWeekStart, weekStart, uidToMemberId]);

  const pushReachRate = useMemo(() => {
    const sent = campaigns.filter(
      (c) => c.status === "sent" || c.status === "partial_failed",
    );
    const totalSent = sent.reduce((acc, c) => acc + c.statsSent, 0);
    const totalTargeted = sent.reduce((acc, c) => acc + c.statsTotal, 0);
    if (totalTargeted === 0) return null;
    return Math.round((totalSent / totalTargeted) * 100);
  }, [campaigns]);

  const sentCampaignsCount = useMemo(
    () =>
      campaigns.filter((c) => c.status === "sent" || c.status === "partial_failed").length,
    [campaigns],
  );

  const recentActivity = useMemo(
    () =>
      [...activityItems]
        .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
        .slice(0, 10),
    [activityItems],
  );

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Panel de Control</h2>
        <p className="mt-2 text-sm text-slate-600">
          Métricas operativas en tiempo real — últimos 30 días.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {/* ── Operación ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Operación
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Entregas directas"
            primary={directThisWeek}
            primarySub="esta semana"
            secondary={`${directToday} hoy · ${directEntries.length} en 30 días`}
            color="blue"
            trend={computeTrend(directThisWeek, directPrevWeek)}
          />
          <KpiCard
            label="Entregas indirectas"
            primary={indirectThisWeek}
            primarySub="esta semana"
            secondary={`${indirectEntries.length} en 30 días`}
            color="violet"
            trend={computeTrend(indirectThisWeek, indirectPrevWeek)}
          />
          <KpiCard
            label="Promovidos registrados"
            primary={promotedThisWeek}
            primarySub="esta semana"
            secondary={`${promotedEntries.length} en 30 días`}
            color="emerald"
            trend={computeTrend(promotedThisWeek, promotedPrevWeek)}
          />
          <KpiCard
            label="Activistas activos"
            primary={activeActivistsThisWeek}
            primarySub="esta semana"
            secondary={`de ${activeOrgMembersCount} miembros activos`}
            color="amber"
            trend={computeTrend(activeActivistsThisWeek, activeActivistsPrevWeek)}
          />
        </div>
      </div>

      {/* ── Estructura ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Estructura
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Miembros org."
            primary={activeOrgMembersCount}
            primarySub="activos"
            secondary={`${orgMembersCount} total`}
          />
          <KpiCard
            label="Usuarios app"
            primary={activeAppUsersCount}
            primarySub="activos"
            secondary={`${appUsersCount} registrados`}
          />
          <KpiCard
            label="Alcance push"
            primary={pushReachRate !== null ? `${pushReachRate}%` : "—"}
            primarySub={pushReachRate !== null ? "entregado" : "sin campañas"}
            secondary={`${sentCampaignsCount} campañas enviadas`}
          />
          <KpiCard
            label="Campañas push"
            primary={campaigns.length}
            primarySub="registradas"
            secondary={`${sentCampaignsCount} enviadas`}
          />
        </div>
      </div>

      {/* ── Actividad reciente ────────────────────────────────────────────── */}
      <article className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold">Actividad reciente</h3>
        <p className="mt-1 text-sm text-slate-500">
          Últimos eventos registrados en el sistema.
        </p>
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {recentActivity.map((item) => (
            <li
              key={`${item.source}-${item.id}`}
              className="flex items-center justify-between py-3"
            >
              <div>
                <p className="font-medium text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-400">
                  {SOURCE_LABELS[item.source] ?? item.source}
                </p>
              </div>
              <p className="shrink-0 pl-4 text-xs text-slate-400" suppressHydrationWarning>
                {formatDate(item.at)}
              </p>
            </li>
          ))}
          {recentActivity.length === 0 && (
            <li className="py-8 text-center text-slate-400">
              Sin actividad registrada.
            </li>
          )}
        </ul>
      </article>
    </section>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeTrend(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

type KpiColor = "blue" | "violet" | "emerald" | "amber";

const colorMap: Record<KpiColor, { card: string; number: string }> = {
  blue:    { card: "border-blue-100 bg-blue-50",    number: "text-blue-700" },
  violet:  { card: "border-violet-100 bg-violet-50", number: "text-violet-700" },
  emerald: { card: "border-emerald-100 bg-emerald-50", number: "text-emerald-700" },
  amber:   { card: "border-amber-100 bg-amber-50",  number: "text-amber-700" },
};

function KpiCard({
  label,
  primary,
  primarySub,
  secondary,
  color,
  trend,
}: {
  label: string;
  primary: number | string;
  primarySub: string;
  secondary: string;
  color?: KpiColor;
  trend?: number | null;
}) {
  const styles = color ? colorMap[color] : { card: "border-slate-200 bg-white", number: "text-slate-900" };
  return (
    <article className={`rounded-xl border p-5 ${styles.card}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${styles.number}`}>{primary}</p>
      <p className="mt-0.5 text-xs text-slate-500">{primarySub}</p>
      {trend != null ? (
        <p className={`mt-2 text-xs font-semibold ${trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {trend >= 0 ? `↑ +${trend}%` : `↓ ${Math.abs(trend)}%`} vs. sem. anterior
        </p>
      ) : null}
      <p className="mt-1 text-xs text-slate-400">{secondary}</p>
    </article>
  );
}
