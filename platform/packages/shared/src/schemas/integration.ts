import { z } from "zod";
import { IntegrationType, IntegrationStatus } from "../types/integration.js";

export const createIntegrationSchema = z.object({
  type: z.nativeEnum(IntegrationType),
  credentialRef: z.string().min(1).max(500),
});
export type CreateIntegrationPayload = z.infer<typeof createIntegrationSchema>;

export const updateIntegrationSchema = z.object({
  status: z.nativeEnum(IntegrationStatus).optional(),
  credentialRef: z.string().min(1).max(500).optional(),
});
export type UpdateIntegrationPayload = z.infer<typeof updateIntegrationSchema>;
