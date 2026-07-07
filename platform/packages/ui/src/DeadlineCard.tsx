export interface DeadlineInfo {
  title: string;
  framework: string;
  daysRemaining: number;
  readinessPercent: number;
}

export function DeadlineCard({ deadline }: { deadline: DeadlineInfo }) {
  const urgencyColor = deadline.daysRemaining <= 7 ? "#f87171" : deadline.daysRemaining <= 30 ? "#fbbf24" : "#4ade80";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="truncate">{deadline.title}</span>
      <span className="shrink-0 text-xs font-medium" style={{ color: urgencyColor }}>
        {deadline.daysRemaining}d
      </span>
    </div>
  );
}
