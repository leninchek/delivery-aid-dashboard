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

type AuthorityType = "delegate" | "sub_delegate" | "mayor" | "ejidal_commissioner";

type Authority = {
  id: string;
  type: AuthorityType;
  name: string;
};

type City = {
  id: string;
  name: string;
  state: string;
  delegateId: string | null;
  subDelegateId: string | null;
  mayorId: string | null;
  ejidalCommissionerId: string | null;
};

const defaultForm: Omit<City, "id"> = {
  name: "",
  state: "",
  delegateId: null,
  subDelegateId: null,
  mayorId: null,
  ejidalCommissionerId: null,
};

function toNullableId(value: string): string | null {
  return value ? value : null;
}

export default function CitiesPage() {
  const [items, setItems] = useState<City[]>([]);
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

    const citiesQuery = query(collection(firestoreDb, "Cities"), orderBy("name", "asc"));

    const unsubscribe = onSnapshot(
      citiesQuery,
      (snapshot) => {
        setItems(
          snapshot.docs.map((item) => ({
            id: item.id,
            name: item.get("name") || "",
            state: item.get("state") || "",
            delegateId: item.get("delegateId") || null,
            subDelegateId: item.get("subDelegateId") || null,
            mayorId: item.get("mayorId") || null,
            ejidalCommissionerId: item.get("ejidalCommissionerId") || null,
          }))
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

    const authoritiesQuery = query(collection(firestoreDb, "Authorities"), orderBy("name", "asc"));

    const unsubscribe = onSnapshot(
      authoritiesQuery,
      (snapshot) => {
        setAuthorities(
          snapshot.docs.map((item) => ({
            id: item.id,
            type: (item.get("type") || "delegate") as AuthorityType,
            name: item.get("name") || "",
          }))
        );
      },
      (snapshotError) => setError(snapshotError.message)
    );

    return unsubscribe;
  }, [isConfigured]);

  const authorityNameById = useMemo(
    () => new Map(authorities.map((authority) => [authority.id, authority.name])),
    [authorities]
  );

  const delegates = useMemo(
    () => authorities.filter((authority) => authority.type === "delegate"),
    [authorities]
  );
  const subDelegates = useMemo(
    () => authorities.filter((authority) => authority.type === "sub_delegate"),
    [authorities]
  );
  const mayors = useMemo(
    () => authorities.filter((authority) => authority.type === "mayor"),
    [authorities]
  );
  const ejidalCommissioners = useMemo(
    () => authorities.filter((authority) => authority.type === "ejidal_commissioner"),
    [authorities]
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return items;
    }

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.state.toLowerCase().includes(normalizedSearch)
    );
  }, [items, search]);

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
    setError(null);
  }

  function startEdit(item: City) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      state: item.state,
      delegateId: item.delegateId,
      subDelegateId: item.subDelegateId,
      mayorId: item.mayorId,
      ejidalCommissionerId: item.ejidalCommissionerId,
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const firestoreDb = getFirestoreDb();
    if (!firestoreDb) {
      setError("Firestore no esta configurado.");
      return;
    }

    if (!form.name.trim() || !form.state.trim()) {
      setError("Completa name y state.");
      return;
    }

    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      state: form.state.trim(),
      delegateId: form.delegateId,
      subDelegateId: form.subDelegateId,
      mayorId: form.mayorId,
      ejidalCommissionerId: form.ejidalCommissionerId,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(firestoreDb, "Cities", editingId), payload);
      } else {
        await addDoc(collection(firestoreDb, "Cities"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "No fue posible guardar la ciudad."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const shouldDelete = window.confirm("Esta accion eliminara la ciudad. Confirma para continuar.");
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
      await deleteDoc(doc(firestoreDb, "Cities", id));
      if (editingId === id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "No fue posible eliminar la ciudad."
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
        <h2 className="text-3xl font-semibold tracking-tight">Cities</h2>
        <p className="mt-2 text-sm text-slate-600">
          Catalogo de ciudades con referencias opcionales a autoridades.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Listado</h3>
              <p className="text-sm text-slate-600">Busqueda por nombre o estado.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {filteredItems.length} registros
            </span>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">
              Buscar
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="Nombre o estado"
              />
            </label>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Delegate</th>
                  <th className="px-4 py-3 font-medium">Mayor</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-slate-700">{item.state}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.delegateId ? authorityNameById.get(item.delegateId) || "-" : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.mayorId ? authorityNameById.get(item.mayorId) || "-" : "-"}
                    </td>
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
                ))}
                {filteredItems.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      No hay ciudades para mostrar.
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
                {editingId ? "Editar ciudad" : "Nueva ciudad"}
              </h3>
              <p className="text-sm text-slate-600">Name y state son obligatorios.</p>
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
              <span>Nombre</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="Merida"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Estado</span>
              <input
                type="text"
                value={form.state}
                onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="Yucatan"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Delegate (opcional)</span>
              <select
                value={form.delegateId || ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, delegateId: toNullableId(event.target.value) }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                <option value="">Sin asignar</option>
                {delegates.map((authority) => (
                  <option key={authority.id} value={authority.id}>
                    {authority.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Sub Delegate (opcional)</span>
              <select
                value={form.subDelegateId || ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subDelegateId: toNullableId(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                <option value="">Sin asignar</option>
                {subDelegates.map((authority) => (
                  <option key={authority.id} value={authority.id}>
                    {authority.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Mayor (opcional)</span>
              <select
                value={form.mayorId || ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, mayorId: toNullableId(event.target.value) }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                <option value="">Sin asignar</option>
                {mayors.map((authority) => (
                  <option key={authority.id} value={authority.id}>
                    {authority.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Ejidal Commissioner (opcional)</span>
              <select
                value={form.ejidalCommissionerId || ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ejidalCommissionerId: toNullableId(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                <option value="">Sin asignar</option>
                {ejidalCommissioners.map((authority) => (
                  <option key={authority.id} value={authority.id}>
                    {authority.name}
                  </option>
                ))}
              </select>
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
              {isSaving ? "Guardando..." : editingId ? "Actualizar ciudad" : "Crear ciudad"}
            </button>
          </form>
        </article>
      </div>
    </section>
  );
}
