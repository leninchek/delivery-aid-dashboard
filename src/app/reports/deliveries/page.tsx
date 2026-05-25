"use client";

import { collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { ReportImageCell } from "@/components/reports/report-image-cell";
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
  type: "Interna" | "Externa";
  date: Date | null;
  activistName: string;
  levelId: string;
  levelName: string;
  aidTypeId: string;
  aidTypeName: string;
  curp: string;
  quantity: number | null;
  unit: string;
  recipientName: string;
  comment: string;
  status: string;
  locationMissing: boolean;
  locationMissingReason: string;
  evidenceUrls: string[];
};

type CurpResultRow = {
  id: string;
  type: "Interna" | "Externa";
  date: Date | null;
  activistName: string;
  aidTypeName: string;
  quantity: number | null;
  unit: string;
  status: string;
};

type MemberInfo = { name: string; levelId: string };
type EvidenceFilter = "all" | "with" | "without" | "pending";

function getEvidenceUrls(doc: { get: (field: string) => unknown }): string[] {
  const urls = doc.get("evidenceUrls");
  if (Array.isArray(urls)) {
    return urls.filter((url): url is string => typeof url === "string" && url.length > 0);
  }
  const legacyUrl = doc.get("imageURL") || doc.get("imageUrl");
  return typeof legacyUrl === "string" && legacyUrl.length > 0 ? [legacyUrl] : [];
}

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
  const [memberMap,      setMemberMap]      = useState<Map<string, MemberInfo>>(new Map());
  const [promotedCurpMap, setPromotedCurpMap] = useState<Map<string, string>>(new Map());
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);

  const [preset,      setPreset]      = useState<DatePreset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");
  const [delivType,    setDelivType]    = useState<DelivType>("both");
  const [aidTypeId,    setAidTypeId]    = useState("");
  const [levelId,      setLevelId]      = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "synced" | "pending_sync">("");
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>("all");

  const [rows,      setRows]      = useState<Row[]>([]);
  const [sortKey,   setSortKey]   = useState<SortKey>("date");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(false);
  const [hasRun,    setHasRun]    = useState(false);
  const [isStale,   setIsStale]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  const [curpSearch,      setCurpSearch]      = useState("");
  const [curpResults,     setCurpResults]     = useState<CurpResultRow[]>([]);
  const [curpPerson,      setCurpPerson]      = useState<{ name: string } | null>(null);
  const [isCurpSearching, setIsCurpSearching] = useState(false);
  const [curpSearchError, setCurpSearchError] = useState<string | null>(null);
  const [curpHasRun,      setCurpHasRun]      = useState(false);

  function markStale() {
    if (hasRun) setIsStale(true);
  }

  function toggleSort(field: SortKey) {
    if (sortKey === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(field); setSortDir("asc"); }
  }

  const visibleRows = useMemo(() => rows.filter((r) => {
    if (evidenceFilter === "with") return r.evidenceUrls.length > 0;
    if (evidenceFilter === "without") return r.evidenceUrls.length === 0 && r.status !== "pending_sync";
    if (evidenceFilter === "pending") return r.evidenceUrls.length === 0 && r.status === "pending_sync";
    return true;
  }), [rows, evidenceFilter]);

  const sortedRows = useMemo(() => sortRows(visibleRows, sortKey, sortDir), [visibleRows, sortKey, sortDir]);

  useEffect(() => {
    if (!isConfigured) return;
    const db = getFirestoreDb();
    if (!db) return;
    Promise.all([
      getDocs(collection(db, "AidTypes")),
      getDocs(collection(db, "OrgLevels")),
      getDocs(collection(db, "OrgMembers")),
      getDocs(collection(db, "Promoted")),
    ]).then(([atSnap, olSnap, membersSnap, promotedSnap]) => {
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
      setMemberMap(new Map(membersSnap.docs.map((d) => [d.id, {
        name:    (d.get("name")    as string) || "—",
        levelId: (d.get("levelId") as string) || "",
      }])));
      setPromotedCurpMap(new Map(promotedSnap.docs.map((d) => [
        d.id, (d.get("curp") as string) || "",
      ])));
    }).catch((e) => setError((e as Error).message))
      .finally(() => setIsLoadingCatalogs(false));
  }, [isConfigured]);

  async function runReport() {
    const db = getFirestoreDb();
    if (!db || isLoadingCatalogs) return;
    setIsLoading(true);
    setError(null);
    try {
      const { start, end } = computeDateRange(preset, customStart, customEnd);
      const s = Timestamp.fromDate(start);
      const e = Timestamp.fromDate(end);

      const levelMap = new Map(orgLevels.map((l) => [l.id, l.name]));
      const aidMap   = new Map(aidTypes.map((a)  => [a.id, a.name]));

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
          const pid = (d.get("toPromotedId") as string) || "";
          allRows.push({
            id: d.id, type: "Interna",
            date: parseTimestamp(d.get("createdAt")),
            activistName: m?.name ?? "—",
            levelId: lid,  levelName:   levelMap.get(lid) ?? "—",
            aidTypeId: aid, aidTypeName: aidMap.get(aid)  ?? "—",
            curp: promotedCurpMap.get(pid) ?? "—",
            quantity: d.get("quantity") != null ? (d.get("quantity") as number) : null,
            unit: (d.get("unit") as string) || "",
            recipientName: (d.get("toName") as string) || "",
            comment: (d.get("comment") as string) || "",
            status: (d.get("status") as string) || "",
            locationMissing: Boolean(d.get("locationMissing")),
            locationMissingReason: (d.get("locationMissingReason") as string) || "",
            evidenceUrls: getEvidenceUrls(d),
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
            id: d.id, type: "Externa",
            date: parseTimestamp(d.get("createdAt")),
            activistName: m?.name ?? "—",
            levelId: lid,  levelName:   levelMap.get(lid) ?? "—",
            aidTypeId: aid, aidTypeName: aidMap.get(aid)  ?? "—",
            curp: (d.get("curp") as string) || "—",
            quantity: d.get("quantity") != null ? (d.get("quantity") as number) : null,
            unit: (d.get("unit") as string) || "",
            recipientName: (d.get("beneficiaryName") as string) || "",
            comment: (d.get("comment") as string) || "",
            status: (d.get("status") as string) || "",
            locationMissing: Boolean(d.get("locationMissing")),
            locationMissingReason: (d.get("locationMissingReason") as string) || "",
            evidenceUrls: getEvidenceUrls(d),
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
      setIsStale(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function runCurpSearch() {
    const db = getFirestoreDb();
    if (!db || isLoadingCatalogs) return;
    const normalizedCurp = curpSearch.trim().toUpperCase();
    if (!normalizedCurp) return;

    setIsCurpSearching(true);
    setCurpSearchError(null);
    setCurpHasRun(false);

    try {
      const aidMap = new Map(aidTypes.map((a) => [a.id, a.name]));
      const results: CurpResultRow[] = [];
      let foundPerson: { name: string } | null = null;

      const promotedSnap = await getDocs(query(
        collection(db, "Promoted"),
        where("curp", "==", normalizedCurp),
      ));

      if (!promotedSnap.empty) {
        const promotedDoc = promotedSnap.docs[0];
        foundPerson = { name: (promotedDoc.get("name") as string) || normalizedCurp };

        for (const pd of promotedSnap.docs) {
          const directSnap = await getDocs(query(
            collection(db, "DirectDeliveries"),
            where("toPromotedId", "==", pd.id),
          ));
          directSnap.docs.forEach((d) => {
            const mid = (d.get("fromOrgId") as string) || (d.get("orgMemberId") as string) || "";
            const aid = (d.get("aidTypeId") as string) || "";
            results.push({
              id: d.id, type: "Interna",
              date: parseTimestamp(d.get("createdAt")),
              activistName: memberMap.get(mid)?.name ?? "—",
              aidTypeName: aidMap.get(aid) ?? "—",
              quantity: d.get("quantity") != null ? (d.get("quantity") as number) : null,
              unit: (d.get("unit") as string) || "",
              status: (d.get("status") as string) || "",
            });
          });
        }
      }

      const indirectSnap = await getDocs(query(
        collection(db, "IndirectDeliveries"),
        where("curp", "==", normalizedCurp),
      ));
      indirectSnap.docs.forEach((d) => {
        const mid = (d.get("orgMemberId") as string) || "";
        const aid = (d.get("aidTypeId") as string) || "";
        if (!foundPerson) {
          const bName = d.get("beneficiaryName") as string;
          if (bName) foundPerson = { name: bName };
        }
        results.push({
          id: d.id, type: "Externa",
          date: parseTimestamp(d.get("createdAt")),
          activistName: memberMap.get(mid)?.name ?? "—",
          aidTypeName: aidMap.get(aid) ?? "—",
          quantity: d.get("quantity") != null ? (d.get("quantity") as number) : null,
          unit: (d.get("unit") as string) || "",
          status: (d.get("status") as string) || "",
        });
      });

      results.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
      setCurpResults(results);
      setCurpPerson(foundPerson);
      setCurpHasRun(true);
    } catch (e) {
      setCurpSearchError((e as Error).message);
    } finally {
      setIsCurpSearching(false);
    }
  }

  function doExport() {
    exportToCsv(
      "entregas.csv",
      ["Fecha", "Tipo", "Activista", "Nivel", "Tipo de Apoyo", "CURP", "Cantidad", "Destinatario", "Estado", "Comentario", "Ubicación faltante", "Razón", "Evidencias"],
      sortedRows.map((r) => [
        fmtDateTime(r.date), r.type, r.activistName, r.levelName, r.aidTypeName, r.curp,
        formatQuantity(r.quantity, r.unit),
        r.recipientName,
        r.status === "synced" ? "Sincronizado" : r.status === "pending_sync" ? "Pendiente" : r.status,
        r.comment,
        r.locationMissing ? "Sí" : "No",
        r.locationMissingReason,
        r.evidenceUrls.join(" "),
      ]),
    );
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Reporte de Entregas</h2>
        <p className="mt-2 text-sm text-slate-600">
          Entregas internas y externas, filtradas por periodo y criterios.
        </p>
      </header>

      {/* ── Búsqueda por CURP ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Historial por CURP</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Consulta todos los apoyos recibidos por una persona, sin importar si fue entrega interna o externa.
          </p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={curpSearch}
            onChange={(e) => setCurpSearch(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 18))}
            onKeyDown={(e) => { if (e.key === "Enter" && curpSearch.length >= 10 && !isCurpSearching) void runCurpSearch(); }}
            placeholder="CURP (mínimo 10 caracteres)"
            className="w-72 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-slate-900"
            maxLength={18}
          />
          <button
            type="button"
            onClick={() => void runCurpSearch()}
            disabled={curpSearch.length < 10 || isCurpSearching || isLoadingCatalogs}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {isCurpSearching ? "Buscando..." : "Buscar"}
          </button>
        </div>

        {curpSearchError && (
          <p className="text-sm text-rose-600">{curpSearchError}</p>
        )}

        {curpHasRun && (
          <>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {curpPerson ? curpPerson.name : "Persona no registrada como promovido"}
                </p>
                <p className="font-mono text-xs text-slate-400">{curpSearch}</p>
              </div>
              <div className="flex flex-wrap gap-5">
                <span className="text-sm text-slate-700">
                  <span className="font-semibold">{curpResults.length}</span> {curpResults.length === 1 ? "entrega" : "entregas"} en total
                </span>
                <span className="text-sm text-blue-700">
                  <span className="font-semibold">{curpResults.filter((r) => r.type === "Interna").length}</span> internas
                </span>
                <span className="text-sm text-violet-700">
                  <span className="font-semibold">{curpResults.filter((r) => r.type === "Externa").length}</span> externas
                </span>
              </div>
            </div>

            {curpResults.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Tipo", "Fecha", "Tipo de apoyo", "Cantidad", "Registrado por", "Estado"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {curpResults.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.type === "Interna" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"
                          }`}>{r.type}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDateTime(r.date)}</td>
                        <td className="px-4 py-3 text-slate-600">{r.aidTypeName}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatQuantity(r.quantity, r.unit)}</td>
                        <td className="px-4 py-3 text-slate-600">{r.activistName}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {r.status === "synced" ? "Sincronizado" : r.status === "pending_sync" ? "Pendiente" : r.status || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-400">
                No se encontraron entregas para esta CURP.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Reporte general ───────────────────────────────────────────────────── */}
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <DateRangeFilter
          preset={preset} customStart={customStart} customEnd={customEnd}
          onPreset={(value) => { setPreset(value); markStale(); }}
          onStart={(value) => { setCustomStart(value); markStale(); }}
          onEnd={(value) => { setCustomEnd(value); markStale(); }}
        />
        <div className="flex flex-wrap gap-3">
          <select value={delivType} onChange={(e) => { setDelivType(e.target.value as DelivType); markStale(); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
            <option value="both">Todos los tipos</option>
            <option value="direct">Entrega interna</option>
            <option value="indirect">Entrega externa</option>
          </select>
          <select value={aidTypeId} onChange={(e) => { setAidTypeId(e.target.value); markStale(); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
            <option value="">Todos los tipos de apoyo</option>
            {aidTypes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={levelId} onChange={(e) => { setLevelId(e.target.value); markStale(); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
            <option value="">Todos los niveles</option>
            {orgLevels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as "" | "synced" | "pending_sync"); markStale(); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
            <option value="">Todos los estados</option>
            <option value="synced">Sincronizado</option>
            <option value="pending_sync">Pendiente de sincronizar</option>
          </select>
          <select value={evidenceFilter} onChange={(e) => setEvidenceFilter(e.target.value as EvidenceFilter)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
            <option value="all">Todas las evidencias</option>
            <option value="with">Con evidencia</option>
            <option value="without">Sin evidencia</option>
            <option value="pending">Evidencia pendiente</option>
          </select>
        </div>
        {isStale && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Los filtros del reporte cambiaron. Vuelve a generar para actualizar los resultados.
          </p>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={() => void runReport()} disabled={isLoading || isLoadingCatalogs}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
            {isLoading ? "Generando..." : isLoadingCatalogs ? "Cargando catálogos..." : "Generar reporte"}
          </button>
          {hasRun && sortedRows.length > 0 && (
            <button type="button" onClick={doExport} disabled={isStale}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
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
            <TableSkeleton cols={7} />
          ) : sortedRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              Sin resultados. Intenta ampliar el rango de fechas o ajustar los filtros.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100">
                  <tr>
                    <SortTh label="Tipo"         field="type"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Activista"    field="activistName"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Tipo Apoyo"   field="aidTypeName"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Cantidad"     field="quantity"      sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Destinatario" field="recipientName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="CURP"         field="curp"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.type === "Interna" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"
                        }`}>{r.type}</span>
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-900">{r.activistName}</td>
                      <td className="px-5 py-3 text-slate-600">{r.aidTypeName}</td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatQuantity(r.quantity, r.unit)}</td>
                      <td className="px-5 py-3 text-slate-600 max-w-[180px] truncate" title={r.recipientName || undefined}>
                        {r.recipientName || "—"}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">{r.curp}</td>
                      <td className="px-5 py-3">
                        <button type="button" onClick={() => setSelectedRow(r)}
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {selectedRow && (
        <DeliveryDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </section>
  );
}

function DeliveryDetailModal({ row, onClose }: { row: Row; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Detalle de entrega</h3>
            <p className="text-sm text-slate-500">{fmtDateTime(row.date)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl font-bold leading-none text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailItem label="Tipo" value={row.type} />
          <DetailItem label="Activista" value={row.activistName} />
          <DetailItem label="Nivel" value={row.levelName} />
          <DetailItem label="CURP" value={row.curp} mono />
          <DetailItem label="Tipo de apoyo" value={row.aidTypeName} />
          <DetailItem label="Cantidad" value={formatQuantity(row.quantity, row.unit)} />
          <DetailItem label="Destinatario" value={row.recipientName || "—"} />
          <DetailItem label="Estado" value={row.status === "synced" ? "Sincronizado" : row.status === "pending_sync" ? "Pendiente" : row.status || "—"} />
          <DetailItem label="Comentario" value={row.comment || "—"} />
          <DetailItem label="Ubicación" value={row.locationMissing ? row.locationMissingReason || "Sin ubicación" : "Disponible"} />
        </div>
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Evidencias</p>
          <div className="flex flex-wrap gap-3">
            {row.evidenceUrls.length > 0 ? row.evidenceUrls.map((url, index) => (
              <ReportImageCell key={url} imageUrl={url} label={`Evidencia ${index + 1} de entrega ${row.id}`} />
            )) : (
              <ReportImageCell imageUrl={null} label={`Evidencia de entrega ${row.id}`} pending={row.status === "pending_sync"} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-sm text-slate-700 ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
