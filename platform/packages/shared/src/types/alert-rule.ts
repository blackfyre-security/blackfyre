export const AlertTriggerType = {
  SEVERITY: "severity",
  SCORE_DROP: "score_drop",
  DRIFT: "drift",
  SCAN_COMPLETE: "scan_complete",
  DEADLINE: "deadline",
  REGULATORY: "regulatory",
} as const;
export type AlertTriggerType = (typeof AlertTriggerType)[keyof typeof AlertTriggerType];

export const AlertChannel = {
  EMAIL: "email",
  SLACK: "slack",
  WEBHOOK: "webhook",
  SMS: "sms",
} as const;
export type AlertChannel = (typeof AlertChannel)[keyof typeof AlertChannel];

export interface TriggerConfig {
  severity?: string;
  threshold?: number;
  webhookUrl?: string;
  frameworks?: string[];
  message?: string;
  [key: string]: unknown;
}

export interface AlertRule {
  id: string;
  tenantId: string;
  triggerType: AlertTriggerType;
  triggerConfig: TriggerConfig;
  channels: AlertChannel[];
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTz: string | null;
  enabled: boolean;
}
