import { useMemo, useState } from "react";
import { sortRows } from "@/lib/report-utils";

export function useReportSort<T extends Record<string, unknown>>(
  rows: T[],
  initialKey: keyof T,
  initialDir: "asc" | "desc" = "desc",
) {
  const [sortKey, setSortKey] = useState<keyof T>(initialKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialDir);

  function toggleSort(field: keyof T) {
    if (sortKey === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(field); setSortDir("desc"); }
  }

  const sortedRows = useMemo(
    () => sortRows(rows, sortKey as string, sortDir),
    [rows, sortKey, sortDir],
  );

  return { sortKey, sortDir, toggleSort, sortedRows };
}
