"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  setDoc, collection, onSnapshot, orderBy, query, serverTimestamp, updateDoc, doc, Timestamp,
} from "firebase/firestore";
import { MissingConfigNotice } from "@/components/config/missing-config-notice";
import { FormDateInput } from "@/components/form/FormDateInput";
import { FormInput } from "@/components/form/FormInput";
import { FormSelect } from "@/components/form/FormSelect";
import { getMissingFirebaseEnvVars, hasFirebaseConfig } from "@/lib";
import { getFirestoreDb } from "@/lib/firebase";
import { showToast } from "@/hooks/useToast";
import { formatDateInput } from "@/lib/utils";
import { fmtBirthDate } from "@/lib/report-utils";
import { validateAuthority } from "@/utils/validators";
import { uploadEvidenceFile } from "@/utils/storage-upload";
import type { OrgMember, Community } from "@/types/shared";

type PromovidoForm = {
  name: string;
  phone: string;
  curp: string;
  birthDate: string;
  activistId: string;
  communityId: string;
};

const defaultForm: PromovidoForm = {
  name: "", phone: "", curp: "", birthDate: "", activistId: "", communityId: "",
};

type Promovido = {
  id: string;
  name: string;
  phone: string;
  curp: string;
  birthDate: string;
  activistId: string;
  communityId: string;
  active: boolean;
  source: string;
};

