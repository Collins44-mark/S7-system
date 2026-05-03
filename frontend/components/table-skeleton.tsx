export function TableSkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded-lg bg-slate-200/60"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}
