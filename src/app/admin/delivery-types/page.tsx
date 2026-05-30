"use client";

import { useEffect, useState } from "react";
import {
  collection, deleteDoc, doc, onSnapshot, orderBy,
  query, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { FormInput } from "@/components/form/FormInput";
import { getFirestoreDb } from "@/lib/firebase";
import { showToast } from "@/hooks/useToast";

type OrgLevel = { id: string; name: string; rank: number };

type DeliveryType = {
  id:           string;
  code:         string;
  label:        string;
  fromLevelIds: string[];
  toLevelIds:   string[];
  sortOrder:    number;
  active:       boolean;
};

type DeliveryTypeForm = {
  code:         string;
  label:        string;
  fromLevelIds: Set<string>;
  toLevelIds:   Set<string>;
  sortOrder:    string;
  active:       boolean;
};

const defaultForm: DeliveryTypeForm = {
  code: "", label: "", fromLevelIds: new Set(), toLevelIds: new Set(),
  sortOrder: "1", active: true,
};

export default function DeliveryTypesPage() {
  return (
    <PermissionGuard permission="admin">
      <DeliveryTypesContent />
    </PermissionGuard>
  );
}

function DeliveryTypesContent() {
  const [deliveryTypes, setDeliveryTypes] = useState<DeliveryType[]>([]);
  const [orgLevels,     setOrgLevels]     = useState<OrgLevel[]>([]);
  const [editing,       setEditing]       = useState<DeliveryType | null>(null);
  const [form,          setForm]          = useState<DeliveryTypeForm>(defaultForm);
  const [fieldErrors,   setFieldErrors]   = useState<Record<string, string>>({});
  const [isSaving,      setIsSaving]      = useState(false);
  const [isDeleting,    setIsDeleting]    = useState<string | null>(null);
  const [error,         setError]         = useState<string | null>(null);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db) return;
    const u1 = onSnapshot(
      query(collection(db, "DirectDeliveryTypes"), orderBy("sortOrder", "asc")),
      (snap) => setDeliveryTypes(snap.docs.map((d) => ({
        id:           d.id,
        code:         (d.get("code")         as string)   || "",
        label:        (d.get("label")        as string)   || "",
        fromLevelIds: (d.get("fromLevelIds") as string[]) || [],
        toLevelIds:   (d.get("toLevelIds")   as string[]) || [],
        sortOrder:    (d.get("sortOrder")    as number)   || 0,
        active:       (d.get("active")       as boolean)  ?? true,
      })))
    );
    const u2 = onSnapshot(
      query(collection(db, "OrgLevels"), orderBy("rank", "asc")),
      (snap) => setOrgLevels(snap.docs.map((d) => ({
        id:   d.id,
        name: (d.get("name") as string) || "",
        rank: (d.get("rank") as number) || 0,
      })))
    );
    return () => { u1(); u2(); };
  }, []);

  function startEdit(dt: DeliveryType) {
    setEditing(dt);
    setForm({
      code:         dt.code,
      label:        dt.label,
      fromLevelIds: new Set(dt.fromLevelIds),
      toLevelIds:   new Set(dt.toLevelIds),
      sortOrder:    String(dt.sortOrder),
      active:       dt.active,
    });
    setFieldErrors({});
    setError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setForm(defaultForm);
    setFieldErrors({});
    setError(null);
  }

  function toggleFromLevel(id: string) {
    setForm((p) => {
      const next = new Set(p.fromLevelIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...p, fromLevelIds: next };
    });
    setFieldErrors((p) => { const n = { ...p }; delete n.from; return n; });
  }

  function toggleToLevel(id: string) {
    setForm((p) => {
      const next = new Set(p.toLevelIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...p, toLevelIds: next };
    });
    setFieldErrors((p) => { const n = { ...p }; delete n.to; return n; });
  }

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!form.code.trim())            errs.code      = "El código es obligatorio.";
    else if (/\s/.test(form.code))    errs.code      = "El código no puede tener espacios.";
    if (!form.label.trim())           errs.label     = "La etiqueta es obligatoria.";
    if (form.fromLevelIds.size === 0) errs.from      = "Selecciona al menos un nivel origen.";
    if (form.toLevelIds.size === 0)   errs.to        = "Selecciona al menos un nivel destino.";
    const order = parseInt(form.sortOrder, 10);
    if (isNaN(order) || order < 1)    errs.sortOrder = "El orden debe ser un número mayor a 0.";
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }

    const db = getFirestoreDb();
    if (!db) { setError("Firebase no está configurado."); return; }

    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        code:         form.code.trim().toLowerCase(),
        label:        form.label.trim(),
        fromLevelIds: Array.from(form.fromLevelIds),
        toLevelIds:   Array.from(form.toLevelIds),
        sortOrder:    order,
        active:       form.active,
      };
      if (editing) {
        await updateDoc(doc(db, "DirectDeliveryTypes", editing.id), { ...payload, updatedAt: serverTimestamp() });
        showToast("Tipo de entrega actualizado.");
        cancelEdit();
      } else {
        const docId = payload.code;
        if (deliveryTypes.find((d) => d.code === docId)) { setError(`Ya existe un tipo con el código "${docId}".`); return; }
        await setDoc(doc(db, "DirectDeliveryTypes", docId), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        showToast("Tipo de entrega creado.");
        setForm(defaultForm);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(dt: DeliveryType) {
    if (!confirm(`¿Eliminar el tipo "${dt.label}"? Esta acción no se puede deshacer.`)) return;
    const db = getFirestoreDb();
    if (!db) return;
    setIsDeleting(dt.id);
    try {
      await deleteDoc(doc(db, "DirectDeliveryTypes", dt.id));
      showToast("Tipo de entrega eliminado.");
      if (editing?.id === dt.id) cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar.");
    } finally {
      setIsDeleting(null);
    }
  }

  const levelById  = new Map(orgLevels.map((l) => [l.id, l.name]));
  const isEditing  = editing !== null;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Tipos de Entrega</h2>
        <p className="mt-2 text-sm text-slate-600">
          Define qué niveles pueden entregar a cuáles. Configura aquí el flujo de Entrega Interna en la App.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Lista ── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Tipos configurados</h3>
              <p className="text-sm text-slate-600">Ordenados por prioridad ascendente.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {deliveryTypes.length} tipos
            </span>
          </div>

          <div className="space-y-2">
            {deliveryTypes.map((dt) => (
              <div
                key={dt.id}
                onClick={() => startEdit(dt)}
                className={`cursor-pointer rounded-lg border px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50 ${
                  editing?.id === dt.id
                    ? "border-slate-900 bg-slate-50"
                    : dt.active ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{dt.label}</p>
                      {!dt.active && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500">Inactivo</span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-slate-400 mt-0.5">{dt.code}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                      <span><span className="font-medium text-slate-600">Origen:</span> {dt.fromLevelIds.map((id) => levelById.get(id) ?? id).join(", ") || "—"}</span>
                      <span><span className="font-medium text-slate-600">Destino:</span> {dt.toLevelIds.map((id) => levelById.get(id) ?? id).join(", ") || "—"}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isDeleting === dt.id}
                    onClick={(e) => { e.stopPropagation(); void handleDelete(dt); }}
                    className="shrink-0 rounded px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    {isDeleting === dt.id ? "..." : "Eliminar"}
                  </button>
                </div>
              </div>
            ))}
            {deliveryTypes.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
                <p className="text-sm text-slate-500">No hay tipos configurados.</p>
                <p className="mt-1 text-xs text-slate-400">Crea al menos uno para que Entrega Interna funcione.</p>
              </div>
            )}
          </div>
        </article>

        {/* ── Formulario siempre visible ── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {isEditing ? `Editar: ${editing.label}` : "Nuevo tipo de entrega"}
              </h3>
              <p className="mt-0.5 text-sm text-slate-600">
                {isEditing ? "Modifica la configuración del tipo." : "El código se usa internamente en la App y Firestore."}
              </p>
            </div>
            {isEditing && (
              <button type="button" onClick={cancelEdit} className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Cancelar
              </button>
            )}
          </div>

          <div className="space-y-5">
            <FormInput
              label="Etiqueta (visible al usuario)"
              value={form.label}
              onChange={(v) => { setForm((p) => ({ ...p, label: v })); setFieldErrors((p) => { const n = {...p}; delete n.label; return n; }); }}
              placeholder="Ej. Activista → Promovido"
              error={fieldErrors.label}
            />

            <FormInput
              label="Código interno"
              value={form.code}
              mono
              onChange={(v) => { setForm((p) => ({ ...p, code: v.toLowerCase().replace(/\s/g, "_") })); setFieldErrors((p) => { const n = {...p}; delete n.code; return n; }); }}
              placeholder="Ej. activist_to_promoted"
              error={fieldErrors.code}
              hint={isEditing ? "El código no cambia el ID del documento en Firestore." : undefined}
            />

            <FormInput
              label="Orden de aparición"
              type="number"
              value={form.sortOrder}
              onChange={(v) => { setForm((p) => ({ ...p, sortOrder: v })); setFieldErrors((p) => { const n = {...p}; delete n.sortOrder; return n; }); }}
              min={1}
              error={fieldErrors.sortOrder}
            />

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">
                Niveles origen <span className="text-xs font-normal text-slate-400">(¿quién entrega?)</span>
              </legend>
              {orgLevels.length === 0 ? (
                <p className="text-xs text-amber-600">Primero crea los Niveles Organizacionales.</p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {orgLevels.map((l) => (
                    <label key={l.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                      <input type="checkbox" checked={form.fromLevelIds.has(l.id)} onChange={() => toggleFromLevel(l.id)} className="h-4 w-4 rounded accent-slate-900" />
                      <span className="text-sm text-slate-700">{l.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {fieldErrors.from && <p className="mt-1 text-xs text-rose-600">{fieldErrors.from}</p>}
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">
                Niveles destino <span className="text-xs font-normal text-slate-400">(¿a quién se entrega?)</span>
              </legend>
              {orgLevels.length === 0 ? (
                <p className="text-xs text-amber-600">Primero crea los Niveles Organizacionales.</p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {orgLevels.map((l) => (
                    <label key={l.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                      <input type="checkbox" checked={form.toLevelIds.has(l.id)} onChange={() => toggleToLevel(l.id)} className="h-4 w-4 rounded accent-slate-900" />
                      <span className="text-sm text-slate-700">{l.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {fieldErrors.to && <p className="mt-1 text-xs text-rose-600">{fieldErrors.to}</p>}
            </fieldset>

            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} className="h-4 w-4 rounded accent-slate-900" />
              <span className="text-sm font-medium text-slate-900">Tipo activo</span>
            </label>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear tipo"}
            </button>
          </div>
        </article>

      </div>
    </section>
  );
}
