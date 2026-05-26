"use client";

import { collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { ReportShell } from "@/components/reports/ReportShell";
import { SortTh } from "@/components/reports/sort-th";
import { TableSkeleton } from "@/components/reports/table-skeleton";
import { useReportSort } from "@/hooks/useReportSort";
import { getFirestoreDb, getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import {
  computeDateRange,
  exportToCsv,
  fmtDate,
  parseTimestamp,
  type DatePreset,
} from "@/lib/report-utils";
import type { OrgLevel } from "@/types/shared";

type Row = {
  id: string;
  name: string;
  levelId: string;
  levelName: string;
  directCount: number;
  indirectCount: number;
  promotedCount: number;
  lastActivity: Date | null;
  active: boolean;
};

export default function ActivistsReportPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars  = getMissingFirebaseEnvVars();

  const [orgLevels, setOrgLevels] = useState<OrgLevel[]>([]);

  const [preset,      setPreset]      = useState<DatePreset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");
  const [levelId,     setLevelId]     = useState("");
  const [activeOnly,  setActiveOnly]  = useState(false);

  const [rows,      setRows]      = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRun,    setHasRun]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const { sortKey, sortDir, toggleSort, sortedRows } = useReportSort<Row>(rows, "directCount");

  useEffect(() => {
    if (!isConfigured) return;
    const db = getFirestoreDb();
    if (!db) return;
    getDocs(collection(db, "OrgLevels"))
      .then((snap) =>
        setOrgLevels(
          snap.docs
            .map((d) => ({
              id: d.id, name: (d.get("name") as string) || d.id,
              rank: (d.get("rank") as number) || 0,
              canUseApp: false, capabilities: [], active: true,
            }))
            .sort((a, b) => a.rank - b.rank),
        ),
      )
      .catch((e) => setError((e as Error).message));
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

      const [membersSnap, directSnap, indirectSnap, promotedSnap] = await Promise.all([
        getDocs(collection(db, "OrgMembers")),
        getDocs(query(collection(db, "DirectDeliveries"),   where("createdAt", ">=", s), where("createdAt", "<=", e))),
        getDocs(query(collection(db, "IndirectDeliveries"), where("createdAt", ">=", s), where("createdAt", "<=", e))),
        getDocs(query(collection(db, "Promoted"),           where("createdAt", ">=", s), where("createdAt", "<=", e))),
      ]);

      const levelMap = new Map(orgLevels.map((l) => [l.id, l.name]));

      const directCounts   = new Map<string, number>();
      const indirectCounts = new Map<string, number>();
      const promotedCounts = new Map<string, number>();
      const lastActivity   = new Map<string, Date>();

      function bump(map: Map<string, number>, id: string) {
        map.set(id, (map.get(id) ?? 0) + 1);
      }
      function touch(id: string, d: Date | null) {
        if (!d) return;
        const prev = lastActivity.get(id);
        if (!prev || d > prev) lastActivity.set(id, d);
      }

      directSnap.docs.forEach((d) => {
        const id = (d.get("fromOrgId") as string) || (d.get("orgMemberId") as string) || "";
        if (!id) return;
        bump(directCounts, id);
        touch(id, parseTimestamp(d.get("createdAt")));
      });

      indirectSnap.docs.forEach((d) => {
        const id = (d.get("orgMemberId") as string) || "";
        if (!id) return;
        bump(indirectCounts, id);
        touch(id, parseTimestamp(d.get("createdAt")));
      });

      promotedSnap.docs.forEach((d) => {
        const id = (d.get("activistId") as string) || "";
        if (!id) return;
        bump(promotedCounts, id);
        touch(id, parseTimestamp(d.get("createdAt")));
      });

      let built: Row[] = membersSnap.docs.map((d) => {
        const lid = (d.get("levelId") as string) || "";
        return {
          id:            d.id,
          name:          (d.get("name") as string) || "—",
          levelId:       lid,
          levelName:     levelMap.get(lid) ?? "—",
          directCount:   directCounts.get(d.id)   ?? 0,
          indirectCount: indirectCounts.get(d.id) ?? 0,
          promotedCount: promotedCounts.get(d.id) ?? 0,
          lastActivity:  lastActivity.get(d.id) ?? null,
          active:        (d.get("active") as boolean) ?? true,
        };
      });

      if (levelId)    built = built.filter((r) => r.levelId === levelId);
      if (activeOnly) built = built.filter((r) => r.active);

      setRows(built);
      setHasRun(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  function doExport() {
    exportToCsv(
      "actividad-activistas.csv",
      ["Nombre", "Nivel", "Entrega interna", "Entrega externa", "Promovidos", "Última Actividad", "Estado"],
      sortedRows.map((r) => [
        r.name, r.levelName,
        String(r.directCount), String(r.indirectCount), String(r.promotedCount),
        fmtDate(r.lastActivity),
        r.active ? "Activo" : "Inactivo",
      ]),
    );
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <ReportShell
      title="Actividad por Activista"
      description="Resumen operativo de cada miembro organizacional en el periodo seleccionado."
      error={error}
      isLoading={isLoading}
      hasRun={hasRun}
      rowCount={sortedRows.length}
      rowLabel={["miembro", "miembros"]}
      onGenerate={() => void runReport()}
      onExport={doExport}
      filters={
        <>
          <DateRangeFilter
            preset={preset} customStart={customStart} customEnd={customEnd}
            onPreset={setPreset} onStart={setCustomStart} onEnd={setCustomEnd}
          />
          <div className="flex flex-wrap items-center gap-3">
            <select value={levelId} onChange={(e) => setLevelId(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
              <option value="">Todos los niveles</option>
              {orgLevels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)}
                className="rounded border-slate-300" />
              Solo activos
            </label>
          </div>
        </>
      }
    >
      {isLoading ? (
        <TableSkeleton cols={7} />
      ) : sortedRows.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">
          Sin resultados. Intenta ampliar el rango de fechas o cambiar los filtros activos.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100">
              <tr>
                <SortTh label="Nombre"         field="name"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                <SortTh label="Nivel"          field="levelName"     sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                <SortTh label="Con benef."     field="directCount"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                <SortTh label="Sin benef."     field="indirectCount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                <SortTh label="Promovidos"     field="promotedCount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                <SortTh label="Últ. actividad" field="lastActivity"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                <SortTh label="Estado"         field="active"        sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-5 py-3 text-slate-600">{r.levelName}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-blue-700">{r.directCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-violet-700">{r.indirectCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-emerald-700">{r.promotedCount}</td>
                  <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{fmtDate(r.lastActivity)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}>{r.active ? "Activo" : "Inactivo"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportShell>
  );
}
