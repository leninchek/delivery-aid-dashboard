"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { getFirestoreDb } from "@/lib/firebase";
import { showToast } from "@/hooks/useToast";
import { validateMexicanPhone } from "@/utils/validators";
import { parseCsvImport, downloadCsvTemplate } from "@/utils/csv-import";
import type { CreateUserPayload } from "@/types/app-user";
import type { CsvParseResult, CsvRowError } from "@/utils/csv-import";

// ── Local types ───────────────────────────────────────────────────────────────

type AppUserRow = {
  uid:                string;
  phone:              string;
  name:               string;
  orgMemberId:        string;
  levelId:            string;
  active:             boolean;
  mustChangePassword: boolean;
  onboardingComplete: boolean;
};

type OrgLevel    = { id: string; name: string; rank: number; canUseApp: boolean };
type OrgMember   = { id: string; name: string; levelId: string; phone: string };
type CatalogItem = { id: string; name: string };
type Community   = { id: string; name: string; cityId: string | null };

type CreateForm = {
  phone:       string;
  levelId:     string;
  parentId:    string;
  cityId:      string;
  communityId: string;
  routeId:     string;
};

const defaultForm: CreateForm = {
  phone: "", levelId: "", parentId: "",
  cityId: "", communityId: "", routeId: "",
};

