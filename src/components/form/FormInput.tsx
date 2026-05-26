type FormInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  type?: "text" | "tel" | "date" | "number";
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  required?: boolean;
  mono?: boolean;
  hint?: string;
  min?: string | number;
  max?: string | number;
  labelAccessory?: React.ReactNode;
  multiline?: boolean;
  rows?: number;
};

export function FormInput({
  label, value, onChange, error, placeholder, type = "text",
  inputMode, maxLength, required, mono, hint, min, max,
  labelAccessory, multiline, rows = 4,
}: FormInputProps) {
  const base = `w-full rounded-lg border px-3 py-2 outline-none transition focus:border-slate-900 ${
    mono ? "font-mono" : ""
  } ${error ? "border-rose-400 bg-rose-50" : "border-slate-300"}`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        {labelAccessory}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={base}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          required={required}
          min={min}
          max={max}
          className={base}
        />
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
