import { z } from "zod";
import { Severity, FindingStatus, FindingCategory, RemediationTier } from "../types/finding.js";

export const listFindingsQuerySchema = z.object({
  scanId: z.string().uuid().optional(),
  severity: z.nativeEnum(Severity).optional(),
  status: z.nativeEnum(FindingStatus).optional(),
  category: z.nativeEnum(FindingCategory).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListFindingsQuery = z.infer<typeof listFindingsQuerySchema>;

export const updateFindingStatusSchema = z.object({
  status: z.nativeEnum(FindingStatus),
});
export type UpdateFindingStatusPayload = z.infer<typeof updateFindingStatusSchema>;

// Used internally by scan agents to report findings
export const agentFindingSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  severity: z.nativeEnum(Severity),
  category: z.nativeEnum(FindingCategory),
  resourceType: z.string().max(200).nullable().optional(),
  resourceId: z.string().max(500).nullable().optional(),
  resourceRegion: z.string().max(100).nullable().optional(),
  remediationTier: z.nativeEnum(RemediationTier),
  autoFixAvailable: z.boolean().default(false),
  controlMappings: z.array(z.object({
    framework: z.enum(["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa", "nist80053"]),
    controlId: z.string().min(1).max(50),
    controlName: z.string().min(1).max(300),
    status: z.enum(["pass", "partial", "fail", "na"]),
    weight: z.number().int().min(1).max(3).default(1),
  })).optional(),
  source: z.string().max(100).optional(),
  remediationNotes: z.string().max(2000).nullable().optional(),
});
export type AgentFindingPayload = z.infer<typeof agentFindingSchema>;
