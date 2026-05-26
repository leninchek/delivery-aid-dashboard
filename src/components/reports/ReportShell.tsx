type ReportShellProps = {
  title?: string;
  description?: string;
  filters: React.ReactNode;
  error?: string | null;
  onGenerate: () => void;
  generateLabel?: string;
  isLoading: boolean;
  hasRun: boolean;
  rowCount?: number;
  rowLabel?: [string, string]; // [singular, plural]
  onExport?: () => void;
  exportDisabled?: boolean;
  children: React.ReactNode;
};

export function ReportShell({
  title, description, filters, error, onGenerate, generateLabel,
  isLoading, hasRun, rowCount = 0, rowLabel = ["registro", "registros"],
  onExport, exportDisabled, children,
}: ReportShellProps) {
  return (
    <section className="space-y-6">
      {title && (
        <header>
          <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
        </header>
      )}

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        {filters}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onGenerate}
            disabled={isLoading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {isLoading ? "Generando..." : (generateLabel ?? "Generar reporte")}
          </button>
          {hasRun && rowCount > 0 && onExport && (
            <button
              type="button"
              onClick={onExport}
              disabled={exportDisabled}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {hasRun && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-700">
              {rowCount} {rowCount === 1 ? rowLabel[0] : rowLabel[1]}
            </p>
          </div>
          {children}
        </div>
      )}
    </section>
  );
}