type PasswordBanner = {
  action:       "created" | "reset";
  phone:        string;
  tempPassword: string;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AppUsersPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars  = getMissingFirebaseEnvVars();

  const [systemUsers, setSystemUsers] = useState<AppUserRow[]>([]);
  const [orgLevels,   setOrgLevels]   = useState<OrgLevel[]>([]);
  const [orgMembers,  setOrgMembers]  = useState<OrgMember[]>([]);
  const [cities,      setCities]      = useState<CatalogItem[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [routes,      setRoutes]      = useState<CatalogItem[]>([]);

  const [levelFilter,  setLevelFilter]  = useState("");
  const [form,         setForm]         = useState<CreateForm>(defaultForm);
  const [fieldErrors,  setFieldErrors]  = useState<Partial<Record<keyof CreateForm, string>>>({});
  const [isSaving,     setIsSaving]     = useState(false);
  const [banner,       setBanner]       = useState<PasswordBanner | null>(null);
  const [resettingUid, setResettingUid] = useState<string | null>(null);
  const [togglingUid,  setTogglingUid]  = useState<string | null>(null);

  // ── Carga masiva ──────────────────────────────────────────────────────────
  const csvInputRef                          = useRef<HTMLInputElement>(null);
  const [csvPreview,    setCsvPreview]       = useState<CsvParseResult | null>(null);
  const [csvFileName,   setCsvFileName]      = useState("");
  const [isImporting,   setIsImporting]      = useState(false);
  const [importResult,  setImportResult]     = useState<{
    total: number; succeeded: number; failed: number; errors: CsvRowError[];
  } | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    const db = getFirestoreDb();
    if (!db) return;

    const unsubs = [
      onSnapshot(query(collection(db, "SystemUsers"), orderBy("createdAt", "desc")), (snap) =>
        setSystemUsers(
          snap.docs
            .filter((d) => d.get("type") === "app")
            .map((d) => ({
              uid:                d.id,
              phone:              d.get("phone")              || "",
              name:               d.get("name")               || "",
              orgMemberId:        d.get("orgMemberId")         || "",
              levelId:            "",
              active:             d.get("active")             ?? true,
              mustChangePassword: d.get("mustChangePassword") ?? false,
              onboardingComplete: d.get("onboardingComplete") ?? false,
            }))
        )
      ),
      onSnapshot(query(collection(db, "OrgLevels"), orderBy("rank", "asc")), (snap) =>
        setOrgLevels(snap.docs.map((d) => ({
          id:        d.id,
          name:      d.get("name")     || "",
          rank:      d.get("rank")     ?? 999,
          canUseApp: Boolean(d.get("canUseApp")),
        })))
      ),
      onSnapshot(query(collection(db, "OrgMembers"), orderBy("name", "asc")), (snap) =>
        setOrgMembers(snap.docs.map((d) => ({
          id:      d.id,
          name:    d.get("name")    || "",
          levelId: d.get("levelId") || "",
          phone:   d.get("phone")   || "",
        })))
      ),
      onSnapshot(query(collection(db, "Cities"),      orderBy("name", "asc")), (snap) =>
        setCities(snap.docs.map((d) => ({ id: d.id, name: d.get("name") || "" })))
      ),
      onSnapshot(query(collection(db, "Communities"), orderBy("name", "asc")), (snap) =>
        setCommunities(snap.docs.map((d) => ({
          id:     d.id,
          name:   d.get("name")   || "",
          cityId: d.get("cityId") || null,
        })))
      ),
      onSnapshot(query(collection(db, "Routes"),      orderBy("name", "asc")), (snap) =>
        setRoutes(snap.docs.map((d) => ({ id: d.id, name: d.get("name") || "" })))
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [isConfigured]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const levelById = useMemo(() => new Map(orgLevels.map((l) => [l.id, l])), [orgLevels]);

  const memberById = useMemo(() => new Map(orgMembers.map((m) => [m.id, m])), [orgMembers]);

  const rows = useMemo(() => {
    return systemUsers.map((u) => ({
      ...u,
      levelId: memberById.get(u.orgMemberId)?.levelId ?? "",
    }));
  }, [systemUsers, memberById]);

  const filteredRows = useMemo(() =>
    levelFilter ? rows.filter((r) => r.levelId === levelFilter) : rows,
    [rows, levelFilter]
  );

  const appLevels = useMemo(() => orgLevels.filter((l) => l.canUseApp), [orgLevels]);

  const filteredCommunities = useMemo(() =>
    form.cityId
      ? communities.filter((c) => c.cityId === form.cityId)
      : communities,
    [communities, form.cityId]
  );

  const sortedOrgMembers = useMemo(() =>
    [...orgMembers].sort((a, b) => {
      const rankA = levelById.get(a.levelId)?.rank ?? 999;
      const rankB = levelById.get(b.levelId)?.rank ?? 999;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name, "es");
    }),
    [orgMembers, levelById]
  );

  function memberLabel(m: OrgMember): string {
    const level = levelById.get(m.levelId);
    const label = m.name || m.phone || m.id;
    return level ? `${label} (${level.name})` : label;
  }

  // ── Field helpers ─────────────────────────────────────────────────────────
  function setField<K extends keyof CreateForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  // ── Create user ───────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<keyof CreateForm, string>> = {};

    const phoneErr = validateMexicanPhone(form.phone);
    if (phoneErr) errs.phone = phoneErr;
    if (!form.levelId) errs.levelId = "El nivel es obligatorio.";

    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});

    const payload: CreateUserPayload = {
      phone:       form.phone.replace(/\D/g, ""),
      levelId:     form.levelId,
      parentId:    form.parentId    || null,
      cityId:      form.cityId      || null,
      communityId: form.communityId || null,
      routeId:     form.routeId     || null,
    };

    setIsSaving(true);
    try {
      const res  = await fetch("/api/users/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; phone?: string; tempPassword?: string };

      if (!res.ok) throw new Error(data.error ?? "Error al crear el usuario.");

      setBanner({ action: "created", phone: data.phone!, tempPassword: data.tempPassword! });
      setForm(defaultForm);
      showToast("Usuario creado correctamente.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al crear el usuario.");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Reset password ────────────────────────────────────────────────────────
  async function handleResetPassword(uid: string, phone: string) {
    setResettingUid(uid);
    try {
      const res  = await fetch("/api/users/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ uid }),
      });
      const data = (await res.json()) as { error?: string; tempPassword?: string };

      if (!res.ok) throw new Error(data.error ?? "Error al restablecer la contraseña.");

      setBanner({ action: "reset", phone, tempPassword: data.tempPassword! });
      showToast("Contraseña reseteada.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al restablecer la contraseña.");
    } finally {
      setResettingUid(null);
    }
  }

  // ── Toggle status ─────────────────────────────────────────────────────────
  async function handleToggle(uid: string, active: boolean) {
    setTogglingUid(uid);
    try {
      const res = await fetch("/api/users/toggle-status", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ uid, active }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Error al cambiar estado.");
      }
      showToast(active ? "Usuario activado." : "Usuario desactivado.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al cambiar estado.");
    } finally {
      setTogglingUid(null);
    }
  }

  // ── CSV file selected ─────────────────────────────────────────────────────
  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setCsvPreview(parseCsvImport(content));
    };
    reader.readAsText(file, 'utf-8');
  }

  // ── Run import ────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!csvPreview || csvPreview.valid.length === 0) return;

    const endpoint = process.env.NEXT_PUBLIC_IMPORT_USERS_URL;
    if (!endpoint) {
      showToast("Falta NEXT_PUBLIC_IMPORT_USERS_URL. La función no está configurada.");
      return;
    }

    // Re-read the file to send raw CSV to the Cloud Function
    const file = csvInputRef.current?.files?.[0];
    if (!file) { showToast("Selecciona el archivo CSV de nuevo."); return; }

    setIsImporting(true);
    try {
      const content  = await file.text();
      const auth     = getAuth();
      const user     = auth.currentUser;
      if (!user) throw new Error("No autenticado.");
      const idToken  = await user.getIdToken();

      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body:    JSON.stringify({ csvContent: content }),
      });

      const data = (await res.json()) as {
        total: number; succeeded: number; failed: number; errors: CsvRowError[];
        error?: string;
      };

      if (!res.ok) throw new Error(data.error ?? "Error en la importación.");

      setImportResult(data);
      setCsvPreview(null);
      setCsvFileName("");
      if (csvInputRef.current) csvInputRef.current.value = "";
      showToast(`Importación completa: ${data.succeeded} creados, ${data.failed} fallidos.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al importar.");
    } finally {
      setIsImporting(false);
    }
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Acceso App</h2>
        <p className="mt-2 text-sm text-slate-600">
          Gestión centralizada de todos los usuarios con acceso a la aplicación móvil.
        </p>
      </header>

      {/* ── Banner de contraseña temporal ─────────────────────────────────── */}
      {banner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                {banner.action === "created" ? "Usuario creado." : "Contraseña reseteada."}
                {" "}Comparte estas credenciales por WhatsApp.
              </p>
              <div className="mt-3 flex flex-wrap gap-6">
                <div>
                  <p className="text-xs font-medium text-emerald-600">Teléfono</p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-emerald-900">{banner.phone}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-emerald-600">Contraseña temporal</p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-emerald-900">{banner.tempPassword}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-emerald-600">
                El usuario deberá cambiarla en su primer inicio de sesión.
              </p>
              <a
                href={`https://wa.me/52${banner.phone}?text=${encodeURIComponent(`Hola, tu cuenta en Entrega de Apoyos ha sido creada.\nTeléfono: ${banner.phone}\nContraseña temporal: ${banner.tempPassword}\nCámbiala en tu primer inicio de sesión.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1ebe5d]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.532 5.856L.054 23.447a.75.75 0 0 0 .916.948l5.724-1.503A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.703 9.703 0 0 1-4.95-1.354l-.355-.211-3.676.965.981-3.584-.231-.368A9.699 9.699 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
                Enviar por WhatsApp
              </a>
            </div>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="shrink-0 text-emerald-400 hover:text-emerald-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">

        {/* ── Tabla ────────────────────────────────────────────────────────── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Usuarios</h3>
              <p className="text-sm text-slate-600">Todos los niveles con acceso a la App.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {filteredRows.length} usuarios
            </span>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">Filtrar por nivel</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900 sm:w-64"
            >
              <option value="">Todos los niveles</option>
              {appLevels.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Nivel</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Alta</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredRows.map((user) => {
                  const level = levelById.get(user.levelId);
                  return (
                    <tr key={user.uid} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-700">{user.phone || "-"}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {user.name || (
                          <span className="text-slate-400 italic">Sin completar</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{level?.name ?? "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}>
                          {user.active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.onboardingComplete ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            Completo
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleResetPassword(user.uid, user.phone)}
                            disabled={resettingUid === user.uid}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {resettingUid === user.uid ? "Restableciendo..." : "Restablecer contraseña"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggle(user.uid, !user.active)}
                            disabled={togglingUid === user.uid}
                            className={`rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                              user.active
                                ? "border-rose-300 text-rose-700 hover:bg-rose-50"
                                : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {togglingUid === user.uid
                              ? "..."
                              : user.active ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      {levelFilter
                        ? "No hay usuarios en este nivel."
                        : "Aún no hay usuarios de App. Crea el primero."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        {/* ── Formulario de alta ────────────────────────────────────────────── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold">Nuevo usuario</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            El activista completará su perfil en el primer inicio de sesión.
          </p>

          <form className="mt-6 space-y-4" onSubmit={(e) => void handleCreate(e)}>

            {/* Teléfono */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Teléfono</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value.replace(/\D/g, ""))}
                placeholder="5512345678"
                className={`w-full rounded-lg border px-3 py-2 font-mono outline-none transition focus:border-slate-900 ${
                  fieldErrors.phone ? "border-rose-400 bg-rose-50" : "border-slate-300"
                }`}
              />
              {fieldErrors.phone && (
                <p className="text-xs text-rose-600">{fieldErrors.phone}</p>
              )}
              <p className="text-xs text-slate-400">
                La contraseña inicial serán los últimos 6 dígitos.
              </p>
            </div>

            {/* Nivel organizacional */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Nivel organizacional</label>
              <select
                value={form.levelId}
                onChange={(e) => setField("levelId", e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 outline-none transition focus:border-slate-900 ${
                  fieldErrors.levelId ? "border-rose-400 bg-rose-50" : "border-slate-300"
                }`}
              >
                <option value="">Selecciona un nivel</option>
                {appLevels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              {fieldErrors.levelId && (
                <p className="text-xs text-rose-600">{fieldErrors.levelId}</p>
              )}
            </div>

            {/* Superior jerárquico */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Superior jerárquico <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <select
                value={form.parentId}
                onChange={(e) => setField("parentId", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                <option value="">Sin asignar</option>
                {sortedOrgMembers.map((m) => (
                  <option key={m.id} value={m.id}>{memberLabel(m)}</option>
                ))}
              </select>
            </div>

            {/* Ciudad */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Ciudad <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <select
                value={form.cityId}
                onChange={(e) => {
                  setField("cityId", e.target.value);
                  setField("communityId", "");
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                <option value="">Sin asignar</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Comunidad */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Comunidad <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <select
                value={form.communityId}
                onChange={(e) => setField("communityId", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                <option value="">Sin asignar</option>
                {filteredCommunities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Ruta */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Ruta <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <select
                value={form.routeId}
                onChange={(e) => setField("routeId", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                <option value="">Sin asignar</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? "Creando usuario..." : "Crear usuario"}
            </button>
          </form>
        </article>

      </div>

      {/* ── Carga masiva ──────────────────────────────────────────────────── */}
      <article className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Carga masiva</h3>
            <p className="mt-0.5 text-sm text-slate-600">
              Importa hasta 500 usuarios desde un archivo CSV. La contraseña inicial son los últimos 6 dígitos del teléfono.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadCsvTemplate}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Descargar plantilla
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* File picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Archivo CSV
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFile}
                disabled={isImporting}
                className="mt-2 block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-medium hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            {csvFileName && (
              <p className="mt-1 text-xs text-slate-400">Archivo: {csvFileName}</p>
            )}
          </div>

          {/* Preview */}
          {csvPreview && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  <span className="font-semibold text-slate-800">{csvPreview.totalRows}</span>
                  <span className="ml-1 text-slate-500">filas detectadas</span>
                </span>
                <span>
                  <span className="font-semibold text-emerald-700">{csvPreview.valid.length}</span>
                  <span className="ml-1 text-slate-500">válidas</span>
                </span>
                {csvPreview.errors.length > 0 && (
                  <span>
                    <span className="font-semibold text-rose-600">{csvPreview.errors.length}</span>
                    <span className="ml-1 text-slate-500">con errores de formato</span>
                  </span>
                )}
              </div>

              {csvPreview.errors.length > 0 && (
                <div className="overflow-x-auto rounded border border-rose-200">
                  <table className="min-w-full divide-y divide-rose-100 text-xs">
                    <thead className="bg-rose-50 text-rose-700">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Fila</th>
                        <th className="px-3 py-2 text-left font-medium">Teléfono</th>
                        <th className="px-3 py-2 text-left font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100 bg-white">
                      {csvPreview.errors.map((err) => (
                        <tr key={`${err.row}-${err.phone}`}>
                          <td className="px-3 py-1.5 tabular-nums text-slate-600">{err.row}</td>
                          <td className="px-3 py-1.5 font-mono text-slate-700">{err.phone || "-"}</td>
                          <td className="px-3 py-1.5 text-rose-700">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={isImporting || csvPreview.valid.length === 0}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isImporting
                  ? "Importando..."
                  : `Importar ${csvPreview.valid.length} usuario${csvPreview.valid.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className={`rounded-xl border p-5 ${
              importResult.failed === 0
                ? "border-emerald-200 bg-emerald-50"
                : importResult.succeeded === 0
                  ? "border-rose-200 bg-rose-50"
                  : "border-amber-200 bg-amber-50"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Importación completada —{" "}
                    {importResult.succeeded} creados, {importResult.failed} fallidos de {importResult.total} filas.
                  </p>
                  {importResult.succeeded > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      Los usuarios podrán iniciar sesión con su teléfono y los últimos 6 dígitos como contraseña temporal.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setImportResult(null)}
                  className="shrink-0 text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              {importResult.errors.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded border border-rose-200">
                  <table className="min-w-full divide-y divide-rose-100 text-xs">
                    <thead className="bg-rose-50 text-rose-700">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Fila</th>
                        <th className="px-3 py-2 text-left font-medium">Teléfono</th>
                        <th className="px-3 py-2 text-left font-medium">Razón</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100 bg-white">
                      {importResult.errors.map((err) => (
                        <tr key={`${err.row}-${err.phone}`}>
                          <td className="px-3 py-1.5 tabular-nums text-slate-600">{err.row}</td>
                          <td className="px-3 py-1.5 font-mono text-slate-700">{err.phone || "-"}</td>
                          <td className="px-3 py-1.5 text-rose-700">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </article>

    </section>
  );
}
