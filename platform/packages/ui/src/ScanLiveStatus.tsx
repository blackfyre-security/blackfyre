"use client";

import React from "react";

export interface ScanLiveStatusProps {
  connectionState: "connecting" | "live" | "reconnecting" | "closed";
  status: string | null;
  findingCount: number;
}

export function ScanLiveStatus({
  connectionState,
  status,
  findingCount,
}: ScanLiveStatusProps) {
  let dotColor: string;
  let labelText: string;
  let labelColor: string;
  let isPulsing = false;

  if (connectionState === "live") {
    dotColor   = "var(--accent)";
    labelText  = "LIVE";
    labelColor = "var(--accent)";
    isPulsing  = true;
  } else if (connectionState === "reconnecting") {
    dotColor   = "var(--text-muted)";
    labelText  = "Reconnecting...";
    labelColor = "var(--text-muted)";
  } else if (
    connectionState === "closed" &&
    (status === "completed" || status === "completed_partial")
  ) {
    dotColor   = "var(--success-text)";
    labelText  = "Scan complete";
    labelColor = "var(--success-text)";
  } else {
    dotColor   = "var(--text-muted)";
    labelText  = "Connecting...";
    labelColor = "var(--text-muted)";
  }

  return (
    <div
      className="card px-4 py-3 flex items-center justify-between"
      style={{ borderRadius: 6 }}
    >
      <div className="flex items-center gap-2">
        <div
          className={`status-dot${isPulsing ? " status-dot-live" : ""}`}
          style={{ background: dotColor }}
          aria-hidden="true"
        />
        <span
          className="text-xs font-semibold mono uppercase tracking-wider"
          style={{ color: labelColor }}
          aria-live="polite"
          aria-atomic="true"
        >
          {labelText}
        </span>
      </div>
      <span
        className="text-xs mono"
        style={{ color: "var(--text-muted)" }}
        aria-label={`${findingCount} ${findingCount === 1 ? "finding" : "findings"}`}
      >
        {findingCount} {findingCount === 1 ? "finding" : "findings"}
      </span>
    </div>
  );
}
