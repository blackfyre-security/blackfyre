import { z } from "zod";

export const complianceScoresQuerySchema = z.object({
  scanId: z.string().uuid().optional(),
});
export type ComplianceScoresQuery = z.infer<typeof complianceScoresQuerySchema>;

export const complianceMatrixParamsSchema = z.object({
  framework: z.enum(["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa", "iso42001", "pdppl", "nist80053"]),
});
export type ComplianceMatrixParams = z.infer<typeof complianceMatrixParamsSchema>;

export const complianceTrendQuerySchema = z.object({
  framework: z.enum(["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa", "iso42001", "pdppl", "nist80053"]),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type ComplianceTrendQuery = z.infer<typeof complianceTrendQuerySchema>;

export const complianceDiffQuerySchema = z.object({
  framework: z.enum(["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa", "iso42001", "pdppl", "nist80053"]),
  from: z.string().min(1),
  to: z.string().min(1),
});
export type ComplianceDiffQuery = z.infer<typeof complianceDiffQuerySchema>;

export const auditReadyBodySchema = z.object({
  enabled: z.boolean(),
});
export type AuditReadyBody = z.infer<typeof auditReadyBodySchema>;
