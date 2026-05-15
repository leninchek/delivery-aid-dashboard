"use client";

import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { useAuth } from "@/components/auth/auth-provider";
import { getFirestoreDb, getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";

const MAX_TITLE = 50;
const MAX_BODY = 150;

type CampaignTarget = "all" | "level_ids";
type CampaignStatus = "draft" | "scheduled" | "sent" | "partial_failed" | "failed";

const targetDisplayMap: Record<CampaignTarget, string> = {
  all: "Todos los usuarios",
  level_ids: "Por nivel organizacional",
};

const statusDisplayMap: Record<CampaignStatus, string> = {
  draft: "Borrador",
  scheduled: "Programada",
  sent: "Enviada",
  partial_failed: "Enviada con errores",
  failed: "Fallida",
};

type PushCampaign = {
  id: string;
  title: string;
  body: string;
  target: CampaignTarget;
  targetLevelIds: string[];
  status: CampaignStatus;
  sentAt: Date | null;
  createdAt: Date | null;
  stats: {
    total: number;
    sent: number;
    failed: number;
  };
};

type OrgLevel = {
  id: string;
  name: string;
};

type CampaignForm = {
  title: string;
  body: string;
  target: CampaignTarget;
  targetLevelIds: string[];
  screen: string;
  entityId: string;
};

const defaultForm: CampaignForm = {
  title: "",
  body: "",
  target: "all",
  targetLevelIds: [],
  screen: "",
  entityId: "",
};

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object" && value !== null && "toDate" in value)
    return (value as { toDate: () => Date }).toDate();
  return null;
}

