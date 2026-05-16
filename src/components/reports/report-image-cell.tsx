"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

type ReportImageCellProps = {
  imageUrl: string | null;
  label: string;
  pending?: boolean;
  emptyLabel?: string;
};

export function ReportImageCell({
  imageUrl,
  label,
  pending = false,
  emptyLabel = "—",
}: ReportImageCellProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (imageUrl) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex h-12 w-16 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 transition hover:border-slate-400"
          title={`Ver ${label}`}
        >
          <img
            src={imageUrl}
            alt={label}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        </button>

        {isOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setIsOpen(false)}
          >
            <img
              src={imageUrl}
              alt={label}
              className="max-h-full max-w-full rounded object-contain"
            />
            <button
              type="button"
              className="absolute right-5 top-5 text-2xl font-bold leading-none text-white hover:text-slate-300"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar imagen"
            >
              ✕
            </button>
          </div>
        )}
      </>
    );
  }

  if (pending) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        Pendiente
      </span>
    );
  }

  return <span className="text-slate-400">{emptyLabel}</span>;
}
