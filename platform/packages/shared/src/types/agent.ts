export const AgentType = {
  CLOUD_AUDITOR_AWS: "cloud-auditor-aws",
  CLOUD_AUDITOR_AZURE: "cloud-auditor-azure",
  CLOUD_AUDITOR_GCP: "cloud-auditor-gcp",
  IDENTITY_AUDITOR: "identity-auditor",
  ENDPOINT_AUDITOR: "endpoint-auditor",
  NETWORK_SCANNER: "network-scanner",
  EVIDENCE_COLLECTOR: "evidence-collector",
  COMPLIANCE_MAPPER: "compliance-mapper",
  REPORT_GENERATOR: "report-generator",
  DRIFT_MONITOR: "drift-monitor",
  REMEDIATION_AGENT: "remediation-agent",
  THREAT_INTEL_AGENT: "threat-intel-agent",
  TENANT_GUARDIAN: "tenant-guardian",
} as const;
export type AgentType = (typeof AgentType)[keyof typeof AgentType];

export const AgentStatus = {
  IDLE: "idle",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  TIMEOUT: "timeout",
} as const;
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export interface AgentResult {
  agentType: AgentType;
  status: AgentStatus;
  findingsCount: number;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
}

export interface SwarmStatus {
  swarmId: string;
  scanId: string;
  agents: AgentResult[];
  overallProgress: number;
  startedAt: Date;
  completedAt: Date | null;
}

// Maps integration types to the agents that scan them
export const INTEGRATION_AGENT_MAP: Record<string, AgentType[]> = {
  aws: [AgentType.CLOUD_AUDITOR_AWS],
  azure: [AgentType.CLOUD_AUDITOR_AZURE],
  gcp: [AgentType.CLOUD_AUDITOR_GCP],
  okta: [AgentType.IDENTITY_AUDITOR],
  azure_ad: [AgentType.IDENTITY_AUDITOR],
  google_workspace: [AgentType.IDENTITY_AUDITOR],
  jamf: [AgentType.ENDPOINT_AUDITOR],
  intune: [AgentType.ENDPOINT_AUDITOR],
  crowdstrike: [AgentType.ENDPOINT_AUDITOR],
  network: [AgentType.NETWORK_SCANNER],
};
