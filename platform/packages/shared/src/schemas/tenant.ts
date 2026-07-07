import { z } from "zod";
import { TenantPlan, IndustryProfile } from "../types/tenant.js";

export const createTenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  plan: z.nativeEnum(TenantPlan),
  industryProfile: z.nativeEnum(IndustryProfile),
});
export type CreateTenantPayload = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  plan: z.nativeEnum(TenantPlan).optional(),
  industryProfile: z.nativeEnum(IndustryProfile).optional(),
});
export type UpdateTenantPayload = z.infer<typeof updateTenantSchema>;
