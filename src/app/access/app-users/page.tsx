"use client";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { useAuth } from "@/components/auth/auth-provider";
import { getFirestoreDb, getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";

type OrgLevel = {
  id: string;
  name: string;
  canUseApp: boolean;
};

type OrgMember = {
  id: string;
  name: string;
  levelId: string;
  active: boolean;
  appUserId: string | null;
  birthDate: Date | null;
};

type AppSystemUser = {
  id: string;
  email: string;
  name: string;
  orgMemberId: string;
  active: boolean;
};

type CreateAccessForm = {
  orgMemberId: string;
  email: string;
  password: string;
};

const defaultForm: CreateAccessForm = {
  orgMemberId: "",
  email: "",
  password: "",
};

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let result = "";

  for (let i = 0; i < 12; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

function mapSignUpError(message: string): string {
  switch (message) {
    case "EMAIL_EXISTS":
      return "El email ya existe en Authentication.";
    case "INVALID_EMAIL":
      return "El email no es valido.";
    case "WEAK_PASSWORD : Password should be at least 6 characters":
      return "El password debe tener al menos 6 caracteres.";
    default:
      return "No fue posible crear la cuenta App en Authentication.";
  }
}

async function createFirebaseAuthUser(email: string, password: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error("Falta NEXT_PUBLIC_FIREBASE_API_KEY para crear cuentas App.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: false,
      }),
    }
  );

  const data = (await response.json()) as {
    localId?: string;
    error?: { message?: string };
  };

  if (!response.ok || !data.localId) {
    throw new Error(mapSignUpError(data.error?.message || ""));
  }

  return data.localId;
}

