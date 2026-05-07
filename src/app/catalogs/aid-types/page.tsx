"use client";

import {
  addDoc,
  collection,
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

type AidUnit = "piece" | "MXN" | "kg" | "other";

type AidType = {
  id: string;
  name: string;
  unit: AidUnit;
  active: boolean;
};

const aidUnitOptions: AidUnit[] = ["piece", "MXN", "kg", "other"];

const defaultForm: Pick<AidType, "name" | "unit" | "active"> = {
  name: "",
  unit: "piece",
  active: true,
};

export default function AidTypesPage() {
  const [items, setItems] = useState<AidType[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

    const aidTypesQuery = query(collection(firestoreDb, "AidTypes"), orderBy("name", "asc"));

    const unsubscribe = onSnapshot(
      aidTypesQuery,
      (snapshot) => {
        setItems(
          snapshot.docs.map((item) => ({
            id: item.id,
            name: item.get("name") || "",
            unit: (item.get("unit") || "other") as AidUnit,
            active: item.get("active") ?? true,
          }))
        );
      },
      (snapshotError) => {
        setError(snapshotError.message);
      }
    );

    return unsubscribe;
  }, [isConfigured]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return items;
    }

    return items.filter((item) => item.name.toLowerCase().includes(normalizedSearch));
  }, [items, search]);

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
    setError(null);
  }

  function startEdit(item: AidType) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      unit: item.unit,
      active: item.active,
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

    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      unit: form.unit,
      active: form.active,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(firestoreDb, "AidTypes", editingId), payload);
      } else {
        await addDoc(collection(firestoreDb, "AidTypes"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible guardar el tipo de apoyo."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleStatus(item: AidType) {
    setError(null);

    const firestoreDb = getFirestoreDb();

    if (!firestoreDb) {
      setError("Firestore no esta configurado.");
      return;
    }

    try {
      await updateDoc(doc(firestoreDb, "AidTypes", item.id), {
        active: !item.active,
        updatedAt: serverTimestamp(),
      });
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "No fue posible actualizar el estado."
      );
    }
  }

  if (!isConfigured) {
    return <MissingConfigNotice missingVars={missingVars} />;
  }

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Aid Types</h2>
        <p className="mt-2 text-sm text-slate-600">
          Catalogo de tipos de apoyo con unidad de medida y estado activo.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Listado</h3>
              <p className="text-sm text-slate-600">Ordenado alfabeticamente por nombre.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {filteredItems.length} registros
            </span>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">
              Buscar por nombre
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="Despensa, Medicamento, ..."
              />
            </label>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Unidad</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-slate-700">{item.unit}</td>
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
                          onClick={() => void toggleStatus(item)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {item.active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                      No hay tipos de apoyo para mostrar.
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
                {editingId ? "Editar tipo de apoyo" : "Nuevo tipo de apoyo"}
              </h3>
              <p className="text-sm text-slate-600">
                Define nombre, unidad y estado operativo.
              </p>
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
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="Despensa"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Unidad</span>
              <select
                value={form.unit}
                onChange={(event) =>
                  setForm((current) => ({ ...current, unit: event.target.value as AidUnit }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                {aidUnitOptions.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
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
                  ? "Actualizar tipo de apoyo"
                  : "Crear tipo de apoyo"}
            </button>
          </form>
        </article>
      </div>
    </section>
  );
}
