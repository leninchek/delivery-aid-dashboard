import { downloadCsvTemplate } from "@/utils/csv-import";
import type { CsvParseResult, CsvRowError } from "@/utils/csv-import";

export type ImportResult = {
  total:     number;
  succeeded: number;
  failed:    number;
  errors:    CsvRowError[];
};

type BulkImportSectionProps = {
  csvInputRef:    React.RefObject<HTMLInputElement | null>;
  csvPreview:     CsvParseResult | null;
  csvFileName:    string;
  isImporting:    boolean;
  importResult:   ImportResult | null;
  onFileChange:   (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImport:       () => void;
  onDismissResult: () => void;
};

export function BulkImportSection({
  csvInputRef, csvPreview, csvFileName, isImporting,
  importResult, onFileChange, onImport, onDismissResult,
}: BulkImportSectionProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Archivo CSV
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFileChange}
              disabled={isImporting}
              className="mt-2 block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-medium hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          {csvFileName && (
            <p className="mt-1 text-xs text-slate-400">Archivo: {csvFileName}</p>
          )}
        </div>

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
              onClick={onImport}
              disabled={isImporting || csvPreview.valid.length === 0}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isImporting
                ? "Importando..."
                : `Importar ${csvPreview.valid.length} usuario${csvPreview.valid.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}

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
                onClick={onDismissResult}
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
  );
}
