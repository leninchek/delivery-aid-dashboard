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

type OrgLevel = {
  id: string;
  name: string;
  rank: number;
  canUseApp: boolean;
  capabilities: string[];
  active: boolean;
};

const defaultForm = {
  name: "",
  rank: 1,
  canUseApp: false,
  capabilities: "",
  active: true,
};

export default function OrgLevelsPage() {
  const [items, setItems] = useState<OrgLevel[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const orgLevelsQuery = query(
      collection(firestoreDb, "OrgLevels"),
      orderBy("rank", "asc")
    );

    const unsubscribe = onSnapshot(
      orgLevelsQuery,
      (snapshot) => {
        setItems(
          snapshot.docs.map((item) => ({
            id: item.id,
            name: item.get("name") || "",
            rank: item.get("rank") || 0,
            canUseApp: Boolean(item.get("canUseApp")),
            capabilities: item.get("capabilities") || [],
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

  const parsedCapabilities = useMemo(
    () =>
      form.capabilities
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [form.capabilities]
  );

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
    setError(null);
  }

  function startEdit(item: OrgLevel) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      rank: item.rank,
      canUseApp: item.canUseApp,
      capabilities: item.capabilities.join(", "),
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

    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      rank: Number(form.rank),
      canUseApp: form.canUseApp,
      capabilities: parsedCapabilities,
      active: form.active,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(firestoreDb, "OrgLevels", editingId), payload);
      } else {
        await addDoc(collection(firestoreDb, "OrgLevels"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible guardar el nivel."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!isConfigured) {
    return <MissingConfigNotice missingVars={missingVars} />;
  }

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Org Levels</h2>
        <p className="mt-2 text-sm text-slate-600">
          Primer CRUD real del Back Office para administrar niveles y capacidades.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Listado</h3>
              <p className="text-sm text-slate-600">
                Ordenado por rank ascendente.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {items.length} registros
            </span>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">App</th>
                  <th className="px-4 py-3 font-medium">Capabilities</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{item.rank}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3">{item.canUseApp ? "Si" : "No"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.capabilities.length > 0
                        ? item.capabilities.join(", ")
                        : "Sin capabilities"}
                    </td>
                    <td className="px-4 py-3">{item.active ? "Activo" : "Inactivo"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      No hay niveles cargados aun.
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
                {editingId ? "Editar nivel" : "Nuevo nivel"}
              </h3>
              <p className="text-sm text-slate-600">
                Define acceso App y capacidades dinamicas por nivel.
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
              <span>Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 outline-none"
                placeholder="Seccional"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Rank</span>
              <input
                type="number"
                min={1}
                value={form.rank}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    rank: Number(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 outline-none"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Capabilities (separadas por coma)</span>
              <textarea
                value={form.capabilities}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    capabilities: event.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 outline-none"
                placeholder="can_create_direct_delivery, can_view_own_deliveries"
              />
            </label>

            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.canUseApp}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    canUseApp: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Puede usar App
            </label>

            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Activo
            </label>

            {parsedCapabilities.length > 0 ? (
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <p className="font-medium text-slate-700">Preview capabilities</p>
                <p className="mt-2">{parsedCapabilities.join(" • ")}</p>
              </div>
            ) : null}

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
              {isSaving ? "Guardando..." : editingId ? "Actualizar nivel" : "Crear nivel"}
            </button>
          </form>
        </article>
      </div>
    </section>
  );
}
