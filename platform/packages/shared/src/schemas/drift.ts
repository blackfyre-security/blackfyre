import { z } from "zod";
import { DriftChangeType, DriftSeverity } from "../types/drift-event.js";

export const listDriftEventsQuerySchema = z.object({
  integrationId: z.string().uuid().optional(),
  changeType: z.nativeEnum(DriftChangeType).optional(),
  severity: z.nativeEnum(DriftSeverity).optional(),
  acknowledged: z.preprocess(
    (val) => (val === "true" ? true : val === "false" ? false : val),
    z.boolean().optional(),
  ),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListDriftEventsQuery = z.infer<typeof listDriftEventsQuerySchema>;

export const acknowledgeDriftEventSchema = z.object({
  acknowledged: z.boolean(),
});
export type AcknowledgeDriftEventPayload = z.infer<typeof acknowledgeDriftEventSchema>;
