type AppUserRow = {
  uid:                string;
  phone:              string;
  name:               string;
  levelId:            string;
  active:             boolean;
  onboardingComplete: boolean;
};

type OrgLevel = { id: string; name: string; canUseApp: boolean };

type UserListProps = {
  rows: AppUserRow[];
  levelFilter: string;
  setLevelFilter: (v: string) => void;
  appLevels: OrgLevel[];
  levelById: Map<string, OrgLevel>;
  resettingUid: string | null;
  togglingUid: string | null;
  onResetPassword: (uid: string, phone: string) => Promise<void>;
  onToggle: (uid: string, active: boolean) => Promise<void>;
};

export function UserList({
  rows, levelFilter, setLevelFilter, appLevels, levelById,
  resettingUid, togglingUid, onResetPassword, onToggle,
}: UserListProps) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Usuarios</h3>
          <p className="text-sm text-slate-600">Todos los niveles con acceso a la App.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {rows.length} usuarios
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
            {rows.map((user) => {
              const level = levelById.get(user.levelId);
              return (
                <tr key={user.uid} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-700">{user.phone || "-"}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {user.name || <span className="italic text-slate-400">Sin completar</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{level?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
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
                        onClick={() => void onResetPassword(user.uid, user.phone)}
                        disabled={resettingUid === user.uid}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {resettingUid === user.uid ? "Restableciendo..." : "Restablecer contraseña"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onToggle(user.uid, !user.active)}
                        disabled={togglingUid === user.uid}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                          user.active
                            ? "border-rose-300 text-rose-700 hover:bg-rose-50"
                            : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {togglingUid === user.uid ? "..." : user.active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
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
  );
}
