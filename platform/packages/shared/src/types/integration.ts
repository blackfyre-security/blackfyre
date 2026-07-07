export const IntegrationType = {
  AWS: "aws",
  AZURE: "azure",
  GCP: "gcp",
  OKTA: "okta",
  AZURE_AD: "azure_ad",
  GOOGLE_WORKSPACE: "google_workspace",
  JAMF: "jamf",
  INTUNE: "intune",
  CROWDSTRIKE: "crowdstrike",
  NETWORK: "network",
  GITHUB: "github",
  GITLAB: "gitlab",
  BITBUCKET: "bitbucket",
} as const;
export type IntegrationType = (typeof IntegrationType)[keyof typeof IntegrationType];

export const IntegrationStatus = {
  ACTIVE: "active",
  ERROR: "error",
  EXPIRED: "expired",
} as const;
export type IntegrationStatus = (typeof IntegrationStatus)[keyof typeof IntegrationStatus];

export interface Integration {
  id: string;
  tenantId: string;
  type: IntegrationType;
  credentialRef: string;
  status: IntegrationStatus;
  lastVerifiedAt: Date | null;
}