export default function AppUsersPage() {
  const { sessionUser } = useAuth();

  const [orgLevels, setOrgLevels] = useState<OrgLevel[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [appUsers, setAppUsers] = useState<AppSystemUser[]>([]);
  const [form, setForm] = useState<CreateAccessForm>(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isConfigured = hasFirebaseConfig();
  const missingVars = getMissingFirebaseEnvVars();
  const isAdmin = sessionUser?.backofficeRole === "admin";

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    const firestoreDb = getFirestoreDb();

    if (!firestoreDb) {
      return;
    }

    const unsubscribers = [
      onSnapshot(
        query(collection(firestoreDb, "OrgLevels"), orderBy("rank", "asc")),
        (snapshot) => {
          setOrgLevels(
            snapshot.docs.map((item) => ({
              id: item.id,
              name: item.get("name") || "",
              canUseApp: Boolean(item.get("canUseApp")),
            }))
          );
        },
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        query(collection(firestoreDb, "OrgMembers"), orderBy("name", "asc")),
        (snapshot) => {
          setOrgMembers(
            snapshot.docs.map((item) => {
              const birthDateRaw = item.get("birthDate");
              let birthDate: Date | null = null;
              if (birthDateRaw instanceof Date) {
                birthDate = birthDateRaw;
              } else if (
                typeof birthDateRaw === "object" &&
                birthDateRaw !== null &&
                "toDate" in birthDateRaw
              ) {
                birthDate = (birthDateRaw as { toDate: () => Date }).toDate();
              }

              return {
                id: item.id,
                name: item.get("name") || "",
                levelId: item.get("levelId") || "",
                active: item.get("active") ?? true,
                appUserId: item.get("appUserId") || null,
                birthDate,
              };
            })
          );
        },
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        query(collection(firestoreDb, "SystemUsers"), orderBy("createdAt", "desc")),
        (snapshot) => {
          setAppUsers(
            snapshot.docs
              .map((item) => ({
                id: item.id,
                email: item.get("email") || "",
                name: item.get("name") || "",
                orgMemberId: item.get("orgMemberId") || "",
                active: item.get("active") ?? true,
                type: item.get("type") || "",
              }))
              .filter((item) => item.type === "app")
              .map((item) => ({
                id: item.id,
                email: item.email,
                name: item.name,
                orgMemberId: item.orgMemberId,
                active: item.active,
              }))
          );
        },
        (snapshotError) => setError(snapshotError.message)
      ),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [isConfigured]);

  const levelById = useMemo(() => new Map(orgLevels.map((level) => [level.id, level])), [orgLevels]);
  const orgMemberById = useMemo(
    () => new Map(orgMembers.map((member) => [member.id, member])),
    [orgMembers]
  );

  const eligibleMembers = useMemo(
    () =>
      orgMembers.filter((member) => {
        const level = levelById.get(member.levelId);
        return member.active && !member.appUserId && Boolean(level?.canUseApp);
      }),
    [levelById, orgMembers]
  );

  useEffect(() => {
    if (!form.orgMemberId && eligibleMembers.length > 0) {
      setForm((current) => ({ ...current, orgMemberId: eligibleMembers[0].id }));
    }
  }, [eligibleMembers, form.orgMemberId]);

  async function toggleAppUserStatus(user: AppSystemUser) {
    setError(null);
    setSuccess(null);

    const firestoreDb = getFirestoreDb();
    if (!firestoreDb) {
      setError("Firestore no esta configurado.");
      return;
    }

    try {
      await updateDoc(doc(firestoreDb, "SystemUsers", user.id), {
        active: !user.active,
        updatedAt: serverTimestamp(),
      });
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "No fue posible actualizar el estado de la cuenta App."
      );
    }
  }

  async function handleCreateAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isAdmin) {
      setError("Solo admin puede ejecutar Create App Access.");
      return;
    }

    const firestoreDb = getFirestoreDb();
    if (!firestoreDb) {
      setError("Firestore no esta configurado.");
      return;
    }

    const selectedMember = orgMemberById.get(form.orgMemberId);

    if (!selectedMember) {
      setError("Selecciona un OrgMember valido.");
      return;
    }

    const selectedLevel = levelById.get(selectedMember.levelId);

    if (!selectedLevel?.canUseApp) {
      setError("El nivel seleccionado no tiene canUseApp habilitado.");
      return;
    }

    if (!form.email.trim() || !form.password.trim()) {
      setError("Email y password temporal son obligatorios.");
      return;
    }

    setIsSaving(true);

    try {
      const email = form.email.trim().toLowerCase();
      const password = form.password.trim();

      const appAuthUid = await createFirebaseAuthUser(email, password);

      const batch = writeBatch(firestoreDb);

      batch.set(doc(firestoreDb, "SystemUsers", appAuthUid), {
        name: selectedMember.name,
        email,
        birthDate: selectedMember.birthDate,
        type: "app",
        backofficeRole: null,
        orgMemberId: selectedMember.id,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.update(doc(firestoreDb, "OrgMembers", selectedMember.id), {
        appUserId: appAuthUid,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      setSuccess(
        `Cuenta App creada para ${selectedMember.name}. UID: ${appAuthUid}. Comparte el password temporal de forma segura.`
      );
      setForm({
        orgMemberId: "",
        email: "",
        password: generateTemporaryPassword(),
      });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No fue posible crear la cuenta App."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!isConfigured) {
    return <MissingConfigNotice missingVars={missingVars} />;
  }

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Acceso a la App</h2>
        <p className="mt-2 text-sm text-slate-600">
          Administracion de cuentas App vinculadas a OrgMembers.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Cuentas App</h3>
              <p className="text-sm text-slate-600">Origen: SystemUsers con type = app.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {appUsers.length} cuentas
            </span>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">OrgMember</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {appUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{user.name || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{user.email || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {orgMemberById.get(user.orgMemberId)?.name || user.orgMemberId || "-"}
                    </td>
                    <td className="px-4 py-3">{user.active ? "Activo" : "Inactivo"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void toggleAppUserStatus(user)}
                        disabled={!isAdmin}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {user.active ? "Bloquear" : "Desbloquear"}
                      </button>
                    </td>
                  </tr>
                ))}
                {appUsers.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      No hay cuentas App creadas.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Create App Access</h3>
              <p className="text-sm text-slate-600">Solo usuarios admin pueden ejecutar este flujo.</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isAdmin ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {isAdmin ? "Admin" : "Sin permisos"}
            </span>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleCreateAccess}>
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>OrgMember elegible</span>
              <select
                value={form.orgMemberId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, orgMemberId: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                required
              >
                <option value="">Selecciona un OrgMember</option>
                {eligibleMembers.map((member) => {
                  const level = levelById.get(member.levelId);
                  return (
                    <option key={member.id} value={member.id}>
                      {member.name} {level ? `(${level.name})` : ""}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Email App</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="usuario.app@dominio.com"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Password temporal</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, password: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                  placeholder="Minimo 6 caracteres"
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({ ...current, password: generateTemporaryPassword() }))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Generar
                </button>
              </div>
            </label>

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            {success ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSaving || !isAdmin}
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? "Creando acceso..." : "Create App Access"}
            </button>
          </form>
        </article>
      </div>
    </section>
  );
}
