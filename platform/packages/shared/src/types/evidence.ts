export const EvidenceType = {
  CONFIG_SNAPSHOT: "config_snapshot",
  API_RESPONSE: "api_response",
  SCREENSHOT: "screenshot",
  MANUAL_UPLOAD: "manual_upload",
} as const;
export type EvidenceType = (typeof EvidenceType)[keyof typeof EvidenceType];

export interface Evidence {
  id: string;
  findingId: string;
  tenantId: string;
  type: EvidenceType;
  storagePath: string;
  sha256Hash: string;
  framework?: string;
  s3ObjectKey?: string;
  collectedAt: Date;
  collectedBy: string;
}
