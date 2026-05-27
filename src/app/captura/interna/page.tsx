"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  setDoc, collection, onSnapshot, orderBy, query, serverTimestamp, updateDoc, doc,
  limit,
} from "firebase/firestore";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { FormInput } from "@/components/form/FormInput";
import { FormSelect } from "@/components/form/FormSelect";
import { getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { getFirestoreDb } from "@/lib/firebase";
import { showToast } from "@/hooks/useToast";
import { unitDisplayMap } from "@/lib/utils";
import { uploadEvidenceFile } from "@/utils/storage-upload";
import type { OrgMember, AidType } from "@/types/shared";

type DirectDeliveryType = {
  id:           string;
  code:         string;
  label:        string;
  fromLevelIds: string[];
  toLevelIds:   string[];
  sortOrder:    number;
};

type InternaForm = {
  fromOrgId:        string;
  deliveryTypeCode: string;
  toOrgId:          string;
  toPromotedId:     string;
  aidTypeId:        string;
  quantity:         string;
  comment:          string;
};

const defaultForm: InternaForm = {
  fromOrgId: "", deliveryTypeCode: "", toOrgId: "", toPromotedId: "",
  aidTypeId: "", quantity: "", comment: "",
};

type Promovido = { id: string; name: string; curp: string; activistId: string };

type RecentEntry = {
  id:           string;
  fromName:     string;
  toName:       string;
  deliveryType: string;
  aidTypeName:  string;
  quantity:     number;
  unit:         string;
};

export default function EntregaInternaPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars  = getMissingFirebaseEnvVars();

  const [orgMembers,    setOrgMembers]    = useState<OrgMember[]>([]);
  const [deliveryTypes, setDeliveryTypes] = useState<DirectDeliveryType[]>([]);
  const [aidTypes,      setAidTypes]      = useState<AidType[]>([]);
  const [promovidos,    setPromovidos]    = useState<Promovido[]>([]);
  const [recent,        setRecent]        = useState<RecentEntry[]>([]);
  const [form,          setForm]          = useState<InternaForm>(defaultForm);
  const [fieldErrors,   setFieldErrors]   = useState<Record<string, string>>({});
  const [error,         setError]         = useState<string | null>(null);
  const [isSaving,      setIsSaving]      = useState(false);
  const [promoSearch,   setPromoSearch]   = useState("");

  const evidenceRef    = useRef<HTMLInputElement | null>(null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db) return;

    const u1 = onSnapshot(
      query(collection(db, "OrgMembers"), orderBy("name", "asc")),
      (snap) => setOrgMembers(snap.docs.map((d) => ({
        id:         d.id,
        name:       d.get("name")       || "",
        phone:      d.get("phone")      || "",
        curp:       d.get("curp")       || "",
        birthDate:  d.get("birthDate")  || "",
        levelId:    d.get("levelId")    || "",
        parentId:   d.get("parentId")   || null,
        path:       d.get("path")       || [],
        assignment: d.get("assignment") || { cityId: null, communityId: null, routeId: null },
        appUserId:  d.get("appUserId")  || null,
        active:     d.get("active")     ?? true,
      })))
    );

    // Filtra active en cliente para evitar índice compuesto en Firestore
    const u2 = onSnapshot(
      query(collection(db, "DirectDeliveryTypes"), orderBy("sortOrder", "asc")),
      (snap) => setDeliveryTypes(
        snap.docs
          .filter((d) => d.get("active") !== false)
          .map((d) => ({
            id:           d.id,
            code:         d.get("code")         || "",
            label:        d.get("label")        || "",
            fromLevelIds: (d.get("fromLevelIds") as string[]) || [],
            toLevelIds:   (d.get("toLevelIds")   as string[]) || [],
            sortOrder:    d.get("sortOrder")    || 0,
          }))
      )
    );

    const u3 = onSnapshot(
      query(collection(db, "AidTypes"), orderBy("name", "asc")),
      (snap) => setAidTypes(snap.docs.map((d) => ({
        id:     d.id,
        name:   d.get("name")   || "",
        unit:   d.get("unit")   || "pieza",
        active: d.get("active") ?? true,
      })))
    );

    const u4 = onSnapshot(
      query(collection(db, "Promoted"), orderBy("name", "asc")),
      (snap) => setPromovidos(snap.docs.map((d) => ({
        id:         d.id,
        name:       d.get("name")       || "",
        curp:       d.get("curp")       || "",
        activistId: d.get("activistId") || "",
      })))
    );

    const u5 = onSnapshot(
      query(collection(db, "DirectDeliveries"), orderBy("createdAt", "desc"), limit(20)),
      (snap) => setRecent(snap.docs.map((d) => ({
        id:           d.id,
        fromName:     d.get("fromName")     || "",
        toName:       d.get("toName")       || "",
        deliveryType: d.get("deliveryType") || "",
        aidTypeName:  d.get("aidTypeName")  || "",
        quantity:     d.get("quantity")     || 0,
        unit:         d.get("unit")         || "",
      })))
    );

    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  const aidTypeMap      = useMemo(() => new Map(aidTypes.map((a) => [a.id, a])),      [aidTypes]);
  const memberMap       = useMemo(() => new Map(orgMembers.map((m) => [m.id, m])),    [orgMembers]);
  const deliveryTypeMap = useMemo(() => new Map(deliveryTypes.map((dt) => [dt.code, dt])), [deliveryTypes]);

  const fromMember = form.fromOrgId ? memberMap.get(form.fromOrgId) : undefined;

  // Tipos disponibles para el nivel del miembro seleccionado como origen
  const availableDeliveryTypes = useMemo(
    () => fromMember
      ? deliveryTypes.filter((dt) => dt.fromLevelIds.includes(fromMember.levelId))
      : [],
    [deliveryTypes, fromMember]
  );

  const selectedDeliveryType  = form.deliveryTypeCode
    ? availableDeliveryTypes.find((dt) => dt.code === form.deliveryTypeCode)
    : undefined;
  const isActivistToPromoted  = selectedDeliveryType?.code === "activist_to_promoted";

  // Para activist_to_promoted: promovidos del activista seleccionado, filtrados por búsqueda
  const activistPromovidos = useMemo(
    () => (form.fromOrgId ? promovidos.filter((p) => p.activistId === form.fromOrgId) : []),
    [promovidos, form.fromOrgId]
  );

  const filteredPromovidos = useMemo(() => {
    const q = promoSearch.trim().toLowerCase();
    return q
      ? activistPromovidos.filter(
          (p) => p.name.toLowerCase().includes(q) || p.curp.toLowerCase().includes(q)
        )
      : activistPromovidos;
  }, [activistPromovidos, promoSearch]);

  // Para otros tipos: miembros cuyo path contiene fromOrgId (subordinados) con el nivel destino
  const eligibleRecipients = useMemo(() => {
    if (!selectedDeliveryType || isActivistToPromoted || !form.fromOrgId) return [];
    return orgMembers.filter(
      (m) =>
        m.active &&
        m.id !== form.fromOrgId &&
        (m.path as string[]).includes(form.fromOrgId) &&
        selectedDeliveryType.toLevelIds.includes(m.levelId)
    );
  }, [orgMembers, selectedDeliveryType, isActivistToPromoted, form.fromOrgId]);

  const selectedPromovido = isActivistToPromoted && form.toPromotedId
    ? promovidos.find((p) => p.id === form.toPromotedId)
    : undefined;

  const selectedAidType = form.aidTypeId ? aidTypeMap.get(form.aidTypeId) : undefined;
  const unitLabel       = selectedAidType ? unitDisplayMap[selectedAidType.unit] : "";

  function setField(key: keyof InternaForm, value: string) {
    if (key === "fromOrgId") {
      const newMember          = orgMembers.find((m) => m.id === value);
      const newAvailableTypes  = newMember
        ? deliveryTypes.filter((dt) => dt.fromLevelIds.includes(newMember.levelId))
        : [];
      const autoCode           = newAvailableTypes[0]?.code ?? "";
      setForm((c) => ({ ...c, fromOrgId: value, deliveryTypeCode: autoCode, toOrgId: "", toPromotedId: "" }));
      setPromoSearch("");
      setFieldErrors((prev) => {
        const n = { ...prev };
        delete n.fromOrgId; delete n.deliveryTypeCode; delete n.toOrgId; delete n.toPromotedId;
        return n;
      });
    } else if (key === "deliveryTypeCode") {
      setForm((c) => ({ ...c, deliveryTypeCode: value, toOrgId: "", toPromotedId: "" }));
      setPromoSearch("");
      setFieldErrors((prev) => {
        const n = { ...prev };
        delete n.deliveryTypeCode; delete n.toOrgId; delete n.toPromotedId;
        return n;
      });
    } else {
      setForm((c) => ({ ...c, [key]: value }));
      setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
  }

  function selectPromovido(id: string) {
    setForm((c) => ({ ...c, toPromotedId: id }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n.toPromotedId; return n; });
    setPromoSearch("");
  }

  function resetForm() {
    setForm(defaultForm);
    setFieldErrors({});
    setError(null);
    setPromoSearch("");
    setEvidenceFile(null);
    if (evidenceRef.current) evidenceRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const errs: Record<string, string> = {};
    if (!form.fromOrgId)        errs.fromOrgId        = "El entregador es obligatorio.";
    if (!form.deliveryTypeCode) errs.deliveryTypeCode  = "El tipo de entrega es obligatorio.";
    if (!form.aidTypeId)        errs.aidTypeId         = "El tipo de apoyo es obligatorio.";
    const qtyNum = parseFloat(form.quantity);
    if (!form.quantity || isNaN(qtyNum) || qtyNum <= 0) errs.quantity = "La cantidad debe ser mayor a cero.";

    if (isActivistToPromoted) {
      if (!form.toPromotedId) errs.toPromotedId = "El promovido es obligatorio.";
    } else {
      if (!form.toOrgId) errs.toOrgId = "El destinatario es obligatorio.";
    }

    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }

    const db = getFirestoreDb();
    if (!db) { setError("Firebase no está configurado."); return; }

    const member   = memberMap.get(form.fromOrgId);
    const aidType  = aidTypeMap.get(form.aidTypeId);

    const toOrgId:      string | null = isActivistToPromoted ? null : form.toOrgId;
    const toPromotedId: string | null = isActivistToPromoted ? form.toPromotedId : null;
    const toName: string = isActivistToPromoted
      ? (promovidos.find((p) => p.id === form.toPromotedId)?.name ?? "")
      : (memberMap.get(form.toOrgId)?.name ?? "");

    setIsSaving(true);
    setError(null);

    try {
      const id = crypto.randomUUID();
      await setDoc(doc(db, "DirectDeliveries", id), {
        deliveryType:          form.deliveryTypeCode,
        aidTypeId:             form.aidTypeId,
        aidTypeName:           aidType?.name ?? "",
        quantity:              qtyNum,
        unit:                  aidType?.unit ?? "pieza",
        fromOrgId:             form.fromOrgId,
        fromName:              member?.name ?? "",
        toOrgId,
        toPromotedId,
        toName,
        registeredBy:          "backoffice",
        comment:               form.comment.trim() || null,
        evidenceUrls:          [],
        locationMissing:       true,
        locationMissingReason: "Registro desde Back Office",
        latitude:              0,
        longitude:             0,
        source:                "backoffice",
        status:                "synced",
        createdAt:             serverTimestamp(),
        updatedAt:             serverTimestamp(),
        audit:                 { registeredBy: "backoffice", offline: false },
      });

      if (evidenceFile) {
        const path = `org-members/${form.fromOrgId}/direct-deliveries/${id}.jpg`;
        const url  = await uploadEvidenceFile(path, evidenceFile);
        await updateDoc(doc(db, "DirectDeliveries", id), {
          evidenceUrls: [url],
          updatedAt:    serverTimestamp(),
        });
      }

      showToast("Entrega interna registrada.");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isConfigured) return <MissingConfigNotice missingVars={missingVars} />;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Captura — Entrega Interna</h2>
        <p className="mt-2 text-sm text-slate-600">
          Registra una entrega entre miembros de la organización o a un promovido. La ubicación se marcará como captura desde Back Office.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[0.8fr_1.2fr]">

        {/* ── Recientes ── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Recientes</h3>
              <p className="text-sm text-slate-600">Últimas 20 entregas internas.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {recent.length} registros
            </span>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">De</th>
                  <th className="px-4 py-3 font-medium">A</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Apoyo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-slate-700">{r.fromName}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.toName}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {deliveryTypeMap.get(r.deliveryType)?.label ?? r.deliveryType}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.aidTypeName}
                      {r.quantity > 0 && (
                        <span className="ml-1 text-xs text-slate-400">{r.quantity} {r.unit}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                      Aún no hay entregas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        {/* ── Formulario ── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold">Nueva entrega interna</h3>
          <p className="mt-1 text-sm text-slate-600">Todos los campos son obligatorios salvo el comentario y la foto.</p>

          <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(e)}>

            {/* 1. Entregador */}
            <FormSelect
              label="Entregador"
              value={form.fromOrgId}
              onChange={(v) => setField("fromOrgId", v)}
              error={fieldErrors.fromOrgId}
            >
              <option value="">Selecciona un miembro</option>
              {orgMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </FormSelect>

            {/* 2. Tipo de entrega — solo visible cuando hay más de una opción (igual que en la App) */}
            {form.fromOrgId && availableDeliveryTypes.length > 1 && (
              <FormSelect
                label="Tipo de entrega"
                value={form.deliveryTypeCode}
                onChange={(v) => setField("deliveryTypeCode", v)}
                error={fieldErrors.deliveryTypeCode}
              >
                <option value="">Selecciona un tipo</option>
                {availableDeliveryTypes.map((dt) => (
                  <option key={dt.id} value={dt.code}>{dt.label}</option>
                ))}
              </FormSelect>
            )}

            {form.fromOrgId && availableDeliveryTypes.length === 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Este miembro no tiene tipos de entrega configurados para su nivel.
              </p>
            )}

            {/* 3. Destinatario */}
            {form.deliveryTypeCode && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Destinatario</label>

                {isActivistToPromoted ? (
                  /* Selector de promovido */
                  selectedPromovido ? (
                    <div className="flex items-center justify-between rounded-lg border border-slate-300 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{selectedPromovido.name}</p>
                        <p className="font-mono text-xs text-slate-400">{selectedPromovido.curp}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setForm((c) => ({ ...c, toPromotedId: "" })); setPromoSearch(""); }}
                        className="text-xs text-slate-400 hover:text-slate-700"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        value={promoSearch}
                        onChange={(e) => setPromoSearch(e.target.value)}
                        placeholder="Buscar promovido por nombre o CURP"
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-slate-900 ${
                          fieldErrors.toPromotedId ? "border-rose-400 bg-rose-50" : "border-slate-300"
                        }`}
                      />
                      <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                        {filteredPromovidos.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-slate-400">
                            {promoSearch
                              ? "Sin resultados para esa búsqueda."
                              : "Este activista no tiene promovidos registrados."}
                          </p>
                        ) : (
                          filteredPromovidos.slice(0, 10).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => selectPromovido(p.id)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            >
                              <span className="font-medium text-slate-900">{p.name}</span>
                              <span className="ml-2 font-mono text-xs text-slate-400">{p.curp}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )
                ) : (
                  /* Selector de miembro subordinado */
                  <select
                    value={form.toOrgId}
                    onChange={(e) => setField("toOrgId", e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 outline-none transition focus:border-slate-900 ${
                      fieldErrors.toOrgId ? "border-rose-400 bg-rose-50" : "border-slate-300"
                    }`}
                  >
                    <option value="">
                      {eligibleRecipients.length === 0
                        ? "Sin destinatarios disponibles para este tipo"
                        : "Selecciona un destinatario"}
                    </option>
                    {eligibleRecipients.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                )}

                {(fieldErrors.toPromotedId ?? fieldErrors.toOrgId) && (
                  <p className="text-xs text-rose-600">
                    {fieldErrors.toPromotedId ?? fieldErrors.toOrgId}
                  </p>
                )}
              </div>
            )}

            {/* 4. Apoyo y cantidad */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormSelect
                label="Tipo de apoyo"
                value={form.aidTypeId}
                onChange={(v) => setField("aidTypeId", v)}
                error={fieldErrors.aidTypeId}
              >
                <option value="">Selecciona un tipo</option>
                {aidTypes.filter((a) => a.active).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </FormSelect>

              <FormInput
                label={`Cantidad${unitLabel ? ` (${unitLabel})` : ""}`}
                type="number"
                inputMode="decimal"
                value={form.quantity}
                onChange={(v) => setField("quantity", v)}
                placeholder="0"
                min={0}
                error={fieldErrors.quantity}
              />
            </div>

            <FormInput
              label="Comentario"
              value={form.comment}
              onChange={(v) => setField("comment", v)}
              placeholder="Observaciones (opcional)"
              multiline
              rows={3}
            />

            {/* Evidencia */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Foto de evidencia{" "}
                <span className="text-xs font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                ref={evidenceRef}
                type="file"
                accept="image/*"
                disabled={isSaving}
                onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-medium hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              />
              {evidenceFile && (
                <p className="mt-1 text-xs text-slate-400 truncate">{evidenceFile.name}</p>
              )}
            </div>

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
              {isSaving ? "Guardando..." : "Registrar entrega"}
            </button>
          </form>
        </article>

      </div>
    </section>
  );
}

