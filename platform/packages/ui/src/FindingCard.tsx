import React from "react";

export interface FindingCardFinding {
  id: string;
  title: string;
  severity: string;
  category: string;
  resourceId: string | null;
  controlMappings: Array<{ framework: string; controlId: string }>;
}

export interface FindingCardProps {
  finding: FindingCardFinding;
  index: number;
}

const borderColorMap: Record<string, string> = {
  critical: "var(--critical)",
  high:     "var(--high)",
  medium:   "var(--medium)",
  low:      "var(--low)",
  info:     "var(--info-color)",
};

const frameworkColorMap: Record<string, { bg: string; text: string }> = {
  SOC2:      { bg: "var(--info-bg)",      text: "var(--info-text)" },
  ISO27001:  { bg: "var(--low-bg)",       text: "var(--low-text)" },
  HIPAA:     { bg: "var(--success-bg)",   text: "var(--success-text)" },
  GDPR:      { bg: "var(--medium-bg)",    text: "var(--medium-text)" },
  "PCI-DSS": { bg: "var(--high-bg)",      text: "var(--high-text)" },
  DPDPA:     { bg: "var(--critical-bg)",  text: "var(--critical-text)" },
};

function truncateResource(resourceId: string, maxLen = 40): string {
  if (resourceId.length <= maxLen) return resourceId;
  return resourceId.slice(0, maxLen) + "...";
}

export function FindingCard({ finding, index }: FindingCardProps) {
  const borderLeftColor = borderColorMap[finding.severity] ?? "var(--border-subtle)";
  const badgeVariant = (
    ["critical", "high", "medium", "low", "info"].includes(finding.severity)
      ? finding.severity
      : "info"
  ) as "critical" | "high" | "medium" | "low" | "info";
  const staggerClass = index < 5 ? `stagger-${index + 1}` : "";

  const uniqueFrameworks = Array.from(
    new Map(finding.controlMappings.map((m) => [m.framework, m])).values()
  );
  const visibleTags = uniqueFrameworks.slice(0, 3);
  const overflowCount = uniqueFrameworks.length - 3;

  return (
    <div
      className={`card border-l-4 p-4 animate-fade-up ${staggerClass} card-interactive`}
      style={{ borderLeftColor }}
    >
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`badge badge-${badgeVariant}`}
            aria-label={`${finding.severity} severity`}
          >
            {finding.severity.toUpperCase()}
          </span>
          <span
            className="text-sm font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {finding.title}
          </span>
          {finding.resourceId && (
            <span
              className="ml-auto text-xs mono truncate max-w-[250px]"
              style={{ color: "var(--text-muted)" }}
              title={finding.resourceId}
            >
              {truncateResource(finding.resourceId)}
            </span>
          )}
        </div>

        {uniqueFrameworks.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {visibleTags.map((mapping) => {
              const colors = frameworkColorMap[mapping.framework] ?? {
                bg: "var(--border-subtle)",
                text: "var(--text-muted)",
              };
              return (
                <span
                  key={mapping.framework}
                  className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5"
                  style={{
                    background: colors.bg,
                    color: colors.text,
                    borderRadius: 3,
                  }}
                >
                  {mapping.framework}
                </span>
              );
            })}
            {overflowCount > 0 && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                +{overflowCount} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
