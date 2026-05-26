type FormSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
  hint?: string;
};

export function FormSelect({
  label, value, onChange, children, error, required, hint,
}: FormSelectProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={`w-full rounded-lg border px-3 py-2 outline-none transition focus:border-slate-900 ${
          error ? "border-rose-400 bg-rose-50" : "border-slate-300"
        }`}
      >
        {children}
      </select>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
