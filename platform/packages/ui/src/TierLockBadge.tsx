export function TierLockBadge({ requiredTier }: { requiredTier: "protect" | "defend" }) {
  const label = requiredTier === "defend" ? "Defend" : "Protect";
  return (
    <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-700/30">
      {label}
    </span>
  );
}
