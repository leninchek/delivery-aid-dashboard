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
import { validateMexicanPhone, validateCurp, validateRequiredName } from "@/utils/validators";
import { uploadEvidenceFile } from "@/utils/storage-upload";
import type { OrgMember, AidType } from "@/types/shared";

type IndirectaForm = {
  orgMemberId:     string;
  aidTypeId:       string;
  quantity:        string;
  beneficiaryName: string;
  curp:            string;
  comment:         string;
};

const defaultForm: IndirectaForm = {
  orgMemberId: "", aidTypeId: "", quantity: "", beneficiaryName: "", curp: "", comment: "",
};

type RecentEntry = {
  id:              string;
  beneficiaryName: string;
  curp:            string;
  aidTypeName:     string;
  quantity:        number;
  unit:            string;
  orgMemberId:     string;
};

export default function EntregaExternaPage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars  = getMissingFirebaseEnvVars();

  const [orgMembers,   setOrgMembers]   = useState<OrgMember[]>([]);
  const [aidTypes,     setAidTypes]     = useState<AidType[]>([]);
  const [recent,       setRecent]       = useState<RecentEntry[]>([]);
  const [form,         setForm]         = useState<IndirectaForm>(defaultForm);
  const [fieldErrors,  setFieldErrors]  = useState<Record<string, string>>({});
  const [error,        setError]        = useState<string | null>(null);
  const [isSaving,     setIsSaving]     = useState(false);

  const evidenceRef  = useRef<HTMLInputElement | null>(null);
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

    const u2 = onSnapshot(
      query(collection(db, "AidTypes"), orderBy("name", "asc")),
      (snap) => setAidTypes(snap.docs.map((d) => ({
        id:     d.id,
        name:   d.get("name")   || "",
        unit:   d.get("unit")   || "pieza",
        active: d.get("active") ?? true,
      })))
    );

    const u3 = onSnapshot(
      query(collection(db, "IndirectDeliveries"), orderBy("createdAt", "desc"), limit(20)),
      (snap) => setRecent(snap.docs.map((d) => ({
        id:              d.id,
        beneficiaryName: d.get("beneficiaryName") || "",
        curp:            d.get("curp")            || "",
        aidTypeName:     d.get("aidTypeName")     || "",
        quantity:        d.get("quantity")        || 0,
        unit:            d.get("unit")            || "",
        orgMemberId:     d.get("orgMemberId")     || "",
      })))
    );

    return () => { u1(); u2(); u3(); };
  }, []);

  const aidTypeMap  = useMemo(() => new Map(aidTypes.map((a) => [a.id, a])),  [aidTypes]);
  const memberMap   = useMemo(() => new Map(orgMembers.map((m) => [m.id, m])), [orgMembers]);

  const selectedAidType = form.aidTypeId ? aidTypeMap.get(form.aidTypeId) : undefined;
  const unitLabel       = selectedAidType ? unitDisplayMap[selectedAidType.unit] : "";

  function setField(key: keyof IndirectaForm, value: string) {
    setForm((c) => ({ ...c, [key]: value }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  function resetForm() {
    setForm(defaultForm);
    setFieldErrors({});
    setError(null);
    setEvidenceFile(null);
    if (evidenceRef.current) evidenceRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const errs: Record<string, string> = {};
    if (!form.orgMemberId)   errs.orgMemberId     = "El activista es obligatorio.";
    if (!form.aidTypeId)     errs.aidTypeId        = "El tipo de apoyo es obligatorio.";
    const qtyNum = parseFloat(form.quantity);
    if (!form.quantity || isNaN(qtyNum) || qtyNum <= 0) errs.quantity = "La cantidad debe ser mayor a cero.";
    const nameErr = validateRequiredName(form.beneficiaryName, "El nombre del beneficiario");
    if (nameErr) errs.beneficiaryName = nameErr;
    const curpErr = validateCurp(form.curp);
    if (curpErr) errs.curp = curpErr;

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    const db = getFirestoreDb();
    if (!db) { setError("Firebase no está configurado."); return; }

    const member  = memberMap.get(form.orgMemberId);
    const aidType = aidTypeMap.get(form.aidTypeId);

    setIsSaving(true);
    setError(null);

    try {
      const id = crypto.randomUUID();
      await setDoc(doc(db, "IndirectDeliveries", id), {
        orgMemberId:           form.orgMemberId,
        aidTypeId:             form.aidTypeId,
        aidTypeName:           aidType?.name ?? "",
        quantity:              qtyNum,
        unit:                  aidType?.unit ?? "pieza",
        beneficiaryName:       form.beneficiaryName.trim(),
        curp:                  form.curp.trim().toUpperCase(),
        comment:               form.comment.trim() || null,
        registeredBy:          "backoffice",
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
        const path = `org-members/${form.orgMemberId}/indirect-deliveries/${id}.jpg`;
        const url  = await uploadEvidenceFile(path, evidenceFile);
        await updateDoc(doc(db, "IndirectDeliveries", id), {
          evidenceUrls: [url],
          updatedAt:    serverTimestamp(),
        });
      }

      showToast("Entrega externa registrada.");
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
        <h2 className="text-3xl font-semibold tracking-tight">Captura — Entrega Externa</h2>
        <p className="mt-2 text-sm text-slate-600">
          Registra una entrega a un beneficiario externo (no promovido). La ubicación se marcará como captura desde Back Office.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[0.8fr_1.2fr]">

        {/* ── Recientes ── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Recientes</h3>
              <p className="text-sm text-slate-600">Últimas 20 entregas indirectas.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {recent.length} registros
            </span>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Beneficiario</th>
                  <th className="px-4 py-3 font-medium">Apoyo</th>
                  <th className="px-4 py-3 font-medium">Miembro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{r.beneficiaryName}</p>
                      <p className="font-mono text-xs text-slate-400">{r.curp}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.aidTypeName}
                      <span className="ml-1 text-xs text-slate-400">
                        {r.quantity} {r.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {memberMap.get(r.orgMemberId)?.name ?? "—"}
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={3}>
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
          <h3 className="text-lg font-semibold">Nueva entrega externa</h3>
          <p className="mt-1 text-sm text-slate-600">Todos los campos son obligatorios salvo el comentario y la foto.</p>

          <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <FormSelect
              label="Miembro organizacional"
              value={form.orgMemberId}
              onChange={(v) => setField("orgMemberId", v)}
              error={fieldErrors.orgMemberId}
            >
              <option value="">Selecciona un miembro</option>
              {orgMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </FormSelect>

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
              label="Nombre del beneficiario"
              value={form.beneficiaryName}
              onChange={(v) => setField("beneficiaryName", v)}
              placeholder="Nombre completo"
              error={fieldErrors.beneficiaryName}
            />

            <FormInput
              label="CURP del beneficiario"
              value={form.curp}
              maxLength={18}
              mono
              onChange={(v) => {
                const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 18);
                setField("curp", clean);
              }}
              placeholder="18 caracteres"
              error={fieldErrors.curp}
              labelAccessory={
                <span className={`text-xs tabular-nums ${form.curp.length === 18 ? "text-emerald-600" : form.curp.length > 0 ? "text-slate-400" : "text-slate-300"}`}>
                  {form.curp.length}/18
                </span>
              }
            />

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
