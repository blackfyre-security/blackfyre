"use client";

import React from "react";

export interface ScanProgressBarProps {
  progress: number;
  currentCategory: string;
  status: "running" | "completed" | "completed_partial" | "failed" | null;
}

export function ScanProgressBar({
  progress,
  currentCategory,
  status,
}: ScanProgressBarProps) {
  const isCompleted = status === "completed" || status === "completed_partial";
  const isFailed = status === "failed";
  const displayProgress = isCompleted ? 100 : Math.min(progress, 100);

  const labelText = isCompleted
    ? "Scan complete"
    : isFailed
    ? "Scan stopped \u2014 see error below"
    : currentCategory
    ? `Scanning ${currentCategory}...`
    : "Starting scan...";

  const labelColor = isCompleted
    ? "var(--success-text)"
    : isFailed
    ? "var(--critical-text)"
    : "var(--accent)";

  return (
    <div className="w-full">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div
            role="progressbar"
            aria-valuenow={displayProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Scan progress"
            style={{
              width:        "100%",
              height:       8,
              borderRadius: 4,
              overflow:     "hidden",
              background:   "var(--border)",
            }}
          >
            <div
              style={{
                width:      `${displayProgress}%`,
                height:     "100%",
                borderRadius: 4,
                background:   isFailed ? "var(--critical)" : "var(--accent-gradient)",
                transition:   "width 500ms ease-out",
              }}
            />
          </div>
        </div>
        <span
          className="text-2xl font-bold mono tabular-nums min-w-[56px] text-right"
          style={{ color: labelColor }}
          aria-hidden="true"
        >
          {displayProgress}%
        </span>
      </div>
      <p
        className="text-xs mono uppercase tracking-wider mt-1.5"
        style={{ color: labelColor }}
      >
        {labelText}
      </p>
    </div>
  );
}
