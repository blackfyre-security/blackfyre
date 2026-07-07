const DRIFT_MAP = {
  benign: { color: "#4ade80", bg: "#14532d" },
  suspicious: { color: "#fbbf24", bg: "#422006" },
  critical: { color: "#f87171", bg: "#7f1d1d" },
};

export function DriftSeverityBadge({ classification }: { classification: "benign" | "suspicious" | "critical" }) {
  const { color, bg } = DRIFT_MAP[classification];
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ color, background: bg }}>
      {classification}
    </span>
  );
}
