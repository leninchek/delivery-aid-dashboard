"use client";

/* eslint-disable @next/next/no-img-element */
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { getFirestoreDb, getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { fmtBirthDate } from "@/lib/report-utils";

type PromotedPerson = {
  id: string;
  name: string;
  phone: string;
  curp: string;
  birthDate: unknown;
  activistId: string;
  communityId: string | null;
  credentialFrontUrl: string | null;
  credentialBackUrl: string | null;
  pendingCredentialFront: boolean;
  pendingCredentialBack: boolean;
};

type NamedEntity = { id: string; name: string };

type CredentialFilter = "all" | "complete" | "pending" | "none";


function getCredentialStatus(p: PromotedPerson): "complete" | "pending" | "none" {
  if (p.credentialFrontUrl) return "complete";
  if (p.pendingCredentialFront || p.pendingCredentialBack) return "pending";
  return "none";
}

const CREDENTIAL_LABELS: Record<CredentialFilter, string> = {
  all: "Todas",
  complete: "Con credencial",
  pending: "Pendiente de sincronizar",
  none: "Sin credencial",
};

export default function PromotidosPage() {
  const [promoted, setPromoted] = useState<PromotedPerson[]>([]);
  const [members, setMembers] = useState<NamedEntity[]>([]);
  const [communities, setCommunities] = useState<NamedEntity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PromotedPerson | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [activistFilter, setActivistFilter] = useState("");
  const [communityFilter, setCommunityFilter] = useState("");
  const [credentialFilter, setCredentialFilter] = useState<CredentialFilter>("all");

  const isConfigured = hasFirebaseConfig();
  const missingVars = getMissingFirebaseEnvVars();

  useEffect(() => {
    if (!isConfigured) return;
    const db = getFirestoreDb();
    if (!db) return;

    const unsubPromoted = onSnapshot(
      query(collection(db, "Promoted"), where("active", "==", true)),
      (snap) => {
        setPromoted(
          snap.docs
            .map((d) => ({
              id: d.id,
              name: d.get("name") || "",
              phone: d.get("phone") || "",
              curp: d.get("curp") || "",
              birthDate: d.get("birthDate"),
              activistId: d.get("activistId") || "",
              communityId: d.get("communityId") || null,
              credentialFrontUrl: d.get("credentialFrontUrl") || null,
              credentialBackUrl: d.get("credentialBackUrl") || null,
              pendingCredentialFront: Boolean(d.get("pendingCredentialFront")),
              pendingCredentialBack: Boolean(d.get("pendingCredentialBack")),
            }))
            .sort((a, b) => a.name.localeCompare(b.name, "es"))
        );
      },
      (err) => setError(err.message)
    );

    const unsubMembers = onSnapshot(
      query(collection(db, "OrgMembers"), orderBy("name", "asc")),
      (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, name: d.get("name") || "" }))),
      (err) => setError(err.message)
    );

    const unsubCommunities = onSnapshot(
      query(collection(db, "Communities"), orderBy("name", "asc")),
      (snap) =>
        setCommunities(snap.docs.map((d) => ({ id: d.id, name: d.get("name") || "" }))),
      (err) => setError(err.message)
    );

    return () => {
      unsubPromoted();
      unsubMembers();
      unsubCommunities();
    };
  }, [isConfigured]);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const communityById = useMemo(
    () => new Map(communities.map((c) => [c.id, c.name])),
    [communities]
  );

  const filtered = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    return promoted.filter((p) => {
      if (text && !p.name.toLowerCase().includes(text) && !p.curp.toLowerCase().includes(text))
        return false;
      if (activistFilter && p.activistId !== activistFilter) return false;
      if (communityFilter && p.communityId !== communityFilter) return false;
      if (credentialFilter !== "all" && getCredentialStatus(p) !== credentialFilter) return false;
      return true;
    });
  }, [promoted, searchText, activistFilter, communityFilter, credentialFilter]);

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Promovidos</h2>
        <p className="mt-2 text-sm text-slate-600">
          Todos los promovidos activos en la organización. Haz clic en un registro para ver
          detalles y credenciales.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <article className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Listado</h3>
            <p className="text-sm text-slate-600">
              Filtra por activista, comunidad y estado de credencial.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {filtered.length} registros
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-medium text-slate-700">
            Buscar
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Nombre o CURP"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Activista
            <select
              value={activistFilter}
              onChange={(e) => setActivistFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
            >
              <option value="">Todos</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Comunidad
            <select
              value={communityFilter}
              onChange={(e) => setCommunityFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
            >
              <option value="">Todas</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Credencial
            <select
              value={credentialFilter}
              onChange={(e) => setCredentialFilter(e.target.value as CredentialFilter)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
            >
              {(Object.keys(CREDENTIAL_LABELS) as CredentialFilter[]).map((k) => (
                <option key={k} value={k}>
                  {CREDENTIAL_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">CURP</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Activista</th>
                <th className="px-4 py-3 font-medium">Comunidad</th>
                <th className="px-4 py-3 font-medium">Credencial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filtered.map((person) => (
                <tr
                  key={person.id}
                  onClick={() => setSelected(person)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{person.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{person.curp}</td>
                  <td className="px-4 py-3 text-slate-700">{person.phone}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {memberById.get(person.activistId) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {person.communityId ? (communityById.get(person.communityId) ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <CredentialBadge status={getCredentialStatus(person)} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Sin promovidos que coincidan con los filtros activos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {selected && (
        <DetailModal
          person={selected}
          activistName={memberById.get(selected.activistId) ?? "—"}
          communityName={
            selected.communityId ? (communityById.get(selected.communityId) ?? "—") : "—"
          }
          onClose={() => setSelected(null)}
          onZoom={setZoomUrl}
        />
      )}

      {zoomUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomUrl(null)}
        >
          <img
            src={zoomUrl}
            alt="Credencial ampliada"
            className="max-h-full max-w-full rounded object-contain"
          />
          <button
            className="absolute right-5 top-5 text-2xl font-bold leading-none text-white hover:text-slate-300"
            onClick={() => setZoomUrl(null)}
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}

function CredentialBadge({ status }: { status: "complete" | "pending" | "none" }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Con credencial
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      Sin credencial
    </span>
  );
}

type DetailModalProps = {
  person: PromotedPerson;
  activistName: string;
  communityName: string;
  onClose: () => void;
  onZoom: (url: string) => void;
};

function DetailModal({ person, activistName, communityName, onClose, onZoom }: DetailModalProps) {
  const frontStatus = person.credentialFrontUrl
    ? "uploaded"
    : person.pendingCredentialFront
      ? "pending"
      : "absent";
  const backStatus = person.credentialBackUrl
    ? "uploaded"
    : person.pendingCredentialBack
      ? "pending"
      : "absent";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold">{person.name}</h3>
          <button
            onClick={onClose}
            className="text-xl font-bold leading-none text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DataRow label="CURP" value={<span className="font-mono text-xs">{person.curp}</span>} />
            <DataRow label="Teléfono" value={person.phone} />
            <DataRow label="Fecha de nacimiento" value={fmtBirthDate(person.birthDate)} />
            <DataRow label="Comunidad" value={communityName} />
            <DataRow label="Activista" value={activistName} />
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold text-slate-700">Credencial (INE)</p>

            <CredentialSection
              label="Frente"
              status={frontStatus}
              imageUrl={person.credentialFrontUrl}
              altText="Frente de credencial"
              onZoom={onZoom}
            />

            <CredentialSection
              label="Reverso"
              status={backStatus}
              imageUrl={person.credentialBackUrl}
              altText="Reverso de credencial"
              onZoom={onZoom}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type CredentialSectionProps = {
  label: string;
  status: "uploaded" | "pending" | "absent";
  imageUrl: string | null;
  altText: string;
  onZoom: (url: string) => void;
};

function CredentialSection({ label, status, imageUrl, altText, onZoom }: CredentialSectionProps) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {status === "uploaded" && imageUrl ? (
        <button
          type="button"
          onClick={() => onZoom(imageUrl)}
          className="block w-full overflow-hidden rounded-lg border border-slate-200 transition hover:border-slate-400"
        >
          <img src={imageUrl} alt={altText} className="h-40 w-full object-cover" />
          <p className="py-1.5 text-center text-xs text-slate-500">Toca para ampliar</p>
        </button>
      ) : status === "pending" ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          <span className="text-sm text-amber-700">Sincronización pendiente</span>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
          No capturado
        </div>
      )}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
