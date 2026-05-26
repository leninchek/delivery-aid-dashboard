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

type MunicipioOption = { id: string; name: string };

type Row = {
  communityId: string;
  communityName: string;
  cityName: string;
  totalDeliveries: number;
  activeActivists: number;
  lastDelivery: Date | null;
};

export default function CommunitiesReportPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars  = getMissingFirebaseEnvVars();

  const [municipios, setMunicipios] = useState<MunicipioOption[]>([]);

  const [preset,      setPreset]      = useState<DatePreset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");
  const [cityId,      setCityId]      = useState("");

  const [rows,      setRows]      = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRun,    setHasRun]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const { sortKey, sortDir, toggleSort, sortedRows } = useReportSort<Row>(rows, "totalDeliveries");

  useEffect(() => {
    if (!isConfigured) return;
    const db = getFirestoreDb();
    if (!db) return;
    getDocs(collection(db, "Cities"))
      .then((snap) =>
        setMunicipios(
          snap.docs
            .map((d) => ({ id: d.id, name: (d.get("name") as string) || d.id }))
            .sort((a, b) => a.name.localeCompare(b.name)),
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

      const [commSnap, membersSnap, directSnap, indirectSnap] = await Promise.all([
        getDocs(collection(db, "Communities")),
        getDocs(collection(db, "OrgMembers")),
        getDocs(query(collection(db, "DirectDeliveries"),   where("createdAt", ">=", s), where("createdAt", "<=", e))),
        getDocs(query(collection(db, "IndirectDeliveries"), where("createdAt", ">=", s), where("createdAt", "<=", e))),
      ]);

      const cityMap = new Map(municipios.map((c) => [c.id, c.name]));

      const memberCommMap = new Map<string, string>();
      membersSnap.docs.forEach((d) => {
        const asgn = d.get("assignment") as Record<string, string | null> | null;
        const cid = asgn?.communityId ?? null;
        if (cid) memberCommMap.set(d.id, cid);
      });

      type CommStats = {
        name: string; cityId: string;
        deliveries: number; activists: Set<string>; last: Date | null;
      };
      const stats = new Map<string, CommStats>();
      commSnap.docs.forEach((d) => {
        stats.set(d.id, {
          name:       (d.get("name")   as string) || d.id,
          cityId:     (d.get("cityId") as string) || "",
          deliveries: 0, activists: new Set(), last: null,
        });
      });

      function credit(memberId: string, date: Date | null) {
        const cid = memberCommMap.get(memberId);
        if (!cid) return;
        const st = stats.get(cid);
        if (!st) return;
        st.deliveries++;
        st.activists.add(memberId);
        if (date && (!st.last || date > st.last)) st.last = date;
      }

      directSnap.docs.forEach((d) => {
        credit((d.get("fromOrgId") as string) || (d.get("orgMemberId") as string) || "", parseTimestamp(d.get("createdAt")));
      });
      indirectSnap.docs.forEach((d) => {
        credit((d.get("orgMemberId") as string) || "", parseTimestamp(d.get("createdAt")));
      });

      const built: Row[] = Array.from(stats.entries())
        .filter(([, st]) => !cityId || st.cityId === cityId)
        .map(([cid, st]) => ({
          communityId:     cid,
          communityName:   st.name,
          cityName:        cityMap.get(st.cityId) ?? "—",
          totalDeliveries: st.deliveries,
          activeActivists: st.activists.size,
          lastDelivery:    st.last,
        }));

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
      "cobertura-comunidades.csv",
      ["Comunidad", "Municipio", "Total Entregas", "Activistas", "Última Entrega"],
      sortedRows.map((r) => [
        r.communityName, r.cityName,
        String(r.totalDeliveries), String(r.activeActivists),
        fmtDate(r.lastDelivery),
      ]),
    );
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <ReportShell
      title="Cobertura por Comunidad"
      description="Actividad de entregas por comunidad y municipio en el periodo seleccionado."
      error={error}
      isLoading={isLoading}
      hasRun={hasRun}
      rowCount={sortedRows.length}
      rowLabel={["comunidad", "comunidades"]}
      onGenerate={() => void runReport()}
      onExport={doExport}
      filters={
        <>
          <DateRangeFilter
            preset={preset} customStart={customStart} customEnd={customEnd}
            onPreset={setPreset} onStart={setCustomStart} onEnd={setCustomEnd}
          />
          <div className="flex flex-wrap gap-3">
            <select value={cityId} onChange={(e) => setCityId(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
              <option value="">Todos los municipios</option>
              {municipios.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </>
      }
    >
      {isLoading ? (
        <TableSkeleton cols={5} />
      ) : sortedRows.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">
          Sin comunidades con actividad en el periodo. Intenta ampliar el rango de fechas.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100">
              <tr>
                <SortTh label="Comunidad"    field="communityName"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                <SortTh label="Municipio"    field="cityName"        sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                <SortTh label="Entregas"     field="totalDeliveries" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                <SortTh label="Activistas"   field="activeActivists" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                <SortTh label="Últ. entrega" field="lastDelivery"    sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRows.map((r) => (
                <tr key={r.communityId} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{r.communityName}</td>
                  <td className="px-5 py-3 text-slate-600">{r.cityName}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-900">{r.totalDeliveries}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-600">{r.activeActivists}</td>
                  <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{fmtDate(r.lastDelivery)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportShell>
  );
}
