import { z } from "zod";
import { ReportType } from "../types/report.js";

export const createReportSchema = z.object({
  type: z.nativeEnum(ReportType),
  framework: z.string().max(20).optional(),
});
export type CreateReportPayload = z.infer<typeof createReportSchema>;
