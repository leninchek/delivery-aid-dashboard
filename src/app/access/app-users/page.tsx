"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { getFirestoreDb } from "@/lib/firebase";
import { showToast } from "@/hooks/useToast";
import { validateAppUserCreate } from "@/utils/validators";
import { parseCsvImport } from "@/utils/csv-import";
import type { CsvParseResult } from "@/utils/csv-import";
import type { CreateUserPayload } from "@/types/app-user";
import { UserList } from "./UserList";
import { CreateUserForm } from "./CreateUserForm";
import { BulkImportSection } from "./BulkImportSection";
import type { ImportResult } from "./BulkImportSection";

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

  const csvInputRef                        = useRef<HTMLInputElement>(null);
  const [csvPreview,   setCsvPreview]      = useState<CsvParseResult | null>(null);
  const [csvFileName,  setCsvFileName]     = useState("");
  const [isImporting,  setIsImporting]     = useState(false);
  const [importResult, setImportResult]    = useState<ImportResult | null>(null);

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

  const rows = useMemo(() =>
    systemUsers.map((u) => ({
      ...u,
      levelId: memberById.get(u.orgMemberId)?.levelId ?? "",
    })),
    [systemUsers, memberById]
  );

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
  function setField(key: keyof CreateForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  // ── Create user ───────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validateAppUserCreate(form);
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
      const endpoint = process.env.NEXT_PUBLIC_CREATE_APP_USER_URL;
      if (!endpoint) { showToast("Falta NEXT_PUBLIC_CREATE_APP_USER_URL."); return; }

      const currentUser = getAuth().currentUser;
      if (!currentUser) { showToast("No autenticado."); return; }
      const idToken = await currentUser.getIdToken();

      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
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
      const endpoint = process.env.NEXT_PUBLIC_RESET_APP_USER_PASSWORD_URL;
      if (!endpoint) { showToast("Falta NEXT_PUBLIC_RESET_APP_USER_PASSWORD_URL."); return; }

      const currentUser = getAuth().currentUser;
      if (!currentUser) { showToast("No autenticado."); return; }
      const idToken = await currentUser.getIdToken();

      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
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
      const endpoint = process.env.NEXT_PUBLIC_TOGGLE_APP_USER_STATUS_URL;
      if (!endpoint) { showToast("Falta NEXT_PUBLIC_TOGGLE_APP_USER_STATUS_URL."); return; }

      const currentUser = getAuth().currentUser;
      if (!currentUser) { showToast("No autenticado."); return; }
      const idToken = await currentUser.getIdToken();

      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
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
    reader.readAsText(file, "utf-8");
  }

  // ── Run import ────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!csvPreview || csvPreview.valid.length === 0) return;

    const endpoint = process.env.NEXT_PUBLIC_IMPORT_USERS_URL;
    if (!endpoint) {
      showToast("Falta NEXT_PUBLIC_IMPORT_USERS_URL. La función no está configurada.");
      return;
    }

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

      const data = (await res.json()) as ImportResult & { error?: string };

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
        <UserList
          rows={filteredRows}
          levelFilter={levelFilter}
          setLevelFilter={setLevelFilter}
          appLevels={appLevels}
          levelById={levelById}
          resettingUid={resettingUid}
          togglingUid={togglingUid}
          onResetPassword={handleResetPassword}
          onToggle={handleToggle}
        />
        <CreateUserForm
          form={form}
          fieldErrors={fieldErrors}
          isSaving={isSaving}
          appLevels={appLevels}
          sortedOrgMembers={sortedOrgMembers}
          cities={cities}
          filteredCommunities={filteredCommunities}
          routes={routes}
          memberLabel={memberLabel}
          setField={setField}
          onSubmit={(e) => void handleCreate(e)}
        />
      </div>

      <BulkImportSection
        csvInputRef={csvInputRef}
        csvPreview={csvPreview}
        csvFileName={csvFileName}
        isImporting={isImporting}
        importResult={importResult}
        onFileChange={handleCsvFile}
        onImport={() => void handleImport()}
        onDismissResult={() => setImportResult(null)}
      />
    </section>
  );
}
