import { z } from "zod";

export const listPatternsQuerySchema = z.object({
  patternType: z.enum(["common_finding", "false_positive", "remediation_rate", "predicted_gap"]).optional(),
  industry: z.enum(["fintech", "healthtech", "saas", "ecommerce", "custom"]).optional(),
  framework: z.enum(["soc2", "iso27001", "hipaa", "gdpr", "pcidss"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListPatternsQuery = z.infer<typeof listPatternsQuerySchema>;

export const industryInsightParamsSchema = z.object({
  industry: z.enum(["fintech", "healthtech", "saas", "ecommerce", "custom"]),
});
export type IndustryInsightParams = z.infer<typeof industryInsightParamsSchema>;
