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

// ── Types ─────────────────────────────────────────────────────────────────────

type DirectEntry   = { id: string; createdAt: Date | null; fromOrgId: string; aidTypeId: string };
type IndirectEntry = { id: string; createdAt: Date | null; orgMemberId: string; aidTypeId: string };
type AidTypeEntry  = { id: string; name: string };
type MemberEntry   = { id: string; levelId: string };
type LevelEntry    = { id: string; name: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#f97316", "#84cc16"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChartsPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars  = getMissingFirebaseEnvVars();

  const [directEntries,   setDirectEntries]   = useState<DirectEntry[]>([]);
  const [indirectEntries, setIndirectEntries] = useState<IndirectEntry[]>([]);
  const [aidTypes,        setAidTypes]        = useState<AidTypeEntry[]>([]);
  const [orgMembers,      setOrgMembers]      = useState<MemberEntry[]>([]);
  const [orgLevels,       setOrgLevels]       = useState<LevelEntry[]>([]);
  const [error,           setError]           = useState<string | null>(null);

  const { fourteenDaysAgo, days } = useMemo(() => {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    return { fourteenDaysAgo, days: buildDays(14) };
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    const db = getFirestoreDb();
    if (!db) return;

    const cutoff = Timestamp.fromDate(fourteenDaysAgo);

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
          orgMemberId: (d.get("orgMemberId") as string) || (d.get("registeredBy") as string) || "",
          aidTypeId:   (d.get("aidTypeId") as string) || "",
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
        (snap) => setOrgMembers(snap.docs.map((d) => ({
          id:      d.id,
          levelId: (d.get("levelId") as string) || "",
        }))),
        (err) => setError(err.message),
      ),

      onSnapshot(
        collection(db, "OrgLevels"),
        (snap) => setOrgLevels(snap.docs.map((d) => ({
          id:   d.id,
          name: (d.get("name") as string) || d.id,
        }))),
        (err) => setError(err.message),
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [isConfigured, fourteenDaysAgo]);

  // ── Chart 1: Entregas por día ──────────────────────────────────────────────
  const dailyData = useMemo(() => {
    return days.map((day) => {
      const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const inDay = (d: Date | null) => d !== null && d >= day && d < next;
      return {
        fecha:      dayLabel(day),
        Directas:   directEntries.filter((e)   => inDay(e.createdAt)).length,
        Indirectas: indirectEntries.filter((e) => inDay(e.createdAt)).length,
      };
    });
  }, [days, directEntries, indirectEntries]);

  const totalDeliveries14d = directEntries.length + indirectEntries.length;

  // ── Chart 2: Entregas por tipo de apoyo ───────────────────────────────────
  const aidTypeData = useMemo(() => {
    const counts = new Map<string, number>();
    [...directEntries, ...indirectEntries].forEach((e) => {
      if (e.aidTypeId) counts.set(e.aidTypeId, (counts.get(e.aidTypeId) ?? 0) + 1);
    });
    return aidTypes
      .map((at) => ({ name: at.name, total: counts.get(at.id) ?? 0 }))
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [directEntries, indirectEntries, aidTypes]);

  // ── Chart 3: Entregas por nivel organizacional ────────────────────────────
  const orgLevelData = useMemo(() => {
    const levelByMember = new Map(orgMembers.map((m) => [m.id, m.levelId]));
    const levelName     = new Map(orgLevels.map((l)  => [l.id, l.name]));
    const counts        = new Map<string, number>();

    directEntries.forEach((e) => {
      const levelId = levelByMember.get(e.fromOrgId);
      if (!levelId) return;
      const name = levelName.get(levelId) ?? "Desconocido";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [directEntries, orgMembers, orgLevels]);

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Gráficas</h2>
        <p className="mt-2 text-sm text-slate-600">
          Visualización operativa en tiempo real — últimos 14 días.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {/* ── Chart 1: Entregas por día ──────────────────────────────────────── */}
      <ChartCard
        title="Entregas por día"
        description="Directas e indirectas — últimos 14 días"
        badge={`${totalDeliveries14d} total`}
        empty={totalDeliveries14d === 0}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dailyData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="fecha"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              cursor={{ fill: "#f8fafc" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="Directas"   fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={32} />
            <Bar dataKey="Indirectas" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Charts 2 + 3 ──────────────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-2">

        {/* Chart 2: Tipos de apoyo */}
        <ChartCard
          title="Entregas por tipo de apoyo"
          description="Top 8 tipos — directas e indirectas combinadas"
          badge={`${aidTypeData.length} tipos`}
          empty={aidTypeData.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={aidTypeData}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={96}
                tick={{ fontSize: 11, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                cursor={{ fill: "#f8fafc" }}
              />
              <Bar dataKey="total" fill="#10b981" radius={[0, 3, 3, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Nivel organizacional */}
        <ChartCard
          title="Entregas por nivel organizacional"
          description="Distribución de entregas directas por nivel del activista"
          badge={`${orgLevelData.length} niveles`}
          empty={orgLevelData.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={orgLevelData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={64}
                outerRadius={108}
                paddingAngle={2}
              >
                {orgLevelData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                formatter={(value, name) => [`${value} entregas`, name]}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>
    </section>
  );
}

// ── ChartCard ─────────────────────────────────────────────────────────────────

function ChartCard({
  title,
  description,
  badge,
  empty,
  children,
}: {
  title: string;
  description: string;
  badge: string;
  empty: boolean;
  children: React.ReactNode;
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
