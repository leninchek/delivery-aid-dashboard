import { FormInput } from "@/components/form/FormInput";
import { FormSelect } from "@/components/form/FormSelect";

type CreateForm = {
  phone:       string;
  levelId:     string;
  parentId:    string;
  cityId:      string;
  communityId: string;
  routeId:     string;
};

type OrgLevel    = { id: string; name: string; canUseApp: boolean };
type OrgMember   = { id: string; name: string; levelId: string; phone: string };
type CatalogItem = { id: string; name: string };
type Community   = { id: string; name: string; cityId: string | null };

type CreateUserFormProps = {
  form:                 CreateForm;
  fieldErrors:          Partial<Record<keyof CreateForm, string>>;
  isSaving:             boolean;
  appLevels:            OrgLevel[];
  sortedOrgMembers:     OrgMember[];
  cities:               CatalogItem[];
  filteredCommunities:  Community[];
  routes:               CatalogItem[];
  memberLabel:          (m: OrgMember) => string;
  setField:             (key: keyof CreateForm, value: string) => void;
  onSubmit:             (e: React.FormEvent<HTMLFormElement>) => void;
};

export function CreateUserForm({
  form, fieldErrors, isSaving, appLevels, sortedOrgMembers,
  cities, filteredCommunities, routes, memberLabel, setField, onSubmit,
}: CreateUserFormProps) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold">Nuevo usuario</h3>
      <p className="mt-0.5 text-sm text-slate-600">
        El activista completará su perfil en el primer inicio de sesión.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>

        <FormInput
          label="Teléfono"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          mono
          value={form.phone}
          onChange={(v) => setField("phone", v.replace(/\D/g, ""))}
          placeholder="5512345678"
          error={fieldErrors.phone}
          hint="La contraseña inicial serán los últimos 6 dígitos."
        />

        <FormSelect
          label="Nivel organizacional"
          value={form.levelId}
          onChange={(v) => setField("levelId", v)}
          error={fieldErrors.levelId}
        >
          <option value="">Selecciona un nivel</option>
          {appLevels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </FormSelect>

        <FormSelect
          label="Superior directo (opcional)"
          value={form.parentId}
          onChange={(v) => setField("parentId", v)}
        >
          <option value="">Sin asignar</option>
          {sortedOrgMembers.map((m) => (
            <option key={m.id} value={m.id}>{memberLabel(m)}</option>
          ))}
        </FormSelect>

        <FormSelect
          label="Ciudad (opcional)"
          value={form.cityId}
          onChange={(v) => {
            setField("cityId", v);
            setField("communityId", "");
          }}
        >
          <option value="">Sin asignar</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </FormSelect>

        <FormSelect
          label="Comunidad (opcional)"
          value={form.communityId}
          onChange={(v) => setField("communityId", v)}
        >
          <option value="">Sin asignar</option>
          {filteredCommunities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </FormSelect>

        <FormSelect
          label="Ruta (opcional)"
          value={form.routeId}
          onChange={(v) => setField("routeId", v)}
        >
          <option value="">Sin asignar</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </FormSelect>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "Creando usuario..." : "Crear usuario"}
        </button>
      </form>
    </article>
  );
}
