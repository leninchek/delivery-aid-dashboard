"use client";

import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { useCatalogCrud } from "@/hooks/useCatalogCrud";
import { showToast } from "@/hooks/useToast";
import type { OrgLevel } from "@/types/shared";

type OrgLevelForm = {
  name: string;
  rank: number;
  canUseApp: boolean;
  capabilities: string[];
  active: boolean;
};

const CAPABILITIES: { key: string; label: string }[] = [
  { key: "can_create_direct_delivery",   label: "Registrar entrega directa" },
  { key: "can_create_indirect_delivery", label: "Registrar entrega indirecta" },
  { key: "can_register_promoted",        label: "Registrar promovidos" },
  { key: "can_view_own_deliveries",      label: "Ver propias entregas" },
  { key: "can_view_own_promoted",        label: "Ver propios promovidos" },
  { key: "can_edit_own_promoted",        label: "Editar propios promovidos" },
  { key: "can_delete_own_promoted",      label: "Eliminar propios promovidos" },
  { key: "can_view_notifications",       label: "Ver notificaciones" },
];

const CAPABILITY_LABELS: Record<string, string> = Object.fromEntries(
  CAPABILITIES.map(({ key, label }) => [key, label])
);

const defaultForm: OrgLevelForm = {
  name: "",
  rank: 1,
  canUseApp: false,
  capabilities: [],
  active: true,
};

export default function OrgLevelsPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars = getMissingFirebaseEnvVars();

  const {
    items, form, setForm, editingId,
    isSaving, error,
    resetForm, startEdit, handleSubmit,
  } = useCatalogCrud<OrgLevel, OrgLevelForm>({
    collectionName: "OrgLevels",
    orderByField: "rank",
    defaultForm,
    mapDocToItem: (item) => ({
      id: item.id,
      name: item.get("name") || "",
      rank: item.get("rank") || 0,
      canUseApp: Boolean(item.get("canUseApp")),
      capabilities: item.get("capabilities") || [],
      active: item.get("active") ?? true,
    }),
    mapItemToForm: (item) => ({
      name: item.name,
      rank: item.rank,
      canUseApp: item.canUseApp,
      capabilities: item.capabilities,
      active: item.active,
    }),
    mapFormToFirestore: (f) => ({
      name: f.name.trim(),
      rank: Number(f.rank),
      canUseApp: f.canUseApp,
      capabilities: f.capabilities,
      active: f.active,
    }),
    validate: (f) => (!f.name.trim() ? "El nombre es obligatorio." : null),
    onSuccess: (action) => showToast(action === "delete" ? "Nivel eliminado." : "Guardado correctamente."),
  });

  function toggleCapability(key: string) {
    setForm((c) => ({
      ...c,
      capabilities: c.capabilities.includes(key)
        ? c.capabilities.filter((k) => k !== key)
        : [...c.capabilities, key],
    }));
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Niveles Organizacionales</h2>
        <p className="mt-2 text-sm text-slate-600">
          Catálogo para administrar niveles y capacidades.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Listado</h3>
              <p className="text-sm text-slate-600">Ordenado por rank ascendente.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {items.length} registros
            </span>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Rango</th>
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">App</th>
                    <th className="px-4 py-3 font-medium">Capacidades</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">{item.rank}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                      <td className="px-4 py-3">{item.canUseApp ? "Sí" : "No"}</td>
                      <td className="px-4 py-3">
                        {item.capabilities.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.capabilities.map((cap) => (
                              <span
                                key={cap}
                                className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                              >
                                {CAPABILITY_LABELS[cap] ?? cap}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">Sin capacidades</span>
                        )}
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
                  {items.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                        Aún no hay niveles organizacionales. Crea el primero.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-4 p-4">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-slate-900">{item.name}</h4>
                      <p className="text-sm text-slate-600">Rango: {item.rank}</p>
                      <p className="text-sm text-slate-600">App: {item.canUseApp ? "Sí" : "No"}</p>
                      <p className="text-sm text-slate-600">Estado: {item.active ? "Activo" : "Inactivo"}</p>
                      {item.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {item.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                            >
                              {CAPABILITY_LABELS[cap] ?? cap}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-center text-slate-500 py-8">No hay niveles cargados aún.</p>
              )}
            </div>
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 outline-none"
                placeholder="Seccional"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Rango</span>
              <input
                type="number"
                min={1}
                value={form.rank}
                onChange={(e) => setForm((c) => ({ ...c, rank: Number(e.target.value) }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 outline-none"
                required
              />
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Capacidades</legend>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                {CAPABILITIES.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={form.capabilities.includes(key)}
                      onChange={() => toggleCapability(key)}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.canUseApp}
                onChange={(e) => setForm((c) => ({ ...c, canUseApp: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300"
              />
              Puede usar App
            </label>

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
