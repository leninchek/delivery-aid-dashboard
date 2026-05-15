"use client";

import { useMemo } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { useCatalogCrud } from "@/hooks/useCatalogCrud";
import { authorityTypeDisplayMap, authorityTypeOptions, formatDateInput } from "@/lib/utils";
import { showToast } from "@/hooks/useToast";
import type { Authority, AuthorityType } from "@/types/shared";

type AuthorityForm = Omit<Authority, "id">;

const defaultForm: AuthorityForm = {
  type: "delegate",
  name: "",
  phone: "",
  curp: "",
  birthDate: "",
};

export default function AuthoritiesPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars = getMissingFirebaseEnvVars();

  const {
    items, form, setForm, editingId,
    isSaving, isDeletingId, error, search, setSearch,
    resetForm, startEdit, handleSubmit, handleDelete,
  } = useCatalogCrud<Authority, AuthorityForm>({
    collectionName: "Authorities",
    defaultForm,
    mapDocToItem: (item) => ({
      id: item.id,
      type: (item.get("type") || "delegate") as AuthorityType,
      name: item.get("name") || "",
      phone: item.get("phone") || "",
      curp: item.get("curp") || "",
      birthDate: formatDateInput(item.get("birthDate")),
    }),
    mapItemToForm: (item) => ({
      type: item.type,
      name: item.name,
      phone: item.phone,
      curp: item.curp,
      birthDate: item.birthDate,
    }),
    mapFormToFirestore: (f) => ({
      type: f.type,
      name: f.name.trim(),
      phone: f.phone.trim(),
      curp: f.curp.trim().toUpperCase(),
      birthDate: f.birthDate ? new Date(f.birthDate) : null,
    }),
    validate: (f) => {
      if (!f.name.trim() || !f.phone.trim() || !f.curp.trim() || !f.birthDate) {
        return "Nombre, teléfono, CURP y fecha de nacimiento son obligatorios.";
      }
      return null;
    },
    onSuccess: (action) => showToast(action === "delete" ? "Autoridad eliminada." : "Guardado correctamente."),
  });

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? items.filter(
          (i) => i.name.toLowerCase().includes(q) || i.curp.toLowerCase().includes(q),
        )
      : items;
  }, [items, search]);

  async function confirmDelete(id: string) {
    if (!window.confirm("Esta accion eliminara la autoridad. Confirma para continuar.")) return;
    await handleDelete(id);
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Autoridades</h2>
        <p className="mt-2 text-sm text-slate-600">
          Catalogo de autoridades para vincular ciudades y comunidades.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Listado</h3>
              <p className="text-sm text-slate-600">Búsqueda por nombre o CURP.</p>
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
                placeholder="Nombre o CURP"
              />
            </label>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">CURP</th>
                  <th className="px-4 py-3 font-medium">Nacimiento</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-slate-700">{authorityTypeDisplayMap[item.type]}</td>
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
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      {search ? "Sin resultados para esa búsqueda." : "Aún no hay autoridades registradas."}
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
                {editingId ? "Editar autoridad" : "Nueva autoridad"}
              </h3>
              <p className="text-sm text-slate-600">Todos los campos son obligatorios.</p>
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
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Tipo</span>
              <select
                value={form.type}
                onChange={(e) => setForm((c) => ({ ...c, type: e.target.value as AuthorityType }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                {authorityTypeOptions.map((type) => (
                  <option key={type} value={type}>{authorityTypeDisplayMap[type]}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Nombre</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="Nombre completo"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Teléfono</span>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
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
                onChange={(e) => setForm((c) => ({ ...c, curp: e.target.value.toUpperCase() }))}
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
                onChange={(e) => setForm((c) => ({ ...c, birthDate: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                required
              />
            </label>

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
              {isSaving ? "Guardando..." : editingId ? "Actualizar autoridad" : "Crear autoridad"}
            </button>
          </form>
        </article>
      </div>
    </section>
  );
}
