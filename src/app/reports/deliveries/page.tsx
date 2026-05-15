"use client";

import { collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { SortTh } from "@/components/reports/sort-th";
import { TableSkeleton } from "@/components/reports/table-skeleton";
import { getFirestoreDb, getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import {
  computeDateRange,
  exportToCsv,
  fmtDateTime,
  parseTimestamp,
  sortRows,
  type DatePreset,
} from "@/lib/report-utils";
import type { AidType, OrgLevel } from "@/types/shared";

type Row = {
  id: string;
  type: "Directa" | "Indirecta";
  date: Date | null;
  activistName: string;
  levelId: string;
  levelName: string;
  aidTypeId: string;
  aidTypeName: string;
  communityName: string;
  quantity: number | null;
  unit: string;
  recipientName: string;
  comment: string;
  status: string;
  locationMissing: boolean;
  locationMissingReason: string;
};

function formatQuantity(quantity: number | null, unit: string): string {
  if (quantity === null) return "—";
  const val = quantity % 1 === 0 ? String(Math.trunc(quantity)) : String(quantity);
  return unit ? `${val} ${unit}` : val;
}

type SortKey = keyof Row;
type DelivType = "both" | "direct" | "indirect";


export default function DeliveriesReportPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars  = getMissingFirebaseEnvVars();

  const [aidTypes,  setAidTypes]  = useState<AidType[]>([]);
  const [orgLevels, setOrgLevels] = useState<OrgLevel[]>([]);

  const [preset,      setPreset]      = useState<DatePreset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");
  const [delivType,    setDelivType]    = useState<DelivType>("both");
  const [aidTypeId,    setAidTypeId]    = useState("");
  const [levelId,      setLevelId]      = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "synced" | "pending_sync">("");

  const [rows,      setRows]      = useState<Row[]>([]);
  const [sortKey,   setSortKey]   = useState<SortKey>("date");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(false);
  const [hasRun,    setHasRun]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  function toggleSort(field: SortKey) {
    if (sortKey === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(field); setSortDir("asc"); }
  }

  const sortedRows = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir]);

  useEffect(() => {
    if (!isConfigured) return;
    const db = getFirestoreDb();
    if (!db) return;
    Promise.all([
      getDocs(collection(db, "AidTypes")),
      getDocs(collection(db, "OrgLevels")),
    ]).then(([atSnap, olSnap]) => {
      setAidTypes(atSnap.docs.map((d) => ({
        id: d.id, name: (d.get("name") as string) || d.id,
        unit: d.get("unit") as AidType["unit"], active: true,
      })));
      setOrgLevels(
        olSnap.docs.map((d) => ({
          id: d.id, name: (d.get("name") as string) || d.id,
          rank: (d.get("rank") as number) || 0,
          canUseApp: false, capabilities: [], active: true,
        })).sort((a, b) => a.rank - b.rank),
      );
    }).catch((e) => setError((e as Error).message));
  }, [isConfigured]);

  async function runReport() {
    const db = getFirestoreDb();
    if (!db) return;
    setIsLoading(true);
    setError(null);
    try {
      const { start, end } = computeDateRange(preset, customStart, customEnd);
      const s = Timestamp.fromDate(start);
      const e = Timestamp.fromDate(end);

      const [membersSnap, commSnap, citiesSnap] = await Promise.all([
        getDocs(collection(db, "OrgMembers")),
        getDocs(collection(db, "Communities")),
        getDocs(collection(db, "Cities")),
      ]);

      const memberMap = new Map(membersSnap.docs.map((d) => {
        const asgn = d.get("assignment") as Record<string, string | null> | null;
        return [d.id, {
          name:        (d.get("name") as string) || "—",
          levelId:     (d.get("levelId") as string) || "",
          communityId: asgn?.communityId ?? null,
        }];
      }));

      const levelMap = new Map(orgLevels.map((l) => [l.id, l.name]));
      const aidMap   = new Map(aidTypes.map((a)  => [a.id, a.name]));
      const cityMap  = new Map(citiesSnap.docs.map((d) => [d.id, (d.get("name") as string) || d.id]));
      const commMap  = new Map(commSnap.docs.map((d) => [d.id, {
        name:   (d.get("name")   as string) || d.id,
        cityId: (d.get("cityId") as string) || "",
      }]));

      function communityLabel(memberId: string): string {
        const m = memberMap.get(memberId);
        if (!m?.communityId) return "—";
        const c = commMap.get(m.communityId);
        if (!c) return "—";
        const city = cityMap.get(c.cityId);
        return city ? `${c.name}, ${city}` : c.name;
      }

      const allRows: Row[] = [];

      if (delivType !== "indirect") {
        const snap = await getDocs(query(
          collection(db, "DirectDeliveries"),
          where("createdAt", ">=", s),
          where("createdAt", "<=", e),
        ));
        snap.docs.forEach((d) => {
          const mid = (d.get("fromOrgId") as string) || (d.get("orgMemberId") as string) || "";
          const m   = memberMap.get(mid);
          const lid = m?.levelId ?? "";
          const aid = (d.get("aidTypeId") as string) || "";
          allRows.push({
            id: d.id, type: "Directa",
            date: parseTimestamp(d.get("createdAt")),
            activistName: m?.name ?? "—",
            levelId: lid,  levelName:    levelMap.get(lid) ?? "—",
            aidTypeId: aid, aidTypeName: aidMap.get(aid)   ?? "—",
            communityName: communityLabel(mid),
            quantity: d.get("quantity") != null ? (d.get("quantity") as number) : null,
            unit: (d.get("unit") as string) || "",
            recipientName: (d.get("toName") as string) || "",
            comment: (d.get("comment") as string) || "",
            status: (d.get("status") as string) || "",
            locationMissing: Boolean(d.get("locationMissing")),
            locationMissingReason: (d.get("locationMissingReason") as string) || "",
          });
        });
      }

      if (delivType !== "direct") {
        const snap = await getDocs(query(
          collection(db, "IndirectDeliveries"),
          where("createdAt", ">=", s),
          where("createdAt", "<=", e),
        ));
        snap.docs.forEach((d) => {
          const mid = (d.get("orgMemberId") as string) || "";
          const m   = memberMap.get(mid);
          const lid = m?.levelId ?? "";
          const aid = (d.get("aidTypeId") as string) || "";
          allRows.push({
            id: d.id, type: "Indirecta",
            date: parseTimestamp(d.get("createdAt")),
            activistName: m?.name ?? "—",
            levelId: lid,  levelName:    levelMap.get(lid) ?? "—",
            aidTypeId: aid, aidTypeName: aidMap.get(aid)   ?? "—",
            communityName: communityLabel(mid),
            quantity: d.get("quantity") != null ? (d.get("quantity") as number) : null,
            unit: (d.get("unit") as string) || "",
            recipientName: (d.get("beneficiaryName") as string) || "",
            comment: (d.get("comment") as string) || "",
            status: (d.get("status") as string) || "",
            locationMissing: Boolean(d.get("locationMissing")),
            locationMissingReason: (d.get("locationMissingReason") as string) || "",
          });
        });
      }

      let filtered = allRows;
      if (aidTypeId)    filtered = filtered.filter((r) => r.aidTypeId === aidTypeId);
      if (levelId)      filtered = filtered.filter((r) => r.levelId   === levelId);
      if (statusFilter) filtered = filtered.filter((r) => r.status    === statusFilter);
      filtered.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

      setRows(filtered);
      setHasRun(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  function doExport() {
    exportToCsv(
      "entregas.csv",
      ["Fecha", "Tipo", "Activista", "Nivel", "Tipo de Apoyo", "Comunidad", "Cantidad", "Destinatario", "Estado", "Comentario", "Ubicación faltante", "Razón"],
      sortedRows.map((r) => [
        fmtDateTime(r.date), r.type, r.activistName, r.levelName, r.aidTypeName, r.communityName,
        formatQuantity(r.quantity, r.unit),
        r.recipientName,
        r.status === "synced" ? "Sincronizado" : r.status === "pending_sync" ? "Pendiente" : r.status,
        r.comment,
        r.locationMissing ? "Sí" : "No",
        r.locationMissingReason,
      ]),
    );
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Reporte de Entregas</h2>
        <p className="mt-2 text-sm text-slate-600">
          Directas e indirectas filtradas por periodo y criterios.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <DateRangeFilter
          preset={preset} customStart={customStart} customEnd={customEnd}
          onPreset={setPreset} onStart={setCustomStart} onEnd={setCustomEnd}
        />
        <div className="flex flex-wrap gap-3">
          <select value={delivType} onChange={(e) => setDelivType(e.target.value as DelivType)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
            <option value="both">Directas e indirectas</option>
            <option value="direct">Solo directas</option>
            <option value="indirect">Solo indirectas</option>
          </select>
          <select value={aidTypeId} onChange={(e) => setAidTypeId(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
            <option value="">Todos los tipos de apoyo</option>
            {aidTypes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={levelId} onChange={(e) => setLevelId(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
            <option value="">Todos los niveles</option>
            {orgLevels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | "synced" | "pending_sync")}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
            <option value="">Todos los estados</option>
            <option value="synced">Sincronizado</option>
            <option value="pending_sync">Pendiente de sincronizar</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => void runReport()} disabled={isLoading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
            {isLoading ? "Generando..." : "Generar reporte"}
          </button>
          {hasRun && sortedRows.length > 0 && (
            <button type="button" onClick={doExport}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {hasRun && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-700">
              {sortedRows.length} {sortedRows.length === 1 ? "registro" : "registros"}
            </p>
          </div>
          {isLoading ? (
            <TableSkeleton cols={11} />
          ) : sortedRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              Sin resultados. Intenta ampliar el rango de fechas o ajustar los filtros.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100">
                  <tr>
                    <SortTh label="Fecha"        field="date"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Tipo"         field="type"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Activista"    field="activistName"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Nivel"        field="levelName"     sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Tipo Apoyo"   field="aidTypeName"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Comunidad"    field="communityName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Cantidad"     field="quantity"      sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Destinatario" field="recipientName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Estado"       field="status"        sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Comentario</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Ubicación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{fmtDateTime(r.date)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.type === "Directa" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"
                        }`}>{r.type}</span>
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-900">{r.activistName}</td>
                      <td className="px-5 py-3 text-slate-600">{r.levelName}</td>
                      <td className="px-5 py-3 text-slate-600">{r.aidTypeName}</td>
                      <td className="px-5 py-3 text-slate-600">{r.communityName}</td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatQuantity(r.quantity, r.unit)}</td>
                      <td className="px-5 py-3 text-slate-600 max-w-[160px] truncate" title={r.recipientName || undefined}>
                        {r.recipientName || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === "synced"       ? "bg-emerald-50 text-emerald-700" :
                          r.status === "pending_sync" ? "bg-amber-50 text-amber-700" :
                                                        "bg-slate-100 text-slate-500"
                        }`}>
                          {r.status === "synced" ? "Sincronizado" : r.status === "pending_sync" ? "Pendiente" : r.status || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600 max-w-[180px] truncate" title={r.comment || undefined}>
                        {r.comment || "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                        {r.locationMissing
                          ? <span className="text-amber-600" title={r.locationMissingReason || undefined}>{r.locationMissingReason || "Sin ubicación"}</span>
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
