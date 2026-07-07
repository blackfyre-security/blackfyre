import { z } from "zod";
import { ScanStatus } from "../types/scan.js";

const frameworks = ["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa"] as const;

const targets = [
  "aws", "azure", "gcp", "okta", "azure_ad", "google_workspace",
  "jamf", "intune", "crowdstrike", "network",
] as const;

const scanTypes = ["quick", "deep", "iac"] as const;

const repoSourceSchema = z.object({
  provider: z.enum(["github", "gitlab", "bitbucket"]),
  repoUrl: z.string().url().max(500),
  branch: z.string().max(200).optional(),
  credentialRef: z.string().max(500).optional(),
});

export const createScanSchema = z.object({
  frameworks: z.array(z.enum(frameworks)).min(1),
  targets: z.array(z.enum(targets)).min(1),
  scanTypes: z.array(z.enum(scanTypes)).min(1).default(["quick"]),
  repoSource: repoSourceSchema.nullable().optional(),
});
export type CreateScanPayload = z.infer<typeof createScanSchema>;

export const updateScanSchema = z.object({
  status: z.nativeEnum(ScanStatus).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  errorDetails: z.string().optional(),
});
export type UpdateScanPayload = z.infer<typeof updateScanSchema>;
