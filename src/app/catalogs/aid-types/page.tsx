"use client";

import { useMemo } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { FormInput } from "@/components/form/FormInput";
import { FormSelect } from "@/components/form/FormSelect";
import { getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { useCatalogCrud } from "@/hooks/useCatalogCrud";
import { aidUnitOptions, unitDisplayMap } from "@/lib/utils";
import { showToast } from "@/hooks/useToast";
import { validateRequiredName } from "@/utils/validators";
import type { AidType, AidUnit } from "@/types/shared";

type AidTypeForm = Pick<AidType, "name" | "unit" | "active">;

const defaultForm: AidTypeForm = { name: "", unit: "pieza", active: true };

export default function AidTypesPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars = getMissingFirebaseEnvVars();

  const {
    items, form, setForm, editingId,
    isSaving, error, search, setSearch,
    resetForm, startEdit, handleSubmit, handleToggleActive,
  } = useCatalogCrud<AidType, AidTypeForm>({
    collectionName: "AidTypes",
    defaultForm,
    mapDocToItem: (item) => ({
      id: item.id,
      name: item.get("name") || "",
      unit: (item.get("unit") || "pieza") as AidUnit,
      active: item.get("active") ?? true,
    }),
    mapItemToForm: (item) => ({ name: item.name, unit: item.unit, active: item.active }),
    mapFormToFirestore: (f) => ({ name: f.name.trim(), unit: f.unit, active: f.active }),
    validate: (f) => validateRequiredName(f.name),
    onSuccess: (action) => showToast(action === "delete" ? "Eliminado correctamente." : "Guardado correctamente."),
  });

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, search]);

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Tipos de Apoyo</h2>
        <p className="mt-2 text-sm text-slate-600">
          Catálogo de tipos de apoyo con unidad de medida y estado activo.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
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
                onChange={(e) => setSearch(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="Despensa, Medicamento, ..."
              />
            </label>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
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
                    <td className="px-4 py-3 text-slate-700">{unitDisplayMap[item.unit]}</td>
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
                          onClick={() => void handleToggleActive(item)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {item.active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                      Aún no hay tipos de apoyo. Crea uno para comenzar.
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
                {editingId ? "Editar tipo de apoyo" : "Nuevo tipo de apoyo"}
              </h3>
              <p className="text-sm text-slate-600">Define nombre, unidad y estado operativo.</p>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <FormInput
              label="Nombre"
              value={form.name}
              onChange={(v) => setForm((c) => ({ ...c, name: v }))}
              placeholder="Despensa"
              required
            />

            <FormSelect
              label="Unidad"
              value={form.unit}
              onChange={(v) => setForm((c) => ({ ...c, unit: v as AidUnit }))}
            >
              {aidUnitOptions.map((unit) => (
                <option key={unit} value={unit}>{unitDisplayMap[unit]}</option>
              ))}
            </FormSelect>

            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300"
              />
              Activo
            </label>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSaving ? "Guardando..." : editingId ? "Actualizar tipo de apoyo" : "Crear tipo de apoyo"}
              </button>
            </div>
          </form>
        </article>
      </div>
    </section>
  );
}
