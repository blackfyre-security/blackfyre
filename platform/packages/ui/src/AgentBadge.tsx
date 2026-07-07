const AGENT_COLORS: Record<string, string> = {
  scout: "#60a5fa", shield: "#4ade80", helix: "#c084fc", pulse: "#fbbf24",
  cortex: "#818cf8", ledger: "#f97316", signal: "#ef4444", apex: "#ec4899",
};

export function AgentBadge({ agent, size = "sm" }: { agent: string; size?: "sm" | "md" }) {
  const color = AGENT_COLORS[agent.toLowerCase()] ?? "#6b7280";
  const cls = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";
  return (
    <span className={`${cls} rounded font-medium uppercase tracking-wide`} style={{ color, border: `1px solid ${color}33` }}>
      {agent}
    </span>
  );
}
