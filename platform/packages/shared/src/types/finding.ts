export const Severity = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  INFO: "info",
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const FindingStatus = {
  OPEN: "open",
  ACKNOWLEDGED: "acknowledged",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  DISMISSED: "dismissed",
} as const;
export type FindingStatus = (typeof FindingStatus)[keyof typeof FindingStatus];

export const FindingCategory = {
  IAM: "iam",
  ENCRYPTION: "encryption",
  LOGGING: "logging",
  NETWORK: "network",
  ENDPOINT: "endpoint",
  IDENTITY: "identity",
  CONFIG: "config",
  IAC: "iac",
  STORAGE: "storage",
} as const;
export type FindingCategory = (typeof FindingCategory)[keyof typeof FindingCategory];

export const RemediationTier = {
  AUTO: "auto",
  APPROVAL: "approval",
  MANUAL: "manual",
} as const;
export type RemediationTier = (typeof RemediationTier)[keyof typeof RemediationTier];

export const FindingSource = {
  CUSTOM: "custom",
  PROWLER: "prowler",
  CHECKOV: "checkov",
  SEMGREP: "semgrep",
  BANDIT: "bandit",
} as const;
export type FindingSource = (typeof FindingSource)[keyof typeof FindingSource];

export interface Finding {
  id: string;
  scanId: string;
  tenantId: string;
  title: string;
  description: string;
  severity: Severity;
  status: FindingStatus;
  category: FindingCategory;
  resourceType: string | null;
  resourceId: string | null;
  resourceRegion: string | null;
  remediationTier: RemediationTier;
  autoFixAvailable: boolean;
  dedupHash: string;
  source: FindingSource;
  remediationNotes: string | null;
}
