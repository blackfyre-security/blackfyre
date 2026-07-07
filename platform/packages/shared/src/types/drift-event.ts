export const DriftChangeType = {
  CREATED: "created",
  MODIFIED: "modified",
  DELETED: "deleted",
} as const;
export type DriftChangeType = (typeof DriftChangeType)[keyof typeof DriftChangeType];

export const DriftSeverity = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  INFO: "info",
} as const;
export type DriftSeverity = (typeof DriftSeverity)[keyof typeof DriftSeverity];

export interface DriftEvent {
  id: string;
  tenantId: string;
  integrationId: string;
  changeType: DriftChangeType;
  resourceType: string;
  resourceId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  severity: DriftSeverity;
  acknowledged: boolean;
  detectedAt: Date;
}
