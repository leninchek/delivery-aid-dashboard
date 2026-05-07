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
  phone: string;
  curp: string;
  birthDate: string;
};

const authorityTypeOptions: AuthorityType[] = [
  "delegate",
  "sub_delegate",
  "mayor",
  "ejidal_commissioner",
];

const defaultForm: Omit<Authority, "id"> = {
  type: "delegate",
  name: "",
  phone: "",
  curp: "",
  birthDate: "",
};

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

export default function AuthoritiesPage() {
  const [items, setItems] = useState<Authority[]>([]);
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

    const authoritiesQuery = query(collection(firestoreDb, "Authorities"), orderBy("name", "asc"));

    const unsubscribe = onSnapshot(
      authoritiesQuery,
      (snapshot) => {
        setItems(
          snapshot.docs.map((item) => ({
            id: item.id,
            type: (item.get("type") || "delegate") as AuthorityType,
            name: item.get("name") || "",
            phone: item.get("phone") || "",
            curp: item.get("curp") || "",
            birthDate: formatDateInput(item.get("birthDate")),
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

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.curp.toLowerCase().includes(normalizedSearch)
    );
  }, [items, search]);

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
    setError(null);
  }

  function startEdit(item: Authority) {
    setEditingId(item.id);
    setForm({
      type: item.type,
      name: item.name,
      phone: item.phone,
      curp: item.curp,
      birthDate: item.birthDate,
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

    if (!form.name.trim() || !form.phone.trim() || !form.curp.trim() || !form.birthDate) {
      setError("Completa name, phone, curp y birthDate.");
      return;
    }

    setIsSaving(true);

    const payload = {
      type: form.type,
      name: form.name.trim(),
      phone: form.phone.trim(),
      curp: form.curp.trim().toUpperCase(),
      birthDate: new Date(form.birthDate),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(firestoreDb, "Authorities", editingId), payload);
      } else {
        await addDoc(collection(firestoreDb, "Authorities"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible guardar la autoridad."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const shouldDelete = window.confirm(
      "Esta accion eliminara la autoridad. Confirma para continuar."
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
      await deleteDoc(doc(firestoreDb, "Authorities", id));
      if (editingId === id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible eliminar la autoridad."
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
        <h2 className="text-3xl font-semibold tracking-tight">Authorities</h2>
        <p className="mt-2 text-sm text-slate-600">
          Catalogo de autoridades para vincular ciudades y comunidades.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Listado</h3>
              <p className="text-sm text-slate-600">Busqueda por nombre o CURP.</p>
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
                placeholder="Nombre o CURP"
              />
            </label>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Telefono</th>
                  <th className="px-4 py-3 font-medium">CURP</th>
                  <th className="px-4 py-3 font-medium">Nacimiento</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-slate-700">{item.type}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-slate-700">{item.phone}</td>
                    <td className="px-4 py-3 text-slate-700">{item.curp}</td>
                    <td className="px-4 py-3 text-slate-700">{item.birthDate || "-"}</td>
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
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      No hay autoridades para mostrar.
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
                {editingId ? "Editar autoridad" : "Nueva autoridad"}
              </h3>
              <p className="text-sm text-slate-600">Todos los campos son obligatorios.</p>
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
              <span>Tipo</span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, type: event.target.value as AuthorityType }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                {authorityTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Nombre</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="Nombre completo"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Telefono</span>
              <input
                type="text"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="9991234567"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>CURP</span>
              <input
                type="text"
                value={form.curp}
                onChange={(event) =>
                  setForm((current) => ({ ...current, curp: event.target.value.toUpperCase() }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="CURP obligatoria"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Fecha de nacimiento</span>
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
                  ? "Actualizar autoridad"
                  : "Crear autoridad"}
            </button>
          </form>
        </article>
      </div>
    </section>
  );
}
