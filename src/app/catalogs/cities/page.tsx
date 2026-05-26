"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { FormInput } from "@/components/form/FormInput";
import { FormSelect } from "@/components/form/FormSelect";
import { getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { getFirestoreDb } from "@/lib/firebase";
import { useCatalogCrud } from "@/hooks/useCatalogCrud";
import { toNullableId } from "@/lib/utils";
import { showToast } from "@/hooks/useToast";
import type { Authority, City } from "@/types/shared";

type CityForm = Omit<City, "id">;

const defaultForm: CityForm = {
  name: "",
  state: "",
  delegateId: null,
  subDelegateId: null,
  mayorId: null,
  ejidalCommissionerId: null,
};

export default function CitiesPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars = getMissingFirebaseEnvVars();

  const [authorities, setAuthorities] = useState<Authority[]>([]);

  const {
    items, form, setForm, editingId,
    isSaving, isDeletingId, error, search, setSearch,
    resetForm, startEdit, handleSubmit, handleDelete,
  } = useCatalogCrud<City, CityForm>({
    collectionName: "Cities",
    defaultForm,
    mapDocToItem: (item) => ({
      id: item.id,
      name: item.get("name") || "",
      state: item.get("state") || "",
      delegateId: item.get("delegateId") || null,
      subDelegateId: item.get("subDelegateId") || null,
      mayorId: item.get("mayorId") || null,
      ejidalCommissionerId: item.get("ejidalCommissionerId") || null,
    }),
    mapItemToForm: (item) => ({
      name: item.name,
      state: item.state,
      delegateId: item.delegateId,
      subDelegateId: item.subDelegateId,
      mayorId: item.mayorId,
      ejidalCommissionerId: item.ejidalCommissionerId,
    }),
    mapFormToFirestore: (f) => ({
      name: f.name.trim(),
      state: f.state.trim(),
      delegateId: f.delegateId,
      subDelegateId: f.subDelegateId,
      mayorId: f.mayorId,
      ejidalCommissionerId: f.ejidalCommissionerId,
    }),
    validate: (f) => (!f.name.trim() || !f.state.trim() ? "Nombre y estado son obligatorios." : null),
    onSuccess: (action) => showToast(action === "delete" ? "Ciudad eliminada." : "Guardado correctamente."),
  });

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db) return;
    const q = query(collection(db, "Authorities"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snap) =>
      setAuthorities(
        snap.docs.map((d) => ({
          id: d.id,
          type: d.get("type") || "delegate",
          name: d.get("name") || "",
          phone: d.get("phone") || "",
          curp: d.get("curp") || "",
          birthDate: d.get("birthDate") || "",
        }))
      )
    );
    return () => unsub();
  }, []);

  const authorityNameById = useMemo(
    () => new Map(authorities.map((a) => [a.id, a.name])),
    [authorities]
  );
  const delegates = useMemo(() => authorities.filter((a) => a.type === "delegate"), [authorities]);
  const subDelegates = useMemo(() => authorities.filter((a) => a.type === "sub_delegate"), [authorities]);
  const mayors = useMemo(() => authorities.filter((a) => a.type === "mayor"), [authorities]);
  const ejidalCommissioners = useMemo(() => authorities.filter((a) => a.type === "ejidal_commissioner"), [authorities]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? items.filter(
          (i) => i.name.toLowerCase().includes(q) || i.state.toLowerCase().includes(q)
        )
      : items;
  }, [items, search]);

  async function confirmDelete(id: string) {
    if (!window.confirm("Esta accion eliminara la ciudad. Confirma para continuar.")) return;
    await handleDelete(id);
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Ciudades</h2>
        <p className="mt-2 text-sm text-slate-600">
          Catalogo de ciudades con referencias opcionales a autoridades.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
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
                onChange={(e) => setSearch(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="Nombre o estado"
              />
            </label>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Delegado</th>
                  <th className="px-4 py-3 font-medium">Presidente</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-slate-700">{item.state}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.delegateId ? (authorityNameById.get(item.delegateId) ?? "-") : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.mayorId ? (authorityNameById.get(item.mayorId) ?? "-") : "-"}
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
                          onClick={() => void confirmDelete(item.id)}
                          disabled={isDeletingId === item.id}
                          className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeletingId === item.id ? "Eliminando..." : "Eliminar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      {search ? "Sin resultados para esa búsqueda." : "Aún no hay ciudades. Crea la primera."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {editingId ? "Editar ciudad" : "Nueva ciudad"}
              </h3>
              <p className="text-sm text-slate-600">Nombre y estado son obligatorios.</p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
            )}
          </div>

          <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <FormInput
              label="Nombre"
              value={form.name}
              onChange={(v) => setForm((c) => ({ ...c, name: v }))}
              placeholder="Merida"
              required
            />

            <FormInput
              label="Estado"
              value={form.state}
              onChange={(v) => setForm((c) => ({ ...c, state: v }))}
              placeholder="Yucatan"
              required
            />

            <FormSelect
              label="Delegado (opcional)"
              value={form.delegateId || ""}
              onChange={(v) => setForm((c) => ({ ...c, delegateId: toNullableId(v) }))}
            >
              <option value="">Sin asignar</option>
              {delegates.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </FormSelect>

            <FormSelect
              label="Sub Delegado (opcional)"
              value={form.subDelegateId || ""}
              onChange={(v) => setForm((c) => ({ ...c, subDelegateId: toNullableId(v) }))}
            >
              <option value="">Sin asignar</option>
              {subDelegates.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </FormSelect>

            <FormSelect
              label="Comisario Ejidal (opcional)"
              value={form.ejidalCommissionerId || ""}
              onChange={(v) => setForm((c) => ({ ...c, ejidalCommissionerId: toNullableId(v) }))}
            >
              <option value="">Sin asignar</option>
              {ejidalCommissioners.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </FormSelect>

            <FormSelect
              label="Presidente (opcional)"
              value={form.mayorId || ""}
              onChange={(v) => setForm((c) => ({ ...c, mayorId: toNullableId(v) }))}
            >
              <option value="">Sin asignar</option>
              {mayors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </FormSelect>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

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
