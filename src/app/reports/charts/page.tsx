"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { collection, onSnapshot, query, Timestamp, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { getFirestoreDb } from "@/lib/firebase";
import { parseTimestamp } from "@/lib/report-utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type DirectEntry    = { id: string; createdAt: Date | null; fromOrgId: string; aidTypeId: string };
type IndirectEntry  = { id: string; createdAt: Date | null; orgMemberId: string; aidTypeId: string };
type PromotedEntry  = { id: string; createdAt: Date | null };
type CampaignEntry  = { id: string; status: string; statsSent: number; statsTotal: number };
type AidTypeEntry   = { id: string; name: string };
type MemberEntry    = { id: string; communityId: string | null };
type CommunityEntry = { id: string; name: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#f97316", "#84cc16"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDays(count: number): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (count - 1 - i));
    return d;
  });
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function computeTrend(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChartsPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars  = getMissingFirebaseEnvVars();

  const [directEntries,         setDirectEntries]         = useState<DirectEntry[]>([]);
  const [indirectEntries,       setIndirectEntries]       = useState<IndirectEntry[]>([]);
  const [promotedEntries,       setPromotedEntries]       = useState<PromotedEntry[]>([]);
  const [campaigns,             setCampaigns]             = useState<CampaignEntry[]>([]);
  const [aidTypes,              setAidTypes]              = useState<AidTypeEntry[]>([]);
  const [orgMembers,            setOrgMembers]            = useState<MemberEntry[]>([]);
  const [communities,           setCommunities]           = useState<CommunityEntry[]>([]);
  const [orgMembersCount,       setOrgMembersCount]       = useState(0);
  const [activeOrgMembersCount, setActiveOrgMembersCount] = useState(0);
  const [appUsersCount,         setAppUsersCount]         = useState(0);
  const [activeAppUsersCount,   setActiveAppUsersCount]   = useState(0);
  const [error,                 setError]                 = useState<string | null>(null);

  const { todayStart, weekStart, prevWeekStart, thirtyDaysAgo, days } = useMemo(() => {
    const now = new Date();
    const todayStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart     = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const prevWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { todayStart, weekStart, prevWeekStart, thirtyDaysAgo, days: buildDays(14) };
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    const db = getFirestoreDb();
    if (!db) return;

    const cutoff = Timestamp.fromDate(thirtyDaysAgo);

    const unsubs = [
      onSnapshot(
        query(collection(db, "DirectDeliveries"), where("createdAt", ">=", cutoff)),
        (snap) => setDirectEntries(snap.docs.map((d) => ({
          id:        d.id,
          createdAt: parseTimestamp(d.get("createdAt")),
          fromOrgId: (d.get("fromOrgId") as string) || (d.get("orgMemberId") as string) || "",
          aidTypeId: (d.get("aidTypeId") as string) || "",
        }))),
        (err) => setError(err.message),
      ),

      onSnapshot(
        query(collection(db, "IndirectDeliveries"), where("createdAt", ">=", cutoff)),
        (snap) => setIndirectEntries(snap.docs.map((d) => ({
          id:          d.id,
          createdAt:   parseTimestamp(d.get("createdAt")),
          orgMemberId: (d.get("orgMemberId") as string) || "",
          aidTypeId:   (d.get("aidTypeId") as string) || "",
        }))),
        (err) => setError(err.message),
      ),

      onSnapshot(
        query(collection(db, "Promoted"), where("createdAt", ">=", cutoff)),
        (snap) => setPromotedEntries(snap.docs.map((d) => ({
          id:        d.id,
          createdAt: parseTimestamp(d.get("createdAt")),
        }))),
        (err) => setError(err.message),
      ),

      onSnapshot(
        collection(db, "PushCampaigns"),
        (snap) => setCampaigns(snap.docs.map((d) => ({
          id:         d.id,
          status:     (d.get("status") as string) || "draft",
          statsSent:  (d.get("stats.sent")  as number) || 0,
          statsTotal: (d.get("stats.total") as number) || 0,
        }))),
        (err) => setError(err.message),
      ),

      onSnapshot(
        collection(db, "AidTypes"),
        (snap) => setAidTypes(snap.docs.map((d) => ({
          id:   d.id,
          name: (d.get("name") as string) || d.id,
        }))),
        (err) => setError(err.message),
      ),

      onSnapshot(
        collection(db, "OrgMembers"),
        (snap) => {
          setOrgMembersCount(snap.size);
          setActiveOrgMembersCount(snap.docs.filter((d) => d.get("active") ?? true).length);
          setOrgMembers(snap.docs.map((d) => ({
            id:          d.id,
            communityId: ((d.get("assignment") as Record<string, unknown> | null)?.communityId as string | null) ?? null,
          })));
        },
        (err) => setError(err.message),
      ),

      onSnapshot(
        collection(db, "Communities"),
        (snap) => setCommunities(snap.docs.map((d) => ({
          id:   d.id,
          name: (d.get("name") as string) || d.id,
        }))),
        (err) => setError(err.message),
      ),

      onSnapshot(
        collection(db, "SystemUsers"),
        (snap) => {
          const appUsers = snap.docs.filter((d) => d.get("type") === "app");
          setAppUsersCount(appUsers.length);
          setActiveAppUsersCount(appUsers.filter((d) => d.get("active") ?? true).length);
        },
        (err) => setError(err.message),
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [isConfigured, thirtyDaysAgo]);

  // ── KPI computations ──────────────────────────────────────────────────────

  const directToday      = useMemo(() => directEntries.filter((d) => d.createdAt && d.createdAt >= todayStart).length,      [directEntries, todayStart]);
  const directThisWeek   = useMemo(() => directEntries.filter((d) => d.createdAt && d.createdAt >= weekStart).length,        [directEntries, weekStart]);
  const directPrevWeek   = useMemo(() => directEntries.filter((d) => d.createdAt && d.createdAt >= prevWeekStart && d.createdAt < weekStart).length, [directEntries, prevWeekStart, weekStart]);
  const indirectThisWeek = useMemo(() => indirectEntries.filter((d) => d.createdAt && d.createdAt >= weekStart).length,      [indirectEntries, weekStart]);
  const indirectPrevWeek = useMemo(() => indirectEntries.filter((d) => d.createdAt && d.createdAt >= prevWeekStart && d.createdAt < weekStart).length, [indirectEntries, prevWeekStart, weekStart]);
  const promotedThisWeek = useMemo(() => promotedEntries.filter((p) => p.createdAt && p.createdAt >= weekStart).length,      [promotedEntries, weekStart]);
  const promotedPrevWeek = useMemo(() => promotedEntries.filter((p) => p.createdAt && p.createdAt >= prevWeekStart && p.createdAt < weekStart).length, [promotedEntries, prevWeekStart, weekStart]);

  const activeActivistsThisWeek = useMemo(() => {
    const ids = new Set<string>();
    directEntries.filter((d) => d.createdAt && d.createdAt >= weekStart && d.fromOrgId).forEach((d) => ids.add(d.fromOrgId));
    indirectEntries.filter((d) => d.createdAt && d.createdAt >= weekStart && d.orgMemberId).forEach((d) => ids.add(d.orgMemberId));
    return ids.size;
  }, [directEntries, indirectEntries, weekStart]);

  const activeActivistsPrevWeek = useMemo(() => {
    const ids = new Set<string>();
    directEntries.filter((d) => d.createdAt && d.createdAt >= prevWeekStart && d.createdAt < weekStart && d.fromOrgId).forEach((d) => ids.add(d.fromOrgId));
    indirectEntries.filter((d) => d.createdAt && d.createdAt >= prevWeekStart && d.createdAt < weekStart && d.orgMemberId).forEach((d) => ids.add(d.orgMemberId));
    return ids.size;
  }, [directEntries, indirectEntries, prevWeekStart, weekStart]);

  const pushReachRate = useMemo(() => {
    const sent = campaigns.filter((c) => c.status === "sent" || c.status === "partial_failed");
    const totalSent     = sent.reduce((acc, c) => acc + c.statsSent,  0);
    const totalTargeted = sent.reduce((acc, c) => acc + c.statsTotal, 0);
    if (totalTargeted === 0) return null;
    return Math.round((totalSent / totalTargeted) * 100);
  }, [campaigns]);

  const sentCampaignsCount = useMemo(
    () => campaigns.filter((c) => c.status === "sent" || c.status === "partial_failed").length,
    [campaigns],
  );

  // ── Chart 1: Entregas por comunidad × fecha ───────────────────────────────

  const TOP_COMMUNITIES = 8;

  const topCommunityNames = useMemo(() => {
    const communityByMember = new Map(orgMembers.map((m) => [m.id, m.communityId]));
    const communityName     = new Map(communities.map((c) => [c.id, c.name]));
    const counts            = new Map<string, number>();

    const tally = (memberId: string) => {
      const communityId = communityByMember.get(memberId);
      if (!communityId) return;
      const name = communityName.get(communityId) ?? "Sin comunidad";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    };

    directEntries.forEach((e) => tally(e.fromOrgId));
    indirectEntries.forEach((e) => tally(e.orgMemberId));

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_COMMUNITIES)
      .map(([name]) => name);
  }, [directEntries, indirectEntries, orgMembers, communities]);

  const dailyCommunityData = useMemo(() => {
    const communityByMember = new Map(orgMembers.map((m) => [m.id, m.communityId]));
    const communityName     = new Map(communities.map((c) => [c.id, c.name]));
    const topSet            = new Set(topCommunityNames);

    return days.map((day) => {
      const next  = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const inDay = (d: Date | null) => d !== null && d >= day && d < next;

      const row: Record<string, string | number> = { fecha: dayLabel(day) };
      topCommunityNames.forEach((n) => { row[n] = 0; });

      const tally = (memberId: string, date: Date | null) => {
        if (!inDay(date)) return;
        const communityId = communityByMember.get(memberId);
        if (!communityId) return;
        const name = communityName.get(communityId);
        if (!name || !topSet.has(name)) return;
        (row[name] as number)++;
      };

      directEntries.forEach((e) => tally(e.fromOrgId, e.createdAt));
      indirectEntries.forEach((e) => tally(e.orgMemberId, e.createdAt));

      return row;
    });
  }, [days, directEntries, indirectEntries, orgMembers, communities, topCommunityNames]);

  // ── Chart 2: Entregas por día ──────────────────────────────────────────────

  const dailyData = useMemo(() => {
    return days.map((day) => {
      const next  = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const inDay = (d: Date | null) => d !== null && d >= day && d < next;
      return {
        fecha:    dayLabel(day),
        Internas: directEntries.filter((e)   => inDay(e.createdAt)).length,
        Externas: indirectEntries.filter((e) => inDay(e.createdAt)).length,
      };
    });
  }, [days, directEntries, indirectEntries]);

  const totalDeliveries14d = directEntries.filter((e) => e.createdAt && e.createdAt >= days[0]).length
                           + indirectEntries.filter((e) => e.createdAt && e.createdAt >= days[0]).length;

  // ── Chart 3: Entregas por tipo de apoyo ───────────────────────────────────

  const aidTypeData = useMemo(() => {
    const counts = new Map<string, number>();
    [...directEntries, ...indirectEntries].forEach((e) => {
      if (e.aidTypeId) counts.set(e.aidTypeId, (counts.get(e.aidTypeId) ?? 0) + 1);
    });
    return aidTypes
      .map((at) => ({ name: at.name, value: counts.get(at.id) ?? 0 }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [directEntries, indirectEntries, aidTypes]);

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Panel de Control</h2>
        <p className="mt-2 text-sm text-slate-600">
          Métricas y gráficas operativas en tiempo real.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {/* ── KPIs: Operación ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Operación — esta semana
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Entregas internas"
            primary={directThisWeek}
            primarySub="esta semana"
            secondary={`${directToday} hoy · ${directEntries.length} en 30 días`}
            color="blue"
            trend={computeTrend(directThisWeek, directPrevWeek)}
          />
          <KpiCard
            label="Entregas externas"
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

      {/* ── KPIs: Estructura ──────────────────────────────────────────────── */}
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

      {/* ── Chart 1: Entregas por comunidad × fecha ────────────────────────── */}
      <ChartCard
        title="Entregas por comunidad"
        description={`Top ${topCommunityNames.length} comunidades — últimos 14 días`}
        badge={`${topCommunityNames.length} comunidades`}
        empty={topCommunityNames.length === 0}
      >
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={dailyCommunityData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} cursor={{ fill: "#f8fafc" }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
            {topCommunityNames.map((name, i) => (
              <Bar
                key={name}
                dataKey={name}
                stackId="c"
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                maxBarSize={40}
                radius={i === topCommunityNames.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Charts 2 + 3 ──────────────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-2">

        {/* Chart 2: Internas vs Externas por día */}
        <ChartCard
          title="Internas vs Externas"
          description="Volumen diario — últimos 14 días"
          badge={`${totalDeliveries14d} total`}
          empty={totalDeliveries14d === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} cursor={{ fill: "#f8fafc" }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconType="circle" iconSize={8} />
              <Bar dataKey="Internas" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Externas" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Tipos de apoyo */}
        <ChartCard
          title="Entregas por tipo de apoyo"
          description="Top 8 tipos — internas y externas combinadas"
          badge={`${aidTypeData.length} tipos`}
          empty={aidTypeData.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={aidTypeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={64}
                outerRadius={108}
                paddingAngle={2}
              >
                {aidTypeData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                formatter={(value, name) => [`${value} entregas`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>
    </section>
  );
}

// ── ChartCard ─────────────────────────────────────────────────────────────────

function ChartCard({
  title, description, badge, empty, children,
}: {
  title: string; description: string; badge: string; empty: boolean; children: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {badge}
        </span>
      </div>
      <div className="mt-6">
        {empty ? (
          <div className="flex h-[280px] items-center justify-center rounded-lg bg-slate-50">
            <p className="text-sm text-slate-400">Sin datos para mostrar.</p>
          </div>
        ) : (
          children
        )}
      </div>
    </article>
  );
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

type KpiColor = "blue" | "violet" | "emerald" | "amber";

const colorMap: Record<KpiColor, { card: string; number: string }> = {
  blue:    { card: "border-blue-100 bg-blue-50",       number: "text-blue-700"    },
  violet:  { card: "border-violet-100 bg-violet-50",   number: "text-violet-700"  },
  emerald: { card: "border-emerald-100 bg-emerald-50", number: "text-emerald-700" },
  amber:   { card: "border-amber-100 bg-amber-50",     number: "text-amber-700"   },
};

function KpiCard({
  label, primary, primarySub, secondary, color, trend,
}: {
  label: string; primary: number | string; primarySub: string; secondary: string;
  color?: KpiColor; trend?: number | null;
}) {
  const styles = color ? colorMap[color] : { card: "border-slate-200 bg-white", number: "text-slate-900" };
  return (
    <article className={`rounded-xl border p-5 ${styles.card}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${styles.number}`}>{primary}</p>
      <p className="mt-0.5 text-xs text-slate-500">{primarySub}</p>
      {trend != null && (
        <p className={`mt-2 text-xs font-semibold ${trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {trend >= 0 ? `↑ +${trend}%` : `↓ ${Math.abs(trend)}%`} vs. sem. anterior
        </p>
      )}
      <p className="mt-1 text-xs text-slate-400">{secondary}</p>
    </article>
  );
}
