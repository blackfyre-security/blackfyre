export const ScanStatus = {
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  COMPLETED_PARTIAL: "completed_partial",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;
export type ScanStatus = (typeof ScanStatus)[keyof typeof ScanStatus];

export const ScanType = {
  QUICK: "quick",
  DEEP: "deep",
  IAC: "iac",
} as const;
export type ScanType = (typeof ScanType)[keyof typeof ScanType];

export interface RepoSource {
  provider: "github" | "gitlab" | "bitbucket";
  repoUrl: string;
  branch?: string;
  credentialRef?: string;
}

export interface Scan {
  id: string;
  tenantId: string;
  triggeredBy: string;
  frameworks: string[];
  targets: string[];
  scanTypes: ScanType[];
  status: ScanStatus;
  progress: number;
  startedAt: Date | null;
  completedAt: Date | null;
  errorDetails: string | null;
  agentSwarmId: string | null;
  repoSource: RepoSource | null;
  artifactBucket: string | null;
}
