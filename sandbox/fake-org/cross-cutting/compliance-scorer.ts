/**
 * compliance-scorer.ts
 * Recomputes compliance scores from findings using control mappings.
 * Does not import blackfyre source (avoids path/module complexity in sandbox).
 * Instead, derives control status directly from finding.controlMappings.
 */

import type { Finding } from "./evidence-generator.js";

export type ControlStatus = "pass" | "fail" | "partial" | "na";

export interface FrameworkScore {
  framework: string;
  score: number;
  controlStatuses: Record<string, ControlStatus>;
  snapshotAt: string;
}

export interface ComplianceOutput {
  scores: FrameworkScore[];
  trend: Array<{ date: string; scores: Record<string, number> }>;
  frameworks: string[];
}

const FRAMEWORKS = ["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa", "nist80053"];

// Static control weights per framework (matches blackfyre control-registry)
const CONTROL_WEIGHTS: Record<string, Record<string, number>> = {
  soc2: {
    "CC6.1": 3, "CC6.2": 3, "CC6.3": 3, "CC6.6": 3, "CC6.7": 3, "CC6.8": 2,
    "CC8.1": 2, "CC3.1": 2, "CC3.2": 2, "CC7.1": 3, "CC7.2": 3,
    "A1.1": 2, "A1.2": 2, "CC2.1": 1, "CC1.1": 1,
  },
  iso27001: {
    "A.8.5": 3, "A.8.3": 3, "A.5.15": 3, "A.8.24": 3, "A.8.20": 3, "A.8.21": 3,
    "A.8.15": 2, "A.8.16": 2, "A.5.24": 2, "A.5.25": 2, "A.5.9": 1, "A.5.10": 1,
  },
  hipaa: {
    "164.312(a)(1)": 3, "164.312(d)": 3, "164.312(b)": 3, "164.312(e)(1)": 3,
    "164.312(c)(1)": 2, "164.308(a)(1)(i)": 2, "164.308(a)(3)(i)": 2,
    "164.308(a)(5)(i)": 1, "164.310(a)(1)": 1,
  },
  gdpr: {
    "Art.5(1)(f)": 3, "Art.32(1)": 3, "Art.32(2)": 3, "Art.33": 2, "Art.34": 2,
    "Art.35": 2, "Art.25": 3, "Art.30": 1, "Art.5(1)(e)": 1, "Art.17": 2, "Art.7": 2,
  },
  pcidss: {
    "1.3.2": 3, "7.2.1": 3, "8.3.1": 3, "8.3.6": 3, "10.3.3": 2, "3.5.1": 3,
    "4.2.1": 3, "6.4.1": 2, "11.3.1": 2, "12.10.1": 2, "1.2.1": 2, "2.2.1": 2,
    "9.4.1": 1, "10.7.1": 2,
  },
  dpdpa: {
    "DPDPA-S8-1": 3, "DPDPA-S8-2": 3, "DPDPA-S8-3": 2, "DPDPA-S6-1": 2,
    "DPDPA-S6-2": 2, "DPDPA-S9-1": 2, "DPDPA-S10-1": 1, "DPDPA-S13-1": 1,
  },
  nist80053: {
    "AC-2": 3, "AC-3": 3, "AC-6": 3, "AC-17": 2, "AU-2": 2, "AU-9": 2,
    "AU-12": 2, "IA-2": 3, "IA-5": 2, "SC-8": 3, "SC-28": 3, "SI-2": 2,
    "IR-4": 2, "CA-7": 2,
  },
};

function computeScore(
  framework: string,
  controlStatuses: Record<string, ControlStatus>
): number {
  const weights = CONTROL_WEIGHTS[framework] || {};
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const [controlId, status] of Object.entries(controlStatuses)) {
    if (status === "na") continue;
    const w = weights[controlId] || 1;
    totalWeight += w;
    if (status === "pass") earnedWeight += w;
    else if (status === "partial") earnedWeight += w * 0.5;
  }

  if (totalWeight === 0) return 100;
  return Math.round((earnedWeight / totalWeight) * 100);
}

function trendDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split("T")[0];
}

export function generateComplianceScores(findings: Finding[]): ComplianceOutput {
  // Build control → severity map from findings
  const controlSeverities: Record<string, Record<string, "critical" | "high" | "medium" | "low">> = {};

  for (const f of findings) {
    for (const m of f.controlMappings || []) {
      if (!controlSeverities[m.framework]) controlSeverities[m.framework] = {};
      const existing = controlSeverities[m.framework][m.controlId];
      const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
      const newRank = severityRank[f.severity as keyof typeof severityRank] || 0;
      const existingRank = existing ? severityRank[existing] : 0;
      if (newRank > existingRank) {
        controlSeverities[m.framework][m.controlId] = f.severity as "critical" | "high" | "medium" | "low";
      }
    }
  }

  const scores: FrameworkScore[] = FRAMEWORKS.map((framework) => {
    const weights = CONTROL_WEIGHTS[framework] || {};
    const allControls = Object.keys(weights);
    const frameworkSeverities = controlSeverities[framework] || {};

    const controlStatuses: Record<string, ControlStatus> = {};
    for (const controlId of allControls) {
      const sev = frameworkSeverities[controlId];
      if (!sev) {
        controlStatuses[controlId] = "pass";
      } else if (sev === "critical" || sev === "high") {
        controlStatuses[controlId] = "fail";
      } else {
        controlStatuses[controlId] = "partial";
      }
    }

    // Mark a few as N/A deterministically
    const naControls = allControls.filter((_, idx) => idx === allControls.length - 1);
    for (const c of naControls) controlStatuses[c] = "na";

    const score = computeScore(framework, controlStatuses);

    return {
      framework,
      score,
      controlStatuses,
      snapshotAt: new Date().toISOString(),
    };
  });

  // Generate 90-day trend (weekly snapshots)
  const trend: ComplianceOutput["trend"] = [];
  for (let week = 12; week >= 0; week--) {
    const dayOffset = week * 7;
    const trendScores: Record<string, number> = {};
    for (const s of scores) {
      // Simulate slightly worse scores in the past
      trendScores[s.framework] = Math.max(0, Math.min(100, s.score - week * 1.5));
    }
    trend.push({ date: trendDate(dayOffset), scores: trendScores });
  }

  return {
    scores,
    trend,
    frameworks: FRAMEWORKS,
  };
}
