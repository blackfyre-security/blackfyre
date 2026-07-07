export const ReportType = {
  READINESS: "readiness",
  EVIDENCE_PACKAGE: "evidence_package",
  BOARD_SUMMARY: "board_summary",
  GAP_ANALYSIS: "gap_analysis",
} as const;
export type ReportType = (typeof ReportType)[keyof typeof ReportType];

export const ReportStatus = {
  GENERATING: "generating",
  READY: "ready",
  FAILED: "failed",
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export interface Report {
  id: string;
  tenantId: string;
  type: ReportType;
  framework: string | null;
  status: ReportStatus;
  storagePath: string | null;
  shareToken: string | null;
  generatedAt: Date;
  expiresAt: Date | null;
}

export interface ReadinessReport {
  framework: string;
  overallScore: number;
  totalControls: number;
  passCount: number;
  failCount: number;
  partialCount: number;
  topFailingControls: { controlId: string; controlName: string; category: string }[];
  findingsBySeverity: Record<string, number>;
  generatedAt: string;
}

export interface GapAnalysisReport {
  framework: string;
  gaps: { category: string; controls: { controlId: string; controlName: string; status: string; findingCount: number }[] }[];
  totalGaps: number;
  generatedAt: string;
}

export interface BoardSummaryReport {
  frameworkScores: { framework: string; score: number }[];
  totalOpenFindings: number;
  criticalFindings: number;
  recentScanCount: number;
  remediationProgress: number;
  generatedAt: string;
}

export interface EvidencePackageReport {
  framework: string;
  controls: { controlId: string; controlName: string; status: string; evidenceItems: { type: string; collectedAt: string; collectedBy: string }[] }[];
  generatedAt: string;
}
