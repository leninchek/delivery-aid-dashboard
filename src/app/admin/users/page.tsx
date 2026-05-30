"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { FormInput } from "@/components/form/FormInput";
import { FormSelect } from "@/components/form/FormSelect";
import { getFirestoreDb } from "@/lib/firebase";
import { apiFetch } from "@/lib/api-fetch";
import { showToast } from "@/hooks/useToast";
import type { BackofficeUser, CreateBackofficeUserPayload, UpdateBackofficeUserPayload } from "@/types/backoffice-user";

type RoleOption = { id: string; name: string };

type CreateForm = { email: string; password: string; name: string; roleId: string };
const defaultCreateForm: CreateForm = { email: "", password: "", name: "", roleId: "" };

type EditForm = { name: string; roleId: string; active: boolean };

export default function AdminUsersPage() {
  return (
    <PermissionGuard permission="admin">
      <AdminUsersContent />
    </PermissionGuard>
  );
}

function AdminUsersContent() {
  const [users,        setUsers]        = useState<BackofficeUser[]>([]);
  const [roles,        setRoles]        = useState<RoleOption[]>([]);
  const [editingUser,  setEditingUser]  = useState<BackofficeUser | null>(null);
  const [createForm,   setCreateForm]   = useState<CreateForm>(defaultCreateForm);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [editForm,     setEditForm]     = useState<EditForm | null>(null);
  const [isSaving,     setIsSaving]     = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db) return;

    const u1 = onSnapshot(
      query(collection(db, "SystemUsers"), orderBy("name", "asc")),
      (snap) => setUsers(
        snap.docs
          .filter((d) => d.get("type") === "backoffice")
          .map((d) => ({
            uid:           d.id,
            email:         (d.get("email") as string)          || "",
            name:          (d.get("name")  as string)          || "",
            backofficeRole: (d.get("backofficeRole") as string) || "",
            active:        (d.get("active") as boolean)        ?? true,
            createdAt:     d.get("createdAt") instanceof Timestamp
              ? (d.get("createdAt") as Timestamp).toDate()
              : null,
          }))
      )
    );

    const u2 = onSnapshot(
      query(collection(db, "BackofficeRoles"), orderBy("name", "asc")),
      (snap) => setRoles(snap.docs.map((d) => ({
        id:   d.id,
        name: (d.get("name") as string) || d.id,
      })))
    );

    return () => { u1(); u2(); };
  }, []);

  function setCreateField(key: keyof CreateForm, value: string) {
    setCreateForm((p) => ({ ...p, [key]: value }));
    setCreateErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  }

  function startEdit(user: BackofficeUser) {
    setEditingUser(user);
    setEditForm({ name: user.name, roleId: user.backofficeRole, active: user.active });
    setError(null);
  }

  function cancelEdit() {
    setEditingUser(null);
    setEditForm(null);
    setError(null);
  }

  async function handleCreate() {
    const errs: Record<string, string> = {};
    if (!createForm.email.trim())                errs.email    = "El correo es obligatorio.";
    if (!createForm.password.trim())             errs.password = "La contraseña es obligatoria.";
    else if (createForm.password.length < 6)     errs.password = "Mínimo 6 caracteres.";
    if (!createForm.name.trim())                 errs.name     = "El nombre es obligatorio.";
    if (!createForm.roleId)                      errs.roleId   = "El rol es obligatorio.";
    if (Object.keys(errs).length > 0) { setCreateErrors(errs); return; }

    setIsSaving(true);
    setError(null);
    try {
      const payload: CreateBackofficeUserPayload = {
        email:    createForm.email.trim().toLowerCase(),
        password: createForm.password,
        name:     createForm.name.trim(),
        roleId:   createForm.roleId,
      };
      const res  = await apiFetch("/api/backoffice-users/create", { method: "POST", body: JSON.stringify(payload) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? "Error al crear el usuario."); return; }
      showToast("Usuario creado correctamente.");
      setCreateForm(defaultCreateForm);
      setCreateErrors({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editingUser || !editForm) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload: UpdateBackofficeUserPayload = {
        uid:    editingUser.uid,
        name:   editForm.name.trim() || undefined,
        roleId: editForm.roleId      || undefined,
        active: editForm.active,
      };
      const res  = await apiFetch("/api/backoffice-users/update", { method: "PATCH", body: JSON.stringify(payload) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? "Error al actualizar."); return; }
      showToast("Usuario actualizado.");
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setIsSaving(false);
    }
  }

  const isEditing = editingUser !== null;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Usuarios Back Office</h2>
        <p className="mt-2 text-sm text-slate-600">
          Gestiona las cuentas con acceso a este panel. Cada usuario debe tener un rol asignado.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr]">

        {/* ── Lista ── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Usuarios</h3>
              <p className="text-sm text-slate-600">{users.length} {users.length === 1 ? "cuenta" : "cuentas"} Back Office.</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {users.map((u) => {
                  const roleLabel = roles.find((r) => r.id === u.backofficeRole)?.name
                    ?? (u.backofficeRole === "admin" ? "Administrador" : u.backofficeRole);
                  const isSelected = editingUser?.uid === u.uid;
                  return (
                    <tr
                      key={u.uid}
                      onClick={() => u.backofficeRole !== "admin" && startEdit(u)}
                      className={`transition ${
                        u.backofficeRole === "admin"
                          ? "cursor-default"
                          : "cursor-pointer hover:bg-slate-50"
                      } ${isSelected ? "bg-slate-50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{u.name || "—"}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{roleLabel}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          {u.active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={3}>
                      No hay usuarios Back Office registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        {/* ── Panel derecho: siempre visible ── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {isEditing ? "Editar usuario" : "Nuevo usuario"}
              </h3>
              <p className="mt-0.5 text-sm text-slate-600 truncate">
                {isEditing ? editingUser.email : "Crea una cuenta con acceso al Back Office."}
              </p>
            </div>
            {isEditing && (
              <button type="button" onClick={cancelEdit} className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Cancelar
              </button>
            )}
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          {isEditing && editForm ? (
            /* ── Editar ── */
            <div className="space-y-4">
              <FormInput
                label="Nombre completo"
                value={editForm.name}
                onChange={(v) => setEditForm((p) => p ? { ...p, name: v } : p)}
                placeholder="Nombre del usuario"
              />
              <FormSelect
                label="Rol"
                value={editForm.roleId}
                onChange={(v) => setEditForm((p) => p ? { ...p, roleId: v } : p)}
              >
                <option value="">Sin rol</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </FormSelect>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) => setEditForm((p) => p ? { ...p, active: e.target.checked } : p)}
                  className="h-4 w-4 rounded accent-slate-900"
                />
                <span className="text-sm font-medium text-slate-900">Cuenta activa</span>
              </label>
              <button
                type="button"
                onClick={() => void handleUpdate()}
                disabled={isSaving}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSaving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          ) : (
            /* ── Crear ── */
            <div className="space-y-4">
              <FormInput
                label="Correo electrónico"
                type="email"
                value={createForm.email}
                onChange={(v) => setCreateField("email", v)}
                placeholder="usuario@ejemplo.com"
                error={createErrors.email}
              />
              <FormInput
                label="Contraseña temporal"
                type="password"
                value={createForm.password}
                onChange={(v) => setCreateField("password", v)}
                placeholder="Mínimo 6 caracteres"
                error={createErrors.password}
              />
              <FormInput
                label="Nombre completo"
                value={createForm.name}
                onChange={(v) => setCreateField("name", v)}
                placeholder="Nombre del usuario"
                error={createErrors.name}
              />
              <FormSelect
                label="Rol"
                value={createForm.roleId}
                onChange={(v) => setCreateField("roleId", v)}
                error={createErrors.roleId}
              >
                <option value="">Selecciona un rol</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </FormSelect>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={isSaving}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSaving ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          )}
        </article>

      </div>
    </section>
  );
}
