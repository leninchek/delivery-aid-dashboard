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
import {
  ASSIGNABLE_PERMISSIONS,
  PERMISSION_LABELS,
  type Permission,
} from "@/types/permissions";

type BackofficeRole = {
  id:          string;
  name:        string;
  permissions: string[];
  protected:   boolean;
};

type RoleForm = { name: string; permissions: Set<Permission> };

const defaultForm: RoleForm = { name: "", permissions: new Set() };

function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export default function RolesPage() {
  return (
    <PermissionGuard permission="admin">
      <RolesContent />
    </PermissionGuard>
  );
}

function RolesContent() {
  const [roles,      setRoles]      = useState<BackofficeRole[]>([]);
  const [editing,    setEditing]    = useState<BackofficeRole | null>(null);
  const [form,       setForm]       = useState<RoleForm>(defaultForm);
  const [nameError,  setNameError]  = useState<string | null>(null);
  const [isSaving,   setIsSaving]   = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db) return;
    const unsub = onSnapshot(
      query(collection(db, "BackofficeRoles"), orderBy("name", "asc")),
      (snap) => setRoles(snap.docs.map((d) => ({
        id:          d.id,
        name:        (d.get("name")        as string)   || d.id,
        permissions: (d.get("permissions") as string[]) ?? [],
        protected:   (d.get("protected")   as boolean)  ?? false,
      })))
    );
    return () => unsub();
  }, []);

  function startEdit(role: BackofficeRole) {
    setEditing(role);
    setForm({ name: role.name, permissions: new Set(role.permissions as Permission[]) });
    setNameError(null);
    setError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setForm(defaultForm);
    setNameError(null);
    setError(null);
  }

  function togglePermission(p: Permission) {
    setForm((prev) => {
      const next = new Set(prev.permissions);
      next.has(p) ? next.delete(p) : next.add(p);
      return { ...prev, permissions: next };
    });
  }

  async function handleSave() {
    const trimmedName = form.name.trim();
    if (!trimmedName) { setNameError("El nombre del rol es obligatorio."); return; }
    setNameError(null);

    const db = getFirestoreDb();
    if (!db) { setError("Firebase no está configurado."); return; }

    setIsSaving(true);
    setError(null);

    try {
      const permissions = Array.from(form.permissions);

      if (editing) {
        await updateDoc(doc(db, "BackofficeRoles", editing.id), {
          name: trimmedName, permissions, updatedAt: serverTimestamp(),
        });
        showToast("Rol actualizado.");
        cancelEdit();
      } else {
        const slug = toSlug(trimmedName);
        if (!slug) { setError("El nombre no generó un ID válido."); return; }
        if (roles.find((r) => r.id === slug)) { setError(`Ya existe un rol con el ID "${slug}".`); return; }
        await setDoc(doc(db, "BackofficeRoles", slug), {
          name: trimmedName, permissions, protected: false,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        showToast("Rol creado.");
        setForm(defaultForm);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(role: BackofficeRole) {
    if (!confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) return;
    const db = getFirestoreDb();
    if (!db) return;
    setIsDeleting(role.id);
    try {
      await deleteDoc(doc(db, "BackofficeRoles", role.id));
      showToast("Rol eliminado.");
      if (editing?.id === role.id) cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar.");
    } finally {
      setIsDeleting(null);
    }
  }

  const isEditing = editing !== null;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Roles y Permisos</h2>
        <p className="mt-2 text-sm text-slate-600">
          Define roles y los permisos asociados. El rol <strong>admin</strong> es del propietario y no se puede modificar desde aquí.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Lista de roles ── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Roles</h3>
              <p className="text-sm text-slate-600">Roles configurados en el sistema.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {roles.length + 1} roles
            </span>
          </div>

          <div className="space-y-2">
            {/* Admin — siempre presente, protegido */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Administrador</p>
                <p className="text-xs text-slate-400">admin · Todos los permisos · Protegido</p>
              </div>
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                Propietario
              </span>
            </div>

            {roles.map((role) => (
              <div
                key={role.id}
                onClick={() => startEdit(role)}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50 ${
                  editing?.id === role.id
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{role.name}</p>
                  <p className="text-xs text-slate-400">
                    {role.id}
                    {role.permissions.length > 0
                      ? ` · ${role.permissions.map((p) => PERMISSION_LABELS[p as Permission] ?? p).join(", ")}`
                      : " · Sin permisos"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isDeleting === role.id}
                  onClick={(e) => { e.stopPropagation(); void handleDelete(role); }}
                  className="rounded px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  {isDeleting === role.id ? "..." : "Eliminar"}
                </button>
              </div>
            ))}

            {roles.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-400">No hay roles creados aún.</p>
            )}
          </div>
        </article>

        {/* ── Formulario siempre visible ── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {isEditing ? `Editar: ${editing.name}` : "Nuevo rol"}
              </h3>
              <p className="mt-0.5 text-sm text-slate-600">
                {isEditing ? "Modifica el nombre y los permisos." : "Asigna un nombre y permisos al nuevo rol."}
              </p>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                Cancelar
              </button>
            )}
          </div>

          <div className="space-y-5">
            <FormInput
              label="Nombre del rol"
              value={form.name}
              onChange={(v) => { setForm((p) => ({ ...p, name: v })); setNameError(null); }}
              placeholder="Ej. Supervisor Regional"
              error={nameError ?? undefined}
            />

            {!isEditing && form.name.trim() && (
              <p className="text-xs text-slate-400">
                ID: <span className="font-mono">{toSlug(form.name)}</span>
              </p>
            )}

            <fieldset>
              <legend className="mb-3 text-sm font-medium text-slate-700">Permisos</legend>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {ASSIGNABLE_PERMISSIONS.map((p) => (
                  <label key={p} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={form.permissions.has(p)}
                      onChange={() => togglePermission(p)}
                      className="h-4 w-4 rounded accent-slate-900"
                    />
                    <span className="text-sm font-medium text-slate-900">{PERMISSION_LABELS[p]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear rol"}
            </button>
          </div>
        </article>

      </div>
    </section>
  );
}