function formatDate(value: Date | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function CharCount({ current, max }: { current: number; max: number }) {
  const ratio = current / max;
  const color =
    ratio >= 1 ? "text-rose-600 font-semibold" : ratio >= 0.8 ? "text-amber-600" : "text-slate-400";
  return <span className={`text-xs tabular-nums ${color}`}>{current}/{max}</span>;
}

function NotificationPreview({ title, body }: { title: string; body: string }) {
  const displayTitle = title.trim() || "Título de la notificación";
  const displayBody  = body.trim()  || "El mensaje de tu notificación aparecerá aquí.";

  const visibleTitle = displayTitle.length > MAX_TITLE
    ? displayTitle.slice(0, MAX_TITLE) + "…"
    : displayTitle;
  const visibleBody = displayBody.length > MAX_BODY
    ? displayBody.slice(0, MAX_BODY) + "…"
    : displayBody;

  const titleIsPlaceholder = !title.trim();
  const bodyIsPlaceholder  = !body.trim();

  return (
    <div className="rounded-xl bg-slate-800 px-4 pt-4 pb-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400">Vista previa — Android</span>
        <span className="text-xs text-slate-500">9:41</span>
      </div>

      <div className="rounded-2xl bg-white/95 px-3.5 py-3 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-slate-900">
            <span className="text-[8px] font-bold text-white">D</span>
          </div>
          <span className="text-xs font-medium text-slate-500">Delivery Aid</span>
          <span className="ml-auto text-xs text-slate-400">ahora</span>
        </div>
        <p className={`text-sm font-semibold leading-tight ${titleIsPlaceholder ? "text-slate-400" : "text-slate-900"}`}>
          {visibleTitle}
        </p>
        <p className={`mt-0.5 text-xs leading-snug ${bodyIsPlaceholder ? "text-slate-400" : "text-slate-600"}`}>
          {visibleBody}
        </p>
      </div>

      {(title.length > MAX_TITLE || body.length > MAX_BODY) && (
        <p className="mt-2.5 text-xs text-amber-400">
          El texto marcado en rojo se truncará en el dispositivo.
        </p>
      )}
    </div>
  );
}

export default function PushCampaignsPage() {
  const { sessionUser } = useAuth();

  const [items, setItems] = useState<PushCampaign[]>([]);
  const [levels, setLevels] = useState<OrgLevel[]>([]);
  const [form, setForm] = useState<CampaignForm>(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isConfigured = hasFirebaseConfig();
  const missingVars = getMissingFirebaseEnvVars();
  const isAdmin = sessionUser?.backofficeRole === "admin";

  useEffect(() => {
    if (!isConfigured) return;
    const firestoreDb = getFirestoreDb();
    if (!firestoreDb) return;

    const unsubscribers = [
      onSnapshot(
        query(collection(firestoreDb, "PushCampaigns"), orderBy("createdAt", "desc")),
        (snapshot) => {
          setItems(
            snapshot.docs.map((item) => ({
              id: item.id,
              title: item.get("title") || "",
              body: item.get("body") || "",
              target: (item.get("target") || "all") as CampaignTarget,
              targetLevelIds: item.get("targetLevelIds") || [],
              status: (item.get("status") || "draft") as CampaignStatus,
              sentAt: asDate(item.get("sentAt")),
              createdAt: asDate(item.get("createdAt")),
              stats: {
                total: item.get("stats.total") || 0,
                sent: item.get("stats.sent") || 0,
                failed: item.get("stats.failed") || 0,
              },
            }))
          );
        },
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        query(collection(firestoreDb, "OrgLevels"), orderBy("rank", "asc")),
        (snapshot) => {
          setLevels(
            snapshot.docs.map((item) => ({
              id: item.id,
              name: item.get("name") || "",
            }))
          );
        },
        (snapshotError) => setError(snapshotError.message)
      ),
    ];

    return () => unsubscribers.forEach((u) => u());
  }, [isConfigured]);

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc.total += item.stats.total;
          acc.sent  += item.stats.sent;
          acc.failed += item.stats.failed;
          return acc;
        },
        { total: 0, sent: 0, failed: 0 }
      ),
    [items]
  );

  function resetForm() {
    setForm(defaultForm);
  }

  function toggleTargetLevel(levelId: string) {
    setForm((current) => {
      const exists = current.targetLevelIds.includes(levelId);
      return {
        ...current,
        targetLevelIds: exists
          ? current.targetLevelIds.filter((item) => item !== levelId)
          : [...current.targetLevelIds, levelId],
      };
    });
  }

  async function submitCampaign(mode: "draft" | "send") {
    setError(null);
    setSuccess(null);

    if (!isAdmin) {
      setError("Solo admin puede crear o enviar campañas push.");
      return;
    }

    const firestoreDb = getFirestoreDb();
    if (!firestoreDb) {
      setError("Firestore no esta configurado.");
      return;
    }

    if (!form.title.trim() || !form.body.trim()) {
      setError("Title y body son obligatorios.");
      return;
    }

    if (form.target === "level_ids" && form.targetLevelIds.length === 0) {
      setError("Selecciona al menos un nivel para target level_ids.");
      return;
    }

    setIsSaving(true);

    try {
      const campaignRef = await addDoc(collection(firestoreDb, "PushCampaigns"), {
        title: form.title.trim(),
        body: form.body.trim(),
        target: form.target,
        targetLevelIds: form.target === "level_ids" ? form.targetLevelIds : null,
        status: mode === "draft" ? "draft" : "scheduled",
        scheduledAt: null,
        sentAt: null,
        createdBy: sessionUser?.uid || null,
        stats: { total: 0, sent: 0, failed: 0 },
        payload: {
          screen: form.screen.trim() || null,
          entityId: form.entityId.trim() || null,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (mode === "draft") {
        setSuccess("Campaña guardada como draft.");
        resetForm();
        return;
      }

      const endpoint = process.env.NEXT_PUBLIC_SEND_PUSH_CAMPAIGN_URL;
      if (!endpoint) {
        await updateDoc(doc(firestoreDb, "PushCampaigns", campaignRef.id), {
          status: "failed",
          "stats.total": 0,
          "stats.sent": 0,
          "stats.failed": 0,
          updatedAt: serverTimestamp(),
        });
        throw new Error(
          "Falta NEXT_PUBLIC_SEND_PUSH_CAMPAIGN_URL. La campaña se guardó pero no se pudo enviar."
        );
      }

      const user = getAuth().currentUser;
      if (!user) throw new Error("Usuario no autenticado.");
      const idToken = await user.getIdToken();

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          campaignId: campaignRef.id,
          title: form.title.trim(),
          body: form.body.trim(),
          target: form.target,
          targetLevelIds: form.target === "level_ids" ? form.targetLevelIds : undefined,
          screen: form.screen.trim() || undefined,
          entityId: form.entityId.trim() || undefined,
        }),
      });

      const result = (await response.json()) as {
        status?: CampaignStatus;
        total?: number;
        sent?: number;
        failed?: number;
      };

      if (!response.ok) {
        await updateDoc(doc(firestoreDb, "PushCampaigns", campaignRef.id), {
          status: "failed",
          updatedAt: serverTimestamp(),
        });
        throw new Error("El endpoint de envío respondió con error.");
      }

      await updateDoc(doc(firestoreDb, "PushCampaigns", campaignRef.id), {
        status: result.status || "sent",
        sentAt: serverTimestamp(),
        "stats.total": result.total || 0,
        "stats.sent": result.sent || 0,
        "stats.failed": result.failed || 0,
        updatedAt: serverTimestamp(),
      });

      setSuccess("Campaña enviada correctamente.");
      resetForm();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible procesar la campaña push."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Campañas Push</h2>
        <p className="mt-2 text-sm text-slate-600">
          Crear, enviar y monitorear campañas push para usuarios App.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Campañas registradas</p>
          <p className="mt-2 text-3xl font-semibold">{items.length}</p>
          <p className="mt-1 text-xs text-slate-600">Historial en PushCampaigns</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Notificaciones enviadas</p>
          <p className="mt-2 text-3xl font-semibold">{totals.sent}</p>
          <p className="mt-1 text-xs text-slate-600">Total: {totals.total}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Fallidas</p>
          <p className="mt-2 text-3xl font-semibold">{totals.failed}</p>
          <p className="mt-1 text-xs text-slate-600">Revisar campañas con status failed</p>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Nueva campaña</h3>
              <p className="text-sm text-slate-600">Solo admin puede enviar campañas.</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isAdmin ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {isAdmin ? "Admin" : "Sin permisos"}
            </span>
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCampaign("send");
            }}
          >
            {/* Title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Título</label>
                <CharCount current={form.title.length} max={MAX_TITLE} />
              </div>
              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                required
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Mensaje</label>
                <CharCount current={form.body.length} max={MAX_BODY} />
              </div>
              <textarea
                value={form.body}
                onChange={(event) =>
                  setForm((current) => ({ ...current, body: event.target.value }))
                }
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                required
              />
            </div>

            {/* Live preview */}
            <NotificationPreview title={form.title} body={form.body} />

            {/* Target */}
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Destinatarios</span>
              <select
                value={form.target}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    target: event.target.value as CampaignTarget,
                    targetLevelIds:
                      event.target.value === "level_ids" ? current.targetLevelIds : [],
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                <option value="all">{targetDisplayMap.all}</option>
                <option value="level_ids">{targetDisplayMap.level_ids}</option>
              </select>
            </label>

            {form.target === "level_ids" && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-700">Selecciona niveles destino</p>
                <div className="mt-3 grid gap-2">
                  {levels.map((level) => (
                    <label key={level.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.targetLevelIds.includes(level.id)}
                        onChange={() => toggleTargetLevel(level.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {level.name}
                    </label>
                  ))}
                  {levels.length === 0 && (
                    <p className="text-xs text-slate-500">No hay niveles disponibles.</p>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>Pantalla (opcional)</span>
                <input
                  type="text"
                  value={form.screen}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, screen: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                  placeholder="home, deliveries, reports"
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>ID de entidad (opcional)</span>
                <input
                  type="text"
                  value={form.entityId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, entityId: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                  placeholder="ID relacionado con screen"
                />
              </label>
            </div>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

            {success && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success}
              </p>
            )}

            <div className="grid gap-2 md:grid-cols-2">
              <button
                type="button"
                onClick={() => void submitCampaign("draft")}
                disabled={isSaving || !isAdmin}
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Procesando..." : "Guardar draft"}
              </button>
              <button
                type="submit"
                disabled={isSaving || !isAdmin}
                className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSaving ? "Procesando..." : "Enviar campaña"}
              </button>
            </div>
          </form>
        </article>

        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold">Historial</h3>
          <p className="mt-1 text-sm text-slate-600">Últimas campañas registradas en PushCampaigns.</p>

          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {statusDisplayMap[item.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Destino: {targetDisplayMap[item.target]}
                  {item.targetLevelIds.length > 0 ? ` (${item.targetLevelIds.length} niveles)` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Total: {item.stats.total} | Enviados: {item.stats.sent} | Fallidos: {item.stats.failed}
                </p>
                <p className="mt-1 text-xs text-slate-500" suppressHydrationWarning>
                  Creada: {formatDate(item.createdAt)} | Enviada: {formatDate(item.sentAt)}
                </p>
              </div>
            ))}

            {items.length === 0 && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Aún no hay campañas registradas.
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
