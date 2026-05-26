"use client";

import { collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { ReportImageCell } from "@/components/reports/report-image-cell";
import { ReportShell } from "@/components/reports/ReportShell";
import { SortTh } from "@/components/reports/sort-th";
import { TableSkeleton } from "@/components/reports/table-skeleton";
import { useReportSort } from "@/hooks/useReportSort";
import { getFirestoreDb, getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import {
  computeDateRange,
  exportToCsv,
  fmtDate,
  fmtDateTime,
  parseTimestamp,
  type DatePreset,
} from "@/lib/report-utils";

type CredentialStatus = "complete" | "pending" | "none";
type ActiveFilter = "all" | "active" | "inactive";
type IneFilter = "all" | "complete" | "incomplete" | "pending" | "none";
type ActivistOption = { id: string; name: string; levelId: string; levelName: string };
type LevelOption = { id: string; name: string; rank: number };
type CommunityOption = { id: string; name: string };

type Row = {
  id: string;
  createdAt: Date | null;
  name: string;
  phone: string;
  curp: string;
  birthDate: Date | null;
  activistId: string;
  activistName: string;
  levelId: string;
  levelName: string;
  communityId: string;
  communityName: string;
  active: boolean;
  activeLabel: string;
  credentialStatus: CredentialStatus;
  credentialLabel: string;
  credentialFrontUrl: string | null;
  credentialBackUrl: string | null;
  pendingCredentialFront: boolean;
  pendingCredentialBack: boolean;
};

const CREDENTIAL_LABELS: Record<CredentialStatus, string> = {
  complete: "Con credencial",
  pending: "Pendiente",
  none: "Sin credencial",
};

function getCredentialStatus(frontUrl: unknown, pendingFront: unknown, pendingBack: unknown): CredentialStatus {
  if (frontUrl) return "complete";
  if (Boolean(pendingFront) || Boolean(pendingBack)) return "pending";
  return "none";
}

export default function PromotedReportPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars = getMissingFirebaseEnvVars();

  const [preset, setPreset] = useState<DatePreset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activistId, setActivistId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [credentialFilter, setCredentialFilter] = useState<"" | CredentialStatus>("");
  const [ineFilter, setIneFilter] = useState<IneFilter>("all");

  const [rows, setRows] = useState<Row[]>([]);
  const [activistOptions, setActivistOptions] = useState<ActivistOption[]>([]);
  const [levelOptions, setLevelOptions] = useState<LevelOption[]>([]);
  const [communityOptions, setCommunityOptions] = useState<CommunityOption[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  function markStale() {
    if (hasRun) setIsStale(true);
  }

  useEffect(() => {
    if (!isConfigured) return;
    const db = getFirestoreDb();
    if (!db) return;

    Promise.all([
      getDocs(collection(db, "OrgMembers")),
      getDocs(collection(db, "OrgLevels")),
      getDocs(collection(db, "Communities")),
    ]).then(([membersSnap, levelsSnap, communitiesSnap]) => {
      const levelMap = new Map(levelsSnap.docs.map((d) => [
        d.id,
        { name: (d.get("name") as string) || d.id, rank: (d.get("rank") as number) || 0 },
      ]));

      setLevelOptions(
        levelsSnap.docs
          .map((d) => ({ id: d.id, name: (d.get("name") as string) || d.id, rank: (d.get("rank") as number) || 0 }))
          .sort((a, b) => a.rank - b.rank),
      );
      setActivistOptions(
        membersSnap.docs
          .map((d) => {
            const levelId = (d.get("levelId") as string) || "";
            return {
              id: d.id,
              name: (d.get("name") as string) || "—",
              levelId,
              levelName: levelMap.get(levelId)?.name ?? "—",
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
      setCommunityOptions(
        communitiesSnap.docs
          .map((d) => ({ id: d.id, name: (d.get("name") as string) || d.id }))
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
    }).catch((e) => setError((e as Error).message))
      .finally(() => setIsLoadingCatalogs(false));
  }, [isConfigured]);

  const filteredRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.curp.toLowerCase().includes(q) && !r.phone.toLowerCase().includes(q))
        return false;
      if (activistId && r.activistId !== activistId) return false;
      if (levelId && r.levelId !== levelId) return false;
      if (communityId && r.communityId !== communityId) return false;
      if (activeFilter === "active" && !r.active) return false;
      if (activeFilter === "inactive" && r.active) return false;
      if (credentialFilter && r.credentialStatus !== credentialFilter) return false;
      if (ineFilter === "complete") return Boolean(r.credentialFrontUrl && r.credentialBackUrl);
      if (ineFilter === "incomplete") return Boolean(r.credentialFrontUrl || r.credentialBackUrl) && !(r.credentialFrontUrl && r.credentialBackUrl);
      if (ineFilter === "pending") return Boolean(r.pendingCredentialFront || r.pendingCredentialBack);
      if (ineFilter === "none") return !r.credentialFrontUrl && !r.credentialBackUrl && !r.pendingCredentialFront && !r.pendingCredentialBack;
      return true;
    });
  }, [rows, searchText, activistId, levelId, communityId, activeFilter, credentialFilter, ineFilter]);

  const { sortKey, sortDir, toggleSort, sortedRows } = useReportSort<Row>(filteredRows, "createdAt");

  async function runReport() {
    const db = getFirestoreDb();
    if (!db || isLoadingCatalogs) return;
    setIsLoading(true);
    setError(null);
    try {
      const { start, end } = computeDateRange(preset, customStart, customEnd);
      const s = Timestamp.fromDate(start);
      const e = Timestamp.fromDate(end);

      const promotedSnap = await getDocs(
        query(collection(db, "Promoted"), where("createdAt", ">=", s), where("createdAt", "<=", e)),
      );
      const memberMap = new Map(activistOptions.map((a) => [a.id, a]));
      const communityMap = new Map(communityOptions.map((c) => [c.id, c.name]));

      setRows(promotedSnap.docs.map((d) => {
        const activist = memberMap.get((d.get("activistId") as string) || "");
        const community = (d.get("communityId") as string) || "";
        const credentialStatus = getCredentialStatus(
          d.get("credentialFrontUrl"),
          d.get("pendingCredentialFront"),
          d.get("pendingCredentialBack"),
        );
        const credentialFrontUrl = (d.get("credentialFrontUrl") as string) || null;
        const credentialBackUrl = (d.get("credentialBackUrl") as string) || null;

        return {
          id: d.id,
          createdAt: parseTimestamp(d.get("createdAt")),
          name: (d.get("name") as string) || "—",
          phone: (d.get("phone") as string) || "",
          curp: (d.get("curp") as string) || "",
          birthDate: parseTimestamp(d.get("birthDate")),
          activistId: (d.get("activistId") as string) || "",
          activistName: activist?.name ?? "—",
          levelId: activist?.levelId ?? "",
          levelName: activist?.levelName ?? "—",
          communityId: community,
          communityName: community ? (communityMap.get(community) ?? "—") : "—",
          active: (d.get("active") as boolean) ?? true,
          activeLabel: ((d.get("active") as boolean) ?? true) ? "Activo" : "Inactivo",
          credentialStatus,
          credentialLabel: CREDENTIAL_LABELS[credentialStatus],
          credentialFrontUrl,
          credentialBackUrl,
          pendingCredentialFront: Boolean(d.get("pendingCredentialFront")),
          pendingCredentialBack: Boolean(d.get("pendingCredentialBack")),
        };
      }));
      setHasRun(true);
      setIsStale(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  function doExport() {
    exportToCsv(
      "promovidos.csv",
      ["Fecha registro", "Nombre", "Telefono", "CURP", "Fecha nacimiento", "Activista", "Nivel", "Comunidad", "Estado", "Credencial", "INE frente", "INE reverso"],
      sortedRows.map((r) => [
        fmtDateTime(r.createdAt),
        r.name,
        r.phone,
        r.curp,
        fmtDate(r.birthDate),
        r.activistName,
        r.levelName,
        r.communityName,
        r.activeLabel,
        r.credentialLabel,
        r.credentialFrontUrl ?? "",
        r.credentialBackUrl ?? "",
      ]),
    );
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <>
      <ReportShell
        title="Reporte de Promovidos"
        description="Listado de personas promovidas registradas por periodo, activista, nivel y comunidad."
        error={error}
        isLoading={isLoading}
        generateLabel={isLoadingCatalogs ? "Cargando catálogos..." : undefined}
        hasRun={hasRun}
        rowCount={sortedRows.length}
        rowLabel={["promovido", "promovidos"]}
        onGenerate={() => void runReport()}
        onExport={doExport}
        exportDisabled={isStale}
        filters={
          <>
            <DateRangeFilter
              preset={preset} customStart={customStart} customEnd={customEnd}
              onPreset={(value) => { setPreset(value); markStale(); }}
              onStart={(value) => { setCustomStart(value); markStale(); }}
              onEnd={(value) => { setCustomEnd(value); markStale(); }}
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar por nombre, teléfono o CURP"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400"
              />
              <select value={activistId} onChange={(e) => setActivistId(e.target.value)}
                disabled={isLoadingCatalogs}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50">
                <option value="">{isLoadingCatalogs ? "Cargando activistas..." : "Todos los activistas"}</option>
                {activistOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={levelId} onChange={(e) => setLevelId(e.target.value)}
                disabled={isLoadingCatalogs}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50">
                <option value="">{isLoadingCatalogs ? "Cargando niveles..." : "Todos los niveles"}</option>
                {levelOptions.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <select value={communityId} onChange={(e) => setCommunityId(e.target.value)}
                disabled={isLoadingCatalogs}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50">
                <option value="">{isLoadingCatalogs ? "Cargando comunidades..." : "Todas las comunidades"}</option>
                {communityOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
                <option value="all">Activos e inactivos</option>
                <option value="active">Solo activos</option>
                <option value="inactive">Solo inactivos</option>
              </select>
              <select value={credentialFilter} onChange={(e) => setCredentialFilter(e.target.value as "" | CredentialStatus)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
                <option value="">Todas las credenciales</option>
                <option value="complete">Con credencial</option>
                <option value="pending">Pendiente</option>
                <option value="none">Sin credencial</option>
              </select>
              <select value={ineFilter} onChange={(e) => setIneFilter(e.target.value as IneFilter)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
                <option value="all">Todas las INE</option>
                <option value="complete">INE completa</option>
                <option value="incomplete">INE incompleta</option>
                <option value="pending">INE pendiente</option>
                <option value="none">Sin INE</option>
              </select>
            </div>
            {isStale && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                El periodo del reporte cambió. Vuelve a generar para actualizar los resultados.
              </p>
            )}
          </>
        }
      >
        {isLoading ? (
          <TableSkeleton cols={9} />
        ) : sortedRows.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            Sin promovidos que coincidan con el periodo o los filtros activos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100">
                <tr>
                  <SortTh label="Nombre"     field="name"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                  <SortTh label="Teléfono"   field="phone"         sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                  <SortTh label="CURP"       field="curp"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                  <SortTh label="Nacimiento" field="birthDate"     sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                  <SortTh label="Activista"  field="activistName"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                  <SortTh label="Nivel"      field="levelName"     sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                  <SortTh label="Comunidad"  field="communityName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                  <SortTh label="Estado"     field="activeLabel"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{r.name}</td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{r.phone || "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{r.curp || "—"}</td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{fmtDate(r.birthDate)}</td>
                    <td className="px-5 py-3 text-slate-600">{r.activistName}</td>
                    <td className="px-5 py-3 text-slate-600">{r.levelName}</td>
                    <td className="px-5 py-3 text-slate-600">{r.communityName}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {r.activeLabel}
                      </span>
                    </td>
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
      </ReportShell>
      {selectedRow && (
        <PromotedDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </>
  );
}

function PromotedDetailModal({ row, onClose }: { row: Row; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Detalle de promovido</h3>
            <p className="text-sm text-slate-500">Registrado {fmtDateTime(row.createdAt)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl font-bold leading-none text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailItem label="Nombre" value={row.name} />
          <DetailItem label="Teléfono" value={row.phone || "—"} />
          <DetailItem label="CURP" value={row.curp || "—"} />
          <DetailItem label="Fecha nacimiento" value={fmtDate(row.birthDate)} />
          <DetailItem label="Activista" value={row.activistName} />
          <DetailItem label="Nivel" value={row.levelName} />
          <DetailItem label="Comunidad" value={row.communityName} />
          <DetailItem label="Estado" value={row.activeLabel} />
          <DetailItem label="Credencial" value={row.credentialLabel} />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">INE frente</p>
            <ReportImageCell imageUrl={row.credentialFrontUrl} label={`INE frente de ${row.name}`} pending={row.pendingCredentialFront} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">INE reverso</p>
            <ReportImageCell imageUrl={row.credentialBackUrl} label={`INE reverso de ${row.name}`} pending={row.pendingCredentialBack} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value}</p>
    </div>
  );
}
