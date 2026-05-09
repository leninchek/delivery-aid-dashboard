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
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybeTimestamp = value as { toDate: () => Date };
    return maybeTimestamp.toDate().toISOString().slice(0, 10);
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
  const [error, setError] = useState<string | null>(null);
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const firestoreDb = getFirestoreDb();
    if (!firestoreDb) {
      setError("Firestore no esta configurado.");
      return;
    }

    if (!form.name.trim() || !form.phone.trim() || !form.curp.trim() || !form.birthDate) {
      setError("Completa name, phone, curp y birthDate.");
      return;
    }

    if (!form.levelId) {
      setError("Selecciona un nivel de OrgLevels.");
      return;
    }

    if (editingId && form.parentId === editingId) {
      setError("Un miembro no puede ser su propio parent.");
      return;
    }

    if (editingId && form.parentId) {
      const selectedParent = memberById.get(form.parentId);
      if (selectedParent?.path.includes(editingId)) {
        setError("No puedes asignar como parent a un descendiente.");
        return;
      }
    }

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
          Gestion del organigrama con jerarquia real por parentId y path.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Listado</h3>
              <p className="text-sm text-slate-600">Busqueda por nombre/CURP y filtro por nivel.</p>
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

          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Nivel</th>
                  <th className="px-4 py-3 font-medium">Parent</th>
                  <th className="px-4 py-3 font-medium">Asignacion</th>
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
                      ? `City: ${cityById.get(item.assignment.cityId) || "-"}`
                      : null,
                    item.assignment.communityId
                      ? `Community: ${communityById.get(item.assignment.communityId) || "-"}`
                      : null,
                    item.assignment.routeId
                      ? `Route: ${routeById.get(item.assignment.routeId) || "-"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" | ");

                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {level ? `${level.name} (rank ${level.rank})` : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{parent?.name || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {assignmentSummary || "Sin asignacion"}
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

        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {editingId ? "Editar miembro" : "Nuevo miembro"}
              </h3>
              <p className="text-sm text-slate-600">Campos de persona obligatorios.</p>
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
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>Phone</span>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                  required
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>Birth Date</span>
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, birthDate: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                  required
                />
              </label>
            </div>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>CURP</span>
              <input
                type="text"
                value={form.curp}
                onChange={(event) =>
                  setForm((current) => ({ ...current, curp: event.target.value.toUpperCase() }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Level</span>
              <select
                value={form.levelId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, levelId: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                required
              >
                <option value="">Selecciona nivel</option>
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name} (rank {level.rank})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Parent (opcional)</span>
              <select
                value={form.parentId || ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, parentId: toNullableId(event.target.value) }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                <option value="">Sin parent</option>
                {parentCandidates.map((member) => {
                  const level = levelById.get(member.levelId);
                  return (
                    <option key={member.id} value={member.id}>
                      {member.name} {level ? `(${level.name})` : ""}
                    </option>
                  );
                })}
              </select>
            </label>

            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-700">Asignacion territorial</p>
              <div className="mt-3 space-y-3">
                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  <span>City (opcional)</span>
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
                  <span>Community (opcional)</span>
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
                  <span>Route (opcional)</span>
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

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>App User ID (opcional)</span>
              <input
                type="text"
                value={form.appUserId || ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, appUserId: toNullableId(event.target.value) }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="UID en SystemUsers"
              />
            </label>

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
