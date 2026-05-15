"use client";

import { useMemo } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { useCatalogCrud } from "@/hooks/useCatalogCrud";
import { showToast } from "@/hooks/useToast";
import type { RouteItem } from "@/types/shared";

type RouteForm = { name: string; description: string };

const defaultForm: RouteForm = { name: "", description: "" };

export default function RoutesPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars = getMissingFirebaseEnvVars();

  const {
    items, form, setForm, editingId,
    isSaving, isDeletingId, error, search, setSearch,
    resetForm, startEdit, handleSubmit, handleDelete,
  } = useCatalogCrud<RouteItem, RouteForm>({
    collectionName: "Routes",
    defaultForm,
    mapDocToItem: (item) => ({
      id: item.id,
      name: item.get("name") || "",
      description: item.get("description") || null,
    }),
    mapItemToForm: (item) => ({ name: item.name, description: item.description || "" }),
    mapFormToFirestore: (f) => ({
      name: f.name.trim(),
      description: f.description.trim() || null,
    }),
    validate: (f, editingId, items) => {
      if (!f.name.trim()) return "El nombre de la ruta es obligatorio.";
      const duplicate = items.some(
        (i) => i.id !== editingId && i.name.trim().toLowerCase() === f.name.trim().toLowerCase(),
      );
      return duplicate ? "Ya existe una ruta con ese nombre." : null;
    },
    onSuccess: (action) => showToast(action === "delete" ? "Ruta eliminada." : "Guardado correctamente."),
  });

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.description || "").toLowerCase().includes(q),
        )
      : items;
  }, [items, search]);

  async function confirmDelete(id: string) {
    if (!window.confirm("Esta accion eliminara la ruta. Confirma para continuar.")) return;
    await handleDelete(id);
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Rutas</h2>
        <p className="mt-2 text-sm text-slate-600">
          Catálogo de rutas operativas para asignación territorial.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Listado</h3>
              <p className="text-sm text-slate-600">Búsqueda por nombre o descripción.</p>
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
                placeholder="Nombre o descripción"
              />
            </label>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-slate-700">{item.description || "-"}</td>
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
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={3}>
                      {search ? "Sin resultados para esa búsqueda." : "Aún no hay rutas. Crea la primera ruta operativa."}
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
                {editingId ? "Editar ruta" : "Nueva ruta"}
              </h3>
              <p className="text-sm text-slate-600">El nombre de ruta es obligatorio.</p>
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
              <span>Nombre</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="Ruta Norte"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Descripción (opcional)</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="Cobertura territorial o notas operativas"
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
              {isSaving ? "Guardando..." : editingId ? "Actualizar ruta" : "Crear ruta"}
            </button>
          </form>
        </article>
      </div>
    </section>
  );
}