export default function PromovidosCapturePage() {
  const isConfigured = hasFirebaseConfig();
  const missingVars  = getMissingFirebaseEnvVars();

  const [promovidos,   setPromovidos]   = useState<Promovido[]>([]);
  const [orgMembers,   setOrgMembers]   = useState<OrgMember[]>([]);
  const [communities,  setCommunities]  = useState<Community[]>([]);
  const [form,         setForm]         = useState<PromovidoForm>(defaultForm);
  const [fieldErrors,  setFieldErrors]  = useState<Record<string, string>>({});
  const [error,        setError]        = useState<string | null>(null);
  const [isSaving,     setIsSaving]     = useState(false);
  const [search,       setSearch]       = useState("");

  const frontRef = useRef<HTMLInputElement | null>(null);
  const backRef  = useRef<HTMLInputElement | null>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile,  setBackFile]  = useState<File | null>(null);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db) return;

    const u1 = onSnapshot(
      query(collection(db, "Promoted"), orderBy("name", "asc")),
      (snap) => setPromovidos(snap.docs.map((d) => ({
        id:          d.id,
        name:        d.get("name")        || "",
        phone:       d.get("phone")       || "",
        curp:        d.get("curp")        || "",
        birthDate:   formatDateInput(d.get("birthDate")),
        activistId:  d.get("activistId")  || "",
        communityId: d.get("communityId") || "",
        active:      d.get("active")      ?? true,
        source:      d.get("source")      || "",
      })))
    );

    const u2 = onSnapshot(
      query(collection(db, "OrgMembers"), orderBy("name", "asc")),
      (snap) => setOrgMembers(snap.docs.map((d) => ({
        id:         d.id,
        name:       d.get("name")       || "",
        phone:      d.get("phone")      || "",
        curp:       d.get("curp")       || "",
        birthDate:  formatDateInput(d.get("birthDate")),
        levelId:    d.get("levelId")    || "",
        parentId:   d.get("parentId")   || null,
        path:       d.get("path")       || [],
        assignment: d.get("assignment") || { cityId: null, communityId: null, routeId: null },
        appUserId:  d.get("appUserId")  || null,
        active:     d.get("active")     ?? true,
      })))
    );

    const u3 = onSnapshot(
      query(collection(db, "Communities"), orderBy("name", "asc")),
      (snap) => setCommunities(snap.docs.map((d) => ({
        id:                   d.id,
        name:                 d.get("name")   || "",
        cityId:               d.get("cityId") || null,
        delegateId:           d.get("delegateId")           || null,
        subDelegateId:        d.get("subDelegateId")        || null,
        ejidalCommissionerId: d.get("ejidalCommissionerId") || null,
      })))
    );

    return () => { u1(); u2(); u3(); };
  }, []);

  const memberMap    = useMemo(() => new Map(orgMembers.map((m) => [m.id, m])),     [orgMembers]);
  const communityMap = useMemo(() => new Map(communities.map((c) => [c.id, c])),    [communities]);

  const filteredPromovidos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? promovidos.filter((p) =>
          p.name.toLowerCase().includes(q) || p.curp.toLowerCase().includes(q)
        )
      : promovidos;
  }, [promovidos, search]);

  function setField(key: keyof PromovidoForm, value: string) {
    setForm((c) => ({ ...c, [key]: value }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  function resetForm() {
    setForm(defaultForm);
    setFieldErrors({});
    setError(null);
    setFrontFile(null);
    setBackFile(null);
    if (frontRef.current) frontRef.current.value = "";
    if (backRef.current) backRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const errs = validateAuthority(form);
    if (!form.activistId)  errs.activistId  = "El activista es obligatorio.";
    if (!form.communityId) errs.communityId = "La comunidad es obligatoria.";

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    const db = getFirestoreDb();
    if (!db) { setError("Firebase no está configurado."); return; }

    setIsSaving(true);
    setError(null);

    try {
      const id = crypto.randomUUID();
      await setDoc(doc(db, "Promoted", id), {
        name:                 form.name.trim(),
        phone:                form.phone.trim(),
        curp:                 form.curp.trim().toUpperCase(),
        birthDate:            form.birthDate
                                ? Timestamp.fromDate(new Date(form.birthDate + "T12:00:00"))
                                : null,
        activistId:           form.activistId,
        communityId:          form.communityId,
        active:               true,
        source:               "backoffice",
        createdAt:            serverTimestamp(),
        pendingCredentialFront: !frontFile,
        pendingCredentialBack:  !backFile,
      });

      const updates: Record<string, string> = {};

      if (frontFile) {
        const path = `org-members/${form.activistId}/promoted/${id}_front.jpg`;
        const url  = await uploadEvidenceFile(path, frontFile);
        updates.credentialFrontUrl = url;
      }

      if (backFile) {
        const path = `org-members/${form.activistId}/promoted/${id}_back.jpg`;
        const url  = await uploadEvidenceFile(path, backFile);
        updates.credentialBackUrl = url;
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, "Promoted", id), updates);
      }

      showToast("Promovido registrado correctamente.");
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
        <h2 className="text-3xl font-semibold tracking-tight">Captura — Promovidos</h2>
        <p className="mt-2 text-sm text-slate-600">
          Registra nuevos promovidos y opcionalmente adjunta credencial de elector.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr]">

        {/* ── Lista ── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Listado</h3>
              <p className="text-sm text-slate-600">Búsqueda por nombre o CURP.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {filteredPromovidos.length} registros
            </span>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">
              Buscar
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre o CURP"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              />
            </label>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">CURP</th>
                  <th className="px-4 py-3 font-medium">Activista</th>
                  <th className="px-4 py-3 font-medium">Comunidad</th>
                  <th className="px-4 py-3 font-medium">Nacimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredPromovidos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.curp}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {memberMap.get(p.activistId)?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {communityMap.get(p.communityId)?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{fmtBirthDate(p.birthDate)}</td>
                  </tr>
                ))}
                {filteredPromovidos.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      {search ? "Sin resultados para esa búsqueda." : "Aún no hay promovidos registrados."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        {/* ── Formulario ── */}
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold">Nuevo promovido</h3>
          <p className="mt-1 text-sm text-slate-600">Todos los campos marcados son obligatorios.</p>

          <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <FormInput
              label="Nombre completo"
              value={form.name}
              onChange={(v) => setField("name", v)}
              placeholder="Nombre completo"
              error={fieldErrors.name}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormInput
                label="Teléfono"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                maxLength={10}
                onChange={(v) => {
                  const digits = v.replace(/\D/g, "").slice(0, 10);
                  setField("phone", digits);
                }}
                placeholder="10 dígitos"
                error={fieldErrors.phone}
              />

              <FormDateInput
                label="Fecha de nacimiento"
                value={form.birthDate}
                onChange={(v) => setField("birthDate", v)}
                minAge={18}
                maxAge={100}
                error={fieldErrors.birthDate}
              />
            </div>

            <FormInput
              label="CURP"
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

            <FormSelect
              label="Activista"
              value={form.activistId}
              onChange={(v) => setField("activistId", v)}
              error={fieldErrors.activistId}
            >
              <option value="">Selecciona un activista</option>
              {orgMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </FormSelect>

            <FormSelect
              label="Comunidad"
              value={form.communityId}
              onChange={(v) => setField("communityId", v)}
              error={fieldErrors.communityId}
            >
              <option value="">Selecciona una comunidad</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </FormSelect>

            {/* Credencial */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">
                Credencial de elector{" "}
                <span className="text-xs font-normal text-slate-400">(opcional)</span>
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Frente</label>
                  <input
                    ref={frontRef}
                    type="file"
                    accept="image/*"
                    disabled={isSaving}
                    onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)}
                    className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  {frontFile && (
                    <p className="mt-1 text-xs text-slate-400 truncate">{frontFile.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Reverso</label>
                  <input
                    ref={backRef}
                    type="file"
                    accept="image/*"
                    disabled={isSaving}
                    onChange={(e) => setBackFile(e.target.files?.[0] ?? null)}
                    className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  {backFile && (
                    <p className="mt-1 text-xs text-slate-400 truncate">{backFile.name}</p>
                  )}
                </div>
              </div>
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
              {isSaving ? "Guardando..." : "Registrar promovido"}
            </button>
          </form>
        </article>

      </div>
    </section>
  );
}
