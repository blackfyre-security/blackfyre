import { RemediationTier } from "./finding.js";

export const RemediationStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  EXECUTING: "executing",
  COMPLETED: "completed",
  FAILED: "failed",
  ROLLED_BACK: "rolled_back",
} as const;
export type RemediationStatus = (typeof RemediationStatus)[keyof typeof RemediationStatus];

export interface Remediation {
  id: string;
  findingId: string;
  tier: RemediationTier;
  status: RemediationStatus;
  approvedBy: string | null;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  playbookContent: string | null;
  executedAt: Date | null;
  completedAt: Date | null;
}
