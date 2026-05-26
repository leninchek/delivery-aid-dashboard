type FormDateInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  minAge?: number;
  maxAge?: number;
};

function yearOffset(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

export function FormDateInput({
  label, value, onChange, error, minAge, maxAge,
}: FormDateInputProps) {
  const min = maxAge !== undefined ? yearOffset(maxAge) : undefined;
  const max = minAge !== undefined ? yearOffset(minAge) : undefined;

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        className={`w-full rounded-lg border px-3 py-2 outline-none transition focus:border-slate-900 ${
          error ? "border-rose-400 bg-rose-50" : "border-slate-300"
        }`}
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
