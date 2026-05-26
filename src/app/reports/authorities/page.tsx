"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { getFirestoreDb } from "@/lib/firebase";
import { exportToCsv } from "@/lib/report-utils";
import type { Authority, City, Community } from "@/types/shared";

type AuthoritySlot = { label: string; authority: Authority };

const AUTHORITY_SLOTS: { label: string; key: keyof Community }[] = [
  { label: "Delegado",         key: "delegateId"           },
  { label: "Sub Delegado",     key: "subDelegateId"        },
  { label: "Comisario Ejidal", key: "ejidalCommissionerId" },
];

export default function AuthoritiesReportPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars  = getMissingFirebaseEnvVars();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [cities,      setCities]      = useState<City[]>([]);
  const [search,      setSearch]      = useState("");
  const [cityFilter,  setCityFilter]  = useState("");
  const [selectedId,  setSelectedId]  = useState<string | null>(null);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db) return;

    const u1 = onSnapshot(query(collection(db, "Communities"), orderBy("name", "asc")), (snap) =>
      setCommunities(snap.docs.map((d) => ({
        id:                   d.id,
        name:                 d.get("name")                 || "",
        cityId:               d.get("cityId")               || null,
        delegateId:           d.get("delegateId")           || null,
        subDelegateId:        d.get("subDelegateId")        || null,
        ejidalCommissionerId: d.get("ejidalCommissionerId") || null,
      })))
    );

    const u2 = onSnapshot(query(collection(db, "Authorities"), orderBy("name", "asc")), (snap) =>
      setAuthorities(snap.docs.map((d) => ({
        id:        d.id,
        type:      d.get("type")      || "delegate",
        name:      d.get("name")      || "",
        phone:     d.get("phone")     || "",
        curp:      d.get("curp")      || "",
        birthDate: d.get("birthDate") || "",
      })))
    );

    const u3 = onSnapshot(query(collection(db, "Cities"), orderBy("name", "asc")), (snap) =>
      setCities(snap.docs.map((d) => ({
        id:                   d.id,
        name:                 d.get("name")  || "",
        state:                d.get("state") || "",
        delegateId:           null,
        subDelegateId:        null,
        mayorId:              null,
        ejidalCommissionerId: null,
      })))
    );

    return () => { u1(); u2(); u3(); };
  }, []);

  const authorityMap = useMemo(() => new Map(authorities.map((a) => [a.id, a])), [authorities]);
  const cityMap      = useMemo(() => new Map(cities.map((c) => [c.id, c])),      [cities]);

  const filteredCommunities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return communities.filter((c) => {
      const matchSearch = !q || c.name.toLowerCase().includes(q);
      const matchCity   = !cityFilter || c.cityId === cityFilter;
      return matchSearch && matchCity;
    });
  }, [communities, search, cityFilter]);

  const selectedCommunity = useMemo(
    () => communities.find((c) => c.id === selectedId) ?? null,
    [communities, selectedId]
  );

  function cityLabel(c: Community): string {
    if (!c.cityId) return "—";
    const city = cityMap.get(c.cityId);
    return city ? `${city.name} (${city.state})` : "—";
  }

  function authorityInfo(id: string | null): { name: string; phone: string } {
    if (!id) return { name: "—", phone: "" };
    const a = authorityMap.get(id);
    return { name: a?.name ?? "—", phone: a?.phone ?? "" };
  }

  function getSlots(c: Community): AuthoritySlot[] {
    return AUTHORITY_SLOTS.flatMap(({ label, key }) => {
      const id = c[key] as string | null;
      if (!id) return [];
      const authority = authorityMap.get(id);
      return authority ? [{ label, authority }] : [];
    });
  }

  function doExport() {
    exportToCsv(
      "autoridades-por-comunidad.csv",
      [
        "Comunidad", "Ciudad",
        "Delegado", "Tel. Delegado",
        "Sub Delegado", "Tel. Sub Delegado",
        "Comisario Ejidal", "Tel. Comisario Ejidal",
      ],
      filteredCommunities.map((c) => {
        const d  = authorityInfo(c.delegateId);
        const sd = authorityInfo(c.subDelegateId);
        const ec = authorityInfo(c.ejidalCommissionerId);
        return [
          c.name, cityLabel(c),
          d.name,  d.phone,
          sd.name, sd.phone,
          ec.name, ec.phone,
        ];
      })
    );
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  const selectedSlots = selectedCommunity ? getSlots(selectedCommunity) : [];

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Autoridades por Comunidad</h2>
        <p className="mt-2 text-sm text-slate-600">
          Consulta rápida de autoridades asignadas. Selecciona una comunidad para ver el detalle de contacto.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.3fr_0.7fr]">

        {/* ── Tabla ── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Comunidades</h3>
              <p className="text-sm text-slate-600">
                Haz clic en una fila para ver el detalle de sus autoridades.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {filteredCommunities.length} registros
              </span>
              {filteredCommunities.length > 0 && (
                <button
                  type="button"
                  onClick={doExport}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Exportar CSV
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Buscar
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre de comunidad"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Filtrar por ciudad
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
              >
                <option value="">Todas las ciudades</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.state})</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Comunidad</th>
                  <th className="px-4 py-3 font-medium">Ciudad</th>
                  <th className="px-4 py-3 font-medium">Delegado</th>
                  <th className="px-4 py-3 font-medium">Sub Delegado</th>
                  <th className="px-4 py-3 font-medium">Comisario Ejidal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredCommunities.map((community) => {
                  const isSelected = community.id === selectedId;
                  const muted  = isSelected ? "text-slate-300" : "text-slate-600";
                  const subtle = isSelected ? "text-slate-400" : "text-slate-400";

                  function AuthorityCell({ id }: { id: string | null }) {
                    const { name, phone } = authorityInfo(id);
                    return (
                      <td className={`px-4 py-3 ${muted}`}>
                        <span>{name}</span>
                        {phone && (
                          <span className={`block text-xs mt-0.5 ${subtle}`}>{phone}</span>
                        )}
                      </td>
                    );
                  }

                  return (
                    <tr
                      key={community.id}
                      onClick={() => setSelectedId(isSelected ? null : community.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-slate-900" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className={`px-4 py-3 font-medium ${isSelected ? "text-white" : "text-slate-900"}`}>
                        {community.name}
                      </td>
                      <td className={`px-4 py-3 ${muted}`}>{cityLabel(community)}</td>
                      <AuthorityCell id={community.delegateId} />
                      <AuthorityCell id={community.subDelegateId} />
                      <AuthorityCell id={community.ejidalCommissionerId} />
                    </tr>
                  );
                })}
                {filteredCommunities.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      {search || cityFilter
                        ? "Sin comunidades que coincidan con los filtros activos."
                        : "No hay comunidades registradas."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        {/* ── Panel de detalle ── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          {selectedCommunity ? (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{selectedCommunity.name}</h3>
                  <p className="mt-0.5 text-sm text-slate-500">{cityLabel(selectedCommunity)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="shrink-0 text-sm text-slate-400 hover:text-slate-700"
                >
                  Cerrar
                </button>
              </div>

              {selectedSlots.length > 0 ? (
                <div className="mt-6 space-y-3">
                  {selectedSlots.map(({ label, authority }) => (
                    <div key={authority.id} className="rounded-lg border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {label}
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">{authority.name}</p>
                      {authority.phone && (
                        <a
                          href={`tel:${authority.phone}`}
                          className="mt-1 block text-sm text-blue-600 hover:underline"
                        >
                          {authority.phone}
                        </a>
                      )}
                      {authority.curp && (
                        <p className="mt-1 font-mono text-xs text-slate-400">{authority.curp}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-10 text-center text-sm text-slate-400">
                  Esta comunidad no tiene autoridades asignadas.
                </p>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-medium text-slate-500">Selecciona una comunidad</p>
              <p className="text-xs text-slate-400">
                Haz clic en una fila de la tabla para ver el detalle de contacto de sus autoridades.
              </p>
            </div>
          )}
        </article>

      </div>
    </section>
  );
}
