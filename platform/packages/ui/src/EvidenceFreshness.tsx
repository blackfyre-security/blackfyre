const STATUS_MAP = {
  fresh: { color: "#4ade80", label: "Fresh" },
  aging: { color: "#fbbf24", label: "Aging" },
  stale: { color: "#f87171", label: "Stale" },
  missing: { color: "#6b7280", label: "Missing" },
};

export function EvidenceFreshness({ status }: { status: "fresh" | "aging" | "stale" | "missing" }) {
  const { color, label } = STATUS_MAP[status];
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span style={{ color }}>{label}</span>
    </span>
  );
}
