import { z } from "zod";
import { AlertTriggerType, AlertChannel } from "../types/alert-rule.js";

export const triggerConfigSchema = z.object({
  severity: z.string().optional(),
  threshold: z.number().optional(),
  webhookUrl: z.string().url().optional(),
  frameworks: z.array(z.string()).optional(),
  message: z.string().optional(),
}).passthrough();

export const createAlertRuleSchema = z.object({
  triggerType: z.nativeEnum(AlertTriggerType),
  triggerConfig: triggerConfigSchema,
  channels: z.array(z.nativeEnum(AlertChannel)).min(1),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursTz: z.string().max(50).optional(),
  enabled: z.boolean().optional(),
});
export type CreateAlertRulePayload = z.infer<typeof createAlertRuleSchema>;

export const updateAlertRuleSchema = z.object({
  triggerType: z.nativeEnum(AlertTriggerType).optional(),
  triggerConfig: triggerConfigSchema.optional(),
  channels: z.array(z.nativeEnum(AlertChannel)).min(1).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursTz: z.string().max(50).nullable().optional(),
  enabled: z.boolean().optional(),
});
export type UpdateAlertRulePayload = z.infer<typeof updateAlertRuleSchema>;

export const listAlertRulesQuerySchema = z.object({
  triggerType: z.nativeEnum(AlertTriggerType).optional(),
  enabled: z.preprocess(
    (val) => (val === "true" ? true : val === "false" ? false : val),
    z.boolean().optional(),
  ),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListAlertRulesQuery = z.infer<typeof listAlertRulesQuerySchema>;

export const testAlertRuleSchema = z.object({
  ruleId: z.string().uuid(),
});
export type TestAlertRulePayload = z.infer<typeof testAlertRuleSchema>;

export const toggleAlertRuleSchema = z.object({
  enabled: z.boolean(),
});
export type ToggleAlertRulePayload = z.infer<typeof toggleAlertRuleSchema>;
