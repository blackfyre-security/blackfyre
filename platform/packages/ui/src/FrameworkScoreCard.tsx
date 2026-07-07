import React from "react";
import { ScoreRing } from "./ScoreRing";

export interface FrameworkScoreCardProps {
  name: string;
  score: number;
}

export function FrameworkScoreCard({ name, score }: FrameworkScoreCardProps) {
  return (
    <div
      className="card p-5 flex flex-col items-center card-interactive hover-lift"
      style={{
        transition:
          "box-shadow var(--duration) var(--ease-smooth), transform var(--duration) var(--ease-smooth)",
      }}
    >
      <ScoreRing score={score} size={96} />
      <p
        className="mt-3 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {name}
      </p>
    </div>
  );
}
