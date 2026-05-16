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
  fmtDate,
  fmtDateTime,
  parseTimestamp,
  sortRows,
  type DatePreset,
} from "@/lib/report-utils";

type CredentialStatus = "complete" | "pending" | "none";
type ActiveFilter = "all" | "active" | "inactive";
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

type SortKey = keyof Row;

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

function CredentialBadge({ status }: { status: CredentialStatus }) {
  if (status === "complete") {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Con credencial
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      Sin credencial
    </span>
  );
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

  const [rows, setRows] = useState<Row[]>([]);
  const [activistOptions, setActivistOptions] = useState<ActivistOption[]>([]);
  const [levelOptions, setLevelOptions] = useState<LevelOption[]>([]);
  const [communityOptions, setCommunityOptions] = useState<CommunityOption[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function toggleSort(field: SortKey) {
    if (sortKey === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(field);
      setSortDir(field === "createdAt" ? "desc" : "asc");
    }
  }

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
      return true;
    });
  }, [rows, searchText, activistId, levelId, communityId, activeFilter, credentialFilter]);

  const sortedRows = useMemo(
    () => sortRows(filteredRows, sortKey, sortDir),
    [filteredRows, sortKey, sortDir],
  );

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
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Reporte de Promovidos</h2>
        <p className="mt-2 text-sm text-slate-600">
          Listado de personas promovidas registradas por periodo, activista, nivel y comunidad.
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
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => void runReport()} disabled={isLoading || isLoadingCatalogs}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
            {isLoading ? "Generando..." : isLoadingCatalogs ? "Cargando catálogos..." : "Generar reporte"}
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
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-700">
              {sortedRows.length} {sortedRows.length === 1 ? "promovido" : "promovidos"}
            </p>
          </div>
          {isLoading ? (
            <TableSkeleton cols={12} />
          ) : sortedRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              Sin promovidos que coincidan con el periodo o los filtros activos.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100">
                  <tr>
                    <SortTh label="Registro" field="createdAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Nombre" field="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Teléfono" field="phone" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="CURP" field="curp" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Nacimiento" field="birthDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Activista" field="activistName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Nivel" field="levelName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Comunidad" field="communityName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Estado" field="activeLabel" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Credencial" field="credentialLabel" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">INE frente</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">INE reverso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
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
                        <CredentialBadge status={r.credentialStatus} />
                      </td>
                      <td className="px-5 py-3">
                        <ReportImageCell
                          imageUrl={r.credentialFrontUrl}
                          label={`INE frente de ${r.name}`}
                          pending={r.pendingCredentialFront}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <ReportImageCell
                          imageUrl={r.credentialBackUrl}
                          label={`INE reverso de ${r.name}`}
                          pending={r.pendingCredentialBack}
                        />
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
