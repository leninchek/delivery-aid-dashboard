export function SortTh<T extends string>({
  label,
  field,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  field: T;
  sortKey: T;
  sortDir: "asc" | "desc";
  onSort: (f: T) => void;
  className?: string;
}) {
  return (
    <th
      className={`cursor-pointer select-none px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      {label}
      <span className="ml-1 opacity-50">
        {sortKey === field ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </th>
  );
}
