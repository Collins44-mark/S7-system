"use client";

type Props = {
  values: number[];
  color: string;
  fillOpacity?: number;
  className?: string;
};

export function SparkArea({
  values,
  color,
  fillOpacity = 0.25,
  className,
}: Props) {
  const gid = color.replace(/[^a-z0-9]/gi, "");

  if (!values.length) {
    return (
      <div
        className={`flex h-[120px] items-center justify-center text-xs text-slate-400 ${className ?? ""}`}
      >
        No data in this period
      </div>
    );
  }
  const w = 400;
  const h = 120;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = w / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 24) - 12;
    return `${x},${y}`;
  });
  const poly = pts.join(" ");
  const last = pts[pts.length - 1]?.split(",") ?? ["400", "60"];
  const first = pts[0]?.split(",") ?? ["0", "60"];
  const areaD = `M0,${h} L${first[0]},${first[1]} L${poly.replace(/ /g, " L ")} L${last[0]},${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#g-${gid})`} />
      <polyline
        points={poly}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
