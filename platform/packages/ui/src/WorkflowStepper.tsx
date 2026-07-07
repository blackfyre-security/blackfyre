export interface WorkflowStep {
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#6b7280", running: "#818cf8", completed: "#4ade80", failed: "#f87171", skipped: "#4b5563",
};

export function WorkflowStepper({ steps }: { steps: WorkflowStep[] }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{ background: STATUS_COLORS[step.status] + "33", color: STATUS_COLORS[step.status] }}
            title={`${step.name}: ${step.status}`}
          >
            {step.status === "completed" ? "✓" : step.status === "failed" ? "✗" : i + 1}
          </div>
          {i < steps.length - 1 && <div className="w-3 h-px" style={{ background: STATUS_COLORS[step.status] + "66" }} />}
        </div>
      ))}
    </div>
  );
}
