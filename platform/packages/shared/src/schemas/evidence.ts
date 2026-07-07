import { z } from "zod";
import { EvidenceType } from "../types/evidence.js";
import { RemediationTier } from "../types/finding.js";
import { RemediationStatus } from "../types/remediation.js";

export const createEvidenceSchema = z.object({
  findingId: z.string().uuid(),
  type: z.nativeEnum(EvidenceType),
  collectedBy: z.string().min(1).max(200),
});
export type CreateEvidencePayload = z.infer<typeof createEvidenceSchema>;

export const listEvidenceQuerySchema = z.object({
  findingId: z.string().uuid().optional(),
  type: z.nativeEnum(EvidenceType).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListEvidenceQuery = z.infer<typeof listEvidenceQuerySchema>;

export const listVaultQuerySchema = z.object({
  framework: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListVaultQuery = z.infer<typeof listVaultQuerySchema>;

export const createRemediationSchema = z.object({
  findingId: z.string().uuid(),
  tier: z.nativeEnum(RemediationTier),
  playbookContent: z.string().optional(),
});
export type CreateRemediationPayload = z.infer<typeof createRemediationSchema>;

export const approveRemediationSchema = z.object({
  approved: z.boolean(),
});
export type ApproveRemediationPayload = z.infer<typeof approveRemediationSchema>;

export const updateRemediationStatusSchema = z.object({
  status: z.nativeEnum(RemediationStatus),
});
export type UpdateRemediationStatusPayload = z.infer<typeof updateRemediationStatusSchema>;

export const listRemediationsQuerySchema = z.object({
  findingId: z.string().uuid().optional(),
  status: z.nativeEnum(RemediationStatus).optional(),
  tier: z.nativeEnum(RemediationTier).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListRemediationsQuery = z.infer<typeof listRemediationsQuerySchema>;
