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
  fmtDate,
  parseTimestamp,
  sortRows,
  type DatePreset,
} from "@/lib/report-utils";

type MemberBasic = {
  id: string;
  name: string;
  levelId: string;
  levelRank: number;
  levelName: string;
  path: string[];
  active: boolean;
};

type LevelOption = { id: string; name: string; rank: number };

type Row = {
  id: string;
  name: string;
  levelName: string;
  levelRank: number;
  directCount: number;
  indirectCount: number;
  promotedCount: number;
  lastActivity: Date | null;
};

type SortKey = keyof Row;
type BranchMode = "all" | "level" | "member";

const MODE_LABELS: { value: BranchMode; label: string }[] = [
  { value: "all",    label: "Todos"       },
  { value: "level",  label: "Por nivel"   },
  { value: "member", label: "Por miembro" },
];


export default function BranchReportPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars  = getMissingFirebaseEnvVars();

  const [allMembers,    setAllMembers]    = useState<MemberBasic[]>([]);
  const [orgLevels,     setOrgLevels]     = useState<LevelOption[]>([]);
  const [isLoadingBase, setIsLoadingBase] = useState(() => isConfigured);

  const [mode,            setMode]            = useState<BranchMode>("all");
  const [selectedLevelId, setSelectedLevelId] = useState("");
  const [memberSearch,    setMemberSearch]    = useState("");
  const [selectedMember,  setSelectedMember]  = useState<MemberBasic | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [preset,          setPreset]          = useState<DatePreset>("30d");
  const [customStart,     setCustomStart]     = useState("");
  const [customEnd,       setCustomEnd]       = useState("");
  const [includePromoted, setIncludePromoted] = useState(false);

  const [rows,      setRows]      = useState<Row[]>([]);
  const [sortKey,   setSortKey]   = useState<SortKey>("levelRank");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("asc");
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
      getDocs(collection(db, "OrgMembers")),
      getDocs(collection(db, "OrgLevels")),
    ]).then(([membersSnap, levelsSnap]) => {
      const levelMap = new Map(levelsSnap.docs.map((d) => [
        d.id,
        { name: (d.get("name") as string) || d.id, rank: (d.get("rank") as number) || 0 },
      ]));
      const levels = levelsSnap.docs
        .map((d) => ({ id: d.id, name: (d.get("name") as string) || d.id, rank: (d.get("rank") as number) || 0 }))
        .sort((a, b) => a.rank - b.rank);
      setOrgLevels(levels);
      setAllMembers(membersSnap.docs.map((d) => {
        const lid = (d.get("levelId") as string) || "";
        const lv  = levelMap.get(lid) ?? { name: "—", rank: 999 };
        return {
          id: d.id, name: (d.get("name") as string) || "—",
          levelId: lid, levelRank: lv.rank, levelName: lv.name,
          path: (d.get("path") as string[]) || [],
          active: (d.get("active") as boolean) ?? true,
        };
      }));
    }).catch((e) => setError((e as Error).message))
      .finally(() => setIsLoadingBase(false));
  }, [isConfigured]);

  const suggestions = useMemo(() => {
    if (mode !== "member") return [];
    if (!memberSearch.trim() || memberSearch === selectedMember?.name) return [];
    const q = memberSearch.toLowerCase();
    return allMembers.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mode, memberSearch, selectedMember, allMembers]);

  function isReady(): boolean {
    if (isLoading || isLoadingBase) return false;
    if (mode === "level")  return !!selectedLevelId;
    if (mode === "member") return !!selectedMember;
    return true;
  }

  async function runReport() {
    const db = getFirestoreDb();
    if (!db || !isReady()) return;
    setIsLoading(true);
    setError(null);
    try {
      const { start, end } = computeDateRange(preset, customStart, customEnd);
      const s = Timestamp.fromDate(start);
      const e = Timestamp.fromDate(end);

      let branchMembers: MemberBasic[];
      if (mode === "all") {
        branchMembers = allMembers;
      } else if (mode === "level") {
        const selectedLevel = orgLevels.find((l) => l.id === selectedLevelId);
        const rank = selectedLevel?.rank ?? 0;
        branchMembers = allMembers.filter((m) => m.levelRank >= rank);
      } else {
        const rootId = selectedMember!.id;
        branchMembers = [
          selectedMember!,
          ...allMembers.filter((m) => m.id !== rootId && m.path.includes(rootId)),
        ];
      }
      branchMembers = Array.from(new Map(branchMembers.map((m) => [m.id, m])).values());

      const memberIds = new Set(branchMembers.map((m) => m.id));

      const [directSnap, indirectSnap] = await Promise.all([
        getDocs(query(collection(db, "DirectDeliveries"),   where("createdAt", ">=", s), where("createdAt", "<=", e))),
        getDocs(query(collection(db, "IndirectDeliveries"), where("createdAt", ">=", s), where("createdAt", "<=", e))),
      ]);

      const directCounts   = new Map<string, number>();
      const indirectCounts = new Map<string, number>();
      const promotedCounts = new Map<string, number>();
      const lastActivity   = new Map<string, Date>();

      function bump(map: Map<string, number>, id: string) {
        if (!memberIds.has(id)) return;
        map.set(id, (map.get(id) ?? 0) + 1);
      }
      function touch(id: string, d: Date | null) {
        if (!d || !memberIds.has(id)) return;
        const prev = lastActivity.get(id);
        if (!prev || d > prev) lastActivity.set(id, d);
      }

      directSnap.docs.forEach((d) => {
        const id = (d.get("fromOrgId") as string) || (d.get("orgMemberId") as string) || "";
        bump(directCounts, id); touch(id, parseTimestamp(d.get("createdAt")));
      });
      indirectSnap.docs.forEach((d) => {
        const id = (d.get("orgMemberId") as string) || "";
        bump(indirectCounts, id); touch(id, parseTimestamp(d.get("createdAt")));
      });

      if (includePromoted) {
        const promotedSnap = await getDocs(
          query(collection(db, "Promoted"), where("createdAt", ">=", s), where("createdAt", "<=", e)),
        );
        promotedSnap.docs.forEach((d) => {
          const id = (d.get("activistId") as string) || "";
          bump(promotedCounts, id); touch(id, parseTimestamp(d.get("createdAt")));
        });
      }

      setRows(branchMembers.map((m) => ({
        id: m.id, name: m.name, levelName: m.levelName, levelRank: m.levelRank,
        directCount:   directCounts.get(m.id)   ?? 0,
        indirectCount: indirectCounts.get(m.id) ?? 0,
        promotedCount: promotedCounts.get(m.id) ?? 0,
        lastActivity:  lastActivity.get(m.id) ?? null,
      })));
      setHasRun(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  function doExport() {
    const headers = ["Nombre", "Nivel", "Entrega interna", "Entrega externa"];
    if (includePromoted) headers.push("Promovidos");
    headers.push("Última Actividad");
    exportToCsv(
      "rama-jerarquica.csv",
      headers,
      sortedRows.map((r) => {
        const row = [r.name, r.levelName, String(r.directCount), String(r.indirectCount)];
        if (includePromoted) row.push(String(r.promotedCount));
        row.push(fmtDate(r.lastActivity));
        return row;
      }),
    );
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Rama Jerárquica</h2>
        <p className="mt-2 text-sm text-slate-600">
          Actividad operativa de los miembros organizacionales con opciones de alcance.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        {/* Mode selector */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Alcance</p>
          <div className="flex divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 w-fit">
            {MODE_LABELS.map((m) => (
              <button key={m.value} type="button"
                onClick={() => { setMode(m.value); setHasRun(false); }}
                className={`px-4 py-1.5 text-sm font-medium transition ${
                  mode === m.value ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}>{m.label}</button>
            ))}
          </div>
        </div>

        {mode === "level" && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Nivel (incluye todos los niveles inferiores)
            </p>
            <select value={selectedLevelId} onChange={(e) => setSelectedLevelId(e.target.value)}
              disabled={isLoadingBase}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50">
              <option value="">Selecciona un nivel…</option>
              {orgLevels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}

        {mode === "member" && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Miembro raíz</p>
            <div className="relative max-w-sm">
              <input type="text"
                placeholder={isLoadingBase ? "Cargando miembros…" : "Buscar por nombre…"}
                disabled={isLoadingBase}
                value={memberSearch}
                onChange={(e) => { setMemberSearch(e.target.value); setSelectedMember(null); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 disabled:opacity-50"
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                  {suggestions.map((m) => (
                    <li key={m.id}>
                      <button type="button"
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                        onMouseDown={() => { setSelectedMember(m); setMemberSearch(m.name); setShowSuggestions(false); }}>
                        <span className="font-medium text-slate-900">{m.name}</span>
                        <span className="text-xs text-slate-400">{m.levelName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedMember && (
              <p className="text-xs text-slate-500">
                Rama de <span className="font-medium text-slate-700">{selectedMember.name}</span> ({selectedMember.levelName})
              </p>
            )}
          </div>
        )}

        <DateRangeFilter
          preset={preset} customStart={customStart} customEnd={customEnd}
          onPreset={setPreset} onStart={setCustomStart} onEnd={setCustomEnd}
        />

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={includePromoted}
            onChange={(e) => { setIncludePromoted(e.target.checked); setHasRun(false); }}
            className="rounded border-slate-300" />
          Incluir conteo de promovidos registrados
        </label>

        <div className="flex gap-3">
          <button type="button" onClick={() => void runReport()} disabled={!isReady()}
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
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-700">
              {sortedRows.length} {sortedRows.length === 1 ? "miembro" : "miembros"}
            </p>
          </div>
          {isLoading ? (
            <TableSkeleton cols={includePromoted ? 6 : 5} />
          ) : sortedRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              Sin resultados. Intenta cambiar el alcance o ampliar el rango de fechas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100">
                  <tr>
                    <SortTh label="Nombre"         field="name"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Nivel"          field="levelRank"     sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                    <SortTh label="Con benef."     field="directCount"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                    <SortTh label="Sin benef."     field="indirectCount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                    {includePromoted && <SortTh label="Promovidos" field="promotedCount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />}
                    <SortTh label="Últ. actividad" field="lastActivity"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{r.name}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {r.levelName}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-blue-700">{r.directCount}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-violet-700">{r.indirectCount}</td>
                      {includePromoted && (
                        <td className="px-5 py-3 text-right tabular-nums text-emerald-700">{r.promotedCount}</td>
                      )}
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{fmtDate(r.lastActivity)}</td>
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
