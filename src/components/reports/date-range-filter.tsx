"use client";

import type { DatePreset } from "@/lib/report-utils";

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today",  label: "Hoy"           },
  { value: "week",   label: "Semana"        },
  { value: "month",  label: "Mes"           },
  { value: "30d",    label: "30 días"       },
  { value: "custom", label: "Personalizado" },
];

export function DateRangeFilter({
  preset,
  customStart,
  customEnd,
  onPreset,
  onStart,
  onEnd,
}: {
  preset: DatePreset;
  customStart: string;
  customEnd: string;
  onPreset: (p: DatePreset) => void;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onPreset(p.value)}
            className={`px-3 py-1.5 text-sm font-medium transition ${
              preset === p.value
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <>
          <input
            type="date"
            value={customStart}
            onChange={(e) => onStart(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
          />
          <span className="text-sm text-slate-400">—</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onEnd(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
          />
        </>
      )}
    </div>
  );
}
