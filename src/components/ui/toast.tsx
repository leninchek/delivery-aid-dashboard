"use client";

import { useToastStore } from "@/hooks/useToast";

export function Toaster() {
  const toasts = useToastStore();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            t.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
