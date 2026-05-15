export function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-5 py-3.5" style={{ opacity: 1 - i * 0.1 }}>
          {Array.from({ length: cols }).map((__, j) => (
            <div key={j} className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  );
}
