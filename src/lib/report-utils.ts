export type DatePreset = "today" | "week" | "month" | "30d" | "custom";

export function computeDateRange(
  preset: DatePreset,
  customStart = "",
  customEnd = "",
): { start: Date; end: Date } {
  const now = new Date();
  const eod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":  return { start: sod, end: eod };
    case "week":   return { start: new Date(now.getTime() - 7  * 86_400_000), end: eod };
    case "month":  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: eod };
    case "30d":    return { start: new Date(now.getTime() - 30 * 86_400_000), end: eod };
    case "custom": {
      const s = customStart ? new Date(customStart + "T00:00:00") : sod;
      const e = customEnd   ? new Date(customEnd   + "T23:59:59") : eod;
      return { start: s, end: e };
    }
  }
}

export function exportToCsv(filename: string, headers: string[], rows: string[][]): void {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function sortRows<T>(
  rows: T[],
  key: keyof T,
  dir: "asc" | "desc",
): T[] {
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    let cmp = 0;
    if (typeof av === "string" && typeof bv === "string")
      cmp = av.localeCompare(bv, "es");
    else if (typeof av === "number" && typeof bv === "number")
      cmp = av - bv;
    else if (av instanceof Date && bv instanceof Date)
      cmp = av.getTime() - bv.getTime();
    return dir === "asc" ? cmp : -cmp;
  });
}

export function parseTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value)
    return (value as { toDate: () => Date }).toDate();
  return null;
}
