"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { getFirestoreDb, getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { validateMexicanPhone, validateCurp, validateBirthDate } from "@/utils/validators";

type OrgLevel = {
  id: string;
  name: string;
  rank: number;
};

type NamedEntity = {
  id: string;
  name: string;
};

type OrgMember = {
  id: string;
  name: string;
  phone: string;
  curp: string;
  birthDate: string;
  levelId: string;
  parentId: string | null;
  path: string[];
  assignment: {
    cityId: string | null;
    communityId: string | null;
    routeId: string | null;
  };
  appUserId: string | null;
  active: boolean;
};

const defaultForm: Omit<OrgMember, "id" | "path"> = {
  name: "",
  phone: "",
  curp: "",
  birthDate: "",
  levelId: "",
  parentId: null,
  assignment: {
    cityId: null,
    communityId: null,
    routeId: null,
  },
  appUserId: null,
  active: true,
};

function toNullableId(value: string): string | null {
  return value ? value : null;
}

function formatDateInput(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return "";
}

export default function OrgMembersPage() {
  const [items, setItems] = useState<OrgMember[]>([]);
  const [levels, setLevels] = useState<OrgLevel[]>([]);
  const [cities, setCities] = useState<NamedEntity[]>([]);
  const [communities, setCommunities] = useState<NamedEntity[]>([]);
  const [routes, setRoutes] = useState<NamedEntity[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [isUnlinking,  setIsUnlinking]  = useState(false);
  const [fieldErrors,  setFieldErrors]  = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");

  const isConfigured = hasFirebaseConfig();
  const missingVars = getMissingFirebaseEnvVars();

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    const firestoreDb = getFirestoreDb();
    if (!firestoreDb) {
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(firestoreDb, "OrgMembers"), orderBy("name", "asc")),
      (snapshot) => {
        setItems(
          snapshot.docs.map((item) => {
            const assignment = (item.get("assignment") || {}) as {
              cityId?: string | null;
              communityId?: string | null;
              routeId?: string | null;
            };

            return {
              id: item.id,
              name: item.get("name") || "",
              phone: item.get("phone") || "",
              curp: item.get("curp") || "",
              birthDate: formatDateInput(item.get("birthDate")),
              levelId: item.get("levelId") || "",
              parentId: item.get("parentId") || null,
              path: item.get("path") || [],
              assignment: {
                cityId: assignment.cityId || null,
                communityId: assignment.communityId || null,
                routeId: assignment.routeId || null,
              },
              appUserId: item.get("appUserId") || null,
              active: item.get("active") ?? true,
            };
          })
        );
      },
      (snapshotError) => setError(snapshotError.message)
    );

    return unsubscribe;
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    const firestoreDb = getFirestoreDb();
    if (!firestoreDb) {
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(firestoreDb, "OrgLevels"), orderBy("rank", "asc")),
      (snapshot) => {
        const orgLevels = snapshot.docs.map((item) => ({
          id: item.id,
          name: item.get("name") || "",
          rank: item.get("rank") || 999,
        }));
        setLevels(orgLevels);

        setForm((current) => {
          if (current.levelId || orgLevels.length === 0) {
            return current;
          }

          return { ...current, levelId: orgLevels[0].id };
        });
      },
      (snapshotError) => setError(snapshotError.message)
    );

    return unsubscribe;
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    const firestoreDb = getFirestoreDb();
    if (!firestoreDb) {
      return;
    }

    const unsubscribers = [
      onSnapshot(
        query(collection(firestoreDb, "Cities"), orderBy("name", "asc")),
        (snapshot) => {
          setCities(
            snapshot.docs.map((item) => ({ id: item.id, name: item.get("name") || "" }))
          );
        },
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        query(collection(firestoreDb, "Communities"), orderBy("name", "asc")),
        (snapshot) => {
          setCommunities(
            snapshot.docs.map((item) => ({ id: item.id, name: item.get("name") || "" }))
          );
        },
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        query(collection(firestoreDb, "Routes"), orderBy("name", "asc")),
        (snapshot) => {
          setRoutes(
            snapshot.docs.map((item) => ({ id: item.id, name: item.get("name") || "" }))
          );
        },
        (snapshotError) => setError(snapshotError.message)
      ),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [isConfigured]);

  const levelById = useMemo(() => new Map(levels.map((item) => [item.id, item])), [levels]);
  const memberById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const cityById = useMemo(() => new Map(cities.map((item) => [item.id, item.name])), [cities]);
  const communityById = useMemo(
    () => new Map(communities.map((item) => [item.id, item.name])),
    [communities]
  );
  const routeById = useMemo(() => new Map(routes.map((item) => [item.id, item.name])), [routes]);

  const parentCandidates = useMemo(() => {
    if (!editingId) {
      return items;
    }

    return items.filter((item) => item.id !== editingId && !item.path.includes(editingId));
  }, [editingId, items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.curp.toLowerCase().includes(normalizedSearch);
      const matchesLevel = !levelFilter || item.levelId === levelFilter;
      return matchesSearch && matchesLevel;
    });
  }, [items, levelFilter, search]);

  function resetForm() {
    setError(null);
    setFieldErrors({});
    setEditingId(null);
    setForm({
      ...defaultForm,
      levelId: levels[0]?.id || "",
    });
  }

  function startEdit(item: OrgMember) {
    setEditingId(item.id);
    setError(null);
    setForm({
      name: item.name,
      phone: item.phone,
      curp: item.curp,
      birthDate: item.birthDate,
      levelId: item.levelId,
      parentId: item.parentId,
      assignment: {
        cityId: item.assignment.cityId,
        communityId: item.assignment.communityId,
        routeId: item.assignment.routeId,
      },
      appUserId: item.appUserId,
      active: item.active,
    });
  }

  function buildPath(parentId: string | null): string[] {
    if (!parentId) {
      return [];
    }

    const parent = memberById.get(parentId);
    if (!parent) {
      return [];
    }

    return [...parent.path, parent.id];
  }

  async function handleUnlink() {
    if (!editingId) return;
    const firestoreDb = getFirestoreDb();
    if (!firestoreDb) return;

    setIsUnlinking(true);
    setError(null);
    try {
      await updateDoc(doc(firestoreDb, "OrgMembers", editingId), {
        appUserId: null,
        updatedAt: serverTimestamp(),
      });
      setForm((c) => ({ ...c, appUserId: null }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible desvincular la cuenta.");
    } finally {
      setIsUnlinking(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const firestoreDb = getFirestoreDb();
    if (!firestoreDb) {
      setError("Firestore no esta configurado.");
      return;
    }

    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "El nombre es obligatorio.";
    const phoneErr = validateMexicanPhone(form.phone);
    if (phoneErr) errs.phone = phoneErr;
    const curpErr = validateCurp(form.curp);
    if (curpErr) errs.curp = curpErr;
    const birthErr = validateBirthDate(form.birthDate);
    if (birthErr) errs.birthDate = birthErr;
    if (!form.levelId) errs.levelId = "Selecciona un nivel organizacional.";

    if (editingId && form.parentId === editingId) {
      errs.parentId = "Un miembro no puede ser su propio superior directo.";
    } else if (editingId && form.parentId) {
      const selectedParent = memberById.get(form.parentId);
      if (selectedParent?.path.includes(editingId))
        errs.parentId = "No puedes asignar como superior a un miembro subordinado.";
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    const memberPath = buildPath(form.parentId);

    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      curp: form.curp.trim().toUpperCase(),
      birthDate: new Date(form.birthDate),
      levelId: form.levelId,
      parentId: form.parentId,
      path: memberPath,
      assignment: {
        cityId: form.assignment.cityId,
        communityId: form.assignment.communityId,
        routeId: form.assignment.routeId,
      },
      appUserId: form.appUserId?.trim() || null,
      active: form.active,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(firestoreDb, "OrgMembers", editingId), payload);
      } else {
        await addDoc(collection(firestoreDb, "OrgMembers"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible guardar el miembro del organigrama."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const hasChildren = items.some((item) => item.parentId === id);
    if (hasChildren) {
      setError("No se puede eliminar: este miembro tiene descendientes.");
      return;
    }

    const shouldDelete = window.confirm(
      "Esta accion eliminara el miembro del organigrama. Confirma para continuar."
    );

    if (!shouldDelete) {
      return;
    }

    setError(null);
    setIsDeletingId(id);

    const firestoreDb = getFirestoreDb();
    if (!firestoreDb) {
      setError("Firestore no esta configurado.");
      setIsDeletingId(null);
      return;
    }

    try {
      await deleteDoc(doc(firestoreDb, "OrgMembers", id));
      if (editingId === id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible eliminar el miembro."
      );
    } finally {
      setIsDeletingId(null);
    }
  }

  if (!isConfigured) {
    return <MissingConfigNotice missingVars={missingVars} />;
  }

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Miembros Organizacionales</h2>
        <p className="mt-2 text-sm text-slate-600">
          Gestión del organigrama y estructura jerárquica de la organización.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Listado</h3>
              <p className="text-sm text-slate-600">Búsqueda por nombre/CURP y filtro por nivel.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {filteredItems.length} registros
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Buscar
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="Nombre o CURP"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Nivel
              <select
                value={levelFilter}
                onChange={(event) => setLevelFilter(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                <option value="">Todos</option>
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Nivel</th>
                  <th className="px-4 py-3 font-medium">Superior directo</th>
                  <th className="px-4 py-3 font-medium">Asignación territorial</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredItems.map((item) => {
                  const level = levelById.get(item.levelId);
                  const parent = item.parentId ? memberById.get(item.parentId) : null;

                  const assignmentSummary = [
                    item.assignment.cityId
                      ? `Ciudad: ${cityById.get(item.assignment.cityId) || "-"}`
                      : null,
                    item.assignment.communityId
                      ? `Comunidad: ${communityById.get(item.assignment.communityId) || "-"}`
                      : null,
                    item.assignment.routeId
                      ? `Ruta: ${routeById.get(item.assignment.routeId) || "-"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" | ");

                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {level ? `${level.name} (rango ${level.rank})` : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{parent?.name || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {assignmentSummary || "Sin asignación"}
                      </td>
                      <td className="px-4 py-3">{item.active ? "Activo" : "Inactivo"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(item.id)}
                            disabled={isDeletingId === item.id}
                            className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isDeletingId === item.id ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredItems.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      Sin miembros que coincidan con la búsqueda activa.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {editingId ? "Editar miembro" : "Nuevo miembro"}
              </h3>
              <p className="text-sm text-slate-600">Datos personales y posición en el organigrama.</p>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
            ) : null}
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Nombre completo</label>
              <input
                type="text"
                value={form.name}
                onChange={(event) => {
                  setForm((current) => ({ ...current, name: event.target.value }));
                  setFieldErrors((e) => { const n = { ...e }; delete n.name; return n; });
                }}
                className={`w-full rounded-lg border px-3 py-2 outline-none transition focus:border-slate-900 ${fieldErrors.name ? "border-rose-400 bg-rose-50" : "border-slate-300"}`}
              />
              {fieldErrors.name && <p className="text-xs text-rose-600">{fieldErrors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Teléfono</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.phone}
                  maxLength={10}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
                    setForm((current) => ({ ...current, phone: digits }));
                    setFieldErrors((e) => { const n = { ...e }; delete n.phone; return n; });
                  }}
                  placeholder="10 dígitos"
                  className={`w-full rounded-lg border px-3 py-2 outline-none transition focus:border-slate-900 ${fieldErrors.phone ? "border-rose-400 bg-rose-50" : "border-slate-300"}`}
                />
                {fieldErrors.phone && <p className="text-xs text-rose-600">{fieldErrors.phone}</p>}
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Fecha de nacimiento</label>
                <input
                  type="date"
                  value={form.birthDate}
                  min={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 100); return d.toISOString().slice(0, 10); })()}
                  max={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().slice(0, 10); })()}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, birthDate: event.target.value }));
                    setFieldErrors((e) => { const n = { ...e }; delete n.birthDate; return n; });
                  }}
                  className={`w-full rounded-lg border px-3 py-2 outline-none transition focus:border-slate-900 ${fieldErrors.birthDate ? "border-rose-400 bg-rose-50" : "border-slate-300"}`}
                />
                {fieldErrors.birthDate && <p className="text-xs text-rose-600">{fieldErrors.birthDate}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">CURP</label>
                <span className={`text-xs tabular-nums ${form.curp.length === 18 ? "text-emerald-600" : form.curp.length > 0 ? "text-slate-400" : "text-slate-300"}`}>
                  {form.curp.length}/18
                </span>
              </div>
              <input
                type="text"
                value={form.curp}
                maxLength={18}
                onChange={(event) => {
                  const clean = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 18);
                  setForm((current) => ({ ...current, curp: clean }));
                  setFieldErrors((e) => { const n = { ...e }; delete n.curp; return n; });
                }}
                placeholder="18 caracteres"
                className={`w-full rounded-lg border px-3 py-2 font-mono outline-none transition focus:border-slate-900 ${fieldErrors.curp ? "border-rose-400 bg-rose-50" : "border-slate-300"}`}
              />
              {fieldErrors.curp && <p className="text-xs text-rose-600">{fieldErrors.curp}</p>}
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Nivel organizacional</label>
              <select
                value={form.levelId}
                onChange={(event) => {
                  setForm((current) => ({ ...current, levelId: event.target.value }));
                  setFieldErrors((e) => { const n = { ...e }; delete n.levelId; return n; });
                }}
                className={`w-full rounded-lg border px-3 py-2 outline-none transition focus:border-slate-900 ${fieldErrors.levelId ? "border-rose-400 bg-rose-50" : "border-slate-300"}`}
              >
                <option value="">Selecciona un nivel</option>
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name} (rango {level.rank})
                  </option>
                ))}
              </select>
              {fieldErrors.levelId && <p className="text-xs text-rose-600">{fieldErrors.levelId}</p>}
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Superior directo (opcional)</label>
              <select
                value={form.parentId || ""}
                onChange={(event) => {
                  setForm((current) => ({ ...current, parentId: toNullableId(event.target.value) }));
                  setFieldErrors((e) => { const n = { ...e }; delete n.parentId; return n; });
                }}
                className={`w-full rounded-lg border px-3 py-2 outline-none transition focus:border-slate-900 ${fieldErrors.parentId ? "border-rose-400 bg-rose-50" : "border-slate-300"}`}
              >
                <option value="">Sin superior directo</option>
                {parentCandidates.map((member) => {
                  const level = levelById.get(member.levelId);
                  return (
                    <option key={member.id} value={member.id}>
                      {member.name} {level ? `(${level.name})` : ""}
                    </option>
                  );
                })}
              </select>
              {fieldErrors.parentId && <p className="text-xs text-rose-600">{fieldErrors.parentId}</p>}
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-700">Asignación territorial</p>
              <div className="mt-3 space-y-3">
                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  <span>Ciudad (opcional)</span>
                  <select
                    value={form.assignment.cityId || ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        assignment: {
                          ...current.assignment,
                          cityId: toNullableId(event.target.value),
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                  >
                    <option value="">Sin asignar</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  <span>Comunidad (opcional)</span>
                  <select
                    value={form.assignment.communityId || ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        assignment: {
                          ...current.assignment,
                          communityId: toNullableId(event.target.value),
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                  >
                    <option value="">Sin asignar</option>
                    {communities.map((community) => (
                      <option key={community.id} value={community.id}>
                        {community.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  <span>Ruta (opcional)</span>
                  <select
                    value={form.assignment.routeId || ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        assignment: {
                          ...current.assignment,
                          routeId: toNullableId(event.target.value),
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                  >
                    <option value="">Sin asignar</option>
                    {routes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700">Cuenta App</p>
              {form.appUserId ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <span className="text-sm text-emerald-700">Vinculado con acceso a la App</span>
                  <button
                    type="button"
                    onClick={() => void handleUnlink()}
                    disabled={isUnlinking}
                    className="text-xs text-rose-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUnlinking ? "Desvinculando..." : "Desvincular"}
                  </button>
                </div>
              ) : editingId ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Sin cuenta App vinculada. Para re-vincular, pega el UID desde{" "}
                    <span className="font-medium text-slate-700">Acceso App</span>.
                  </p>
                  <input
                    type="text"
                    value={form.appUserId ?? ""}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, appUserId: e.target.value.trim() || null }))
                    }
                    placeholder="UID de la cuenta App"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs outline-none transition focus:border-slate-900"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Sin cuenta App vinculada — gestiona el acceso desde{" "}
                  <span className="font-medium text-slate-700">Operación → Acceso App</span>
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) => ({ ...current, active: event.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Activo
            </label>

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving
                ? "Guardando..."
                : editingId
                  ? "Actualizar miembro"
                  : "Crear miembro"}
            </button>
          </form>
        </article>
      </div>
    </section>
  );
}
