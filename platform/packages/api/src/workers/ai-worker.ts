import type { SQSEvent } from "aws-lambda";
import { createDb } from "../db/connection.js";
import { AiAnalysisService } from "../services/ai-analysis-service.js";
import { loadConfig } from "../config.js";

type AnalysisType = "gap_analysis" | "mitre_mapping" | "risk_assessment" | "executive_summary";

interface AiJobPayload {
  tenantId: string;
  scanId: string;
  analysisType: AnalysisType;
  framework?: string;
  industry?: string;
}

export async function handler(event: SQSEvent): Promise<void> {
  const config = loadConfig();
  const { db } = createDb(config);
  const service = new AiAnalysisService(db);

  for (const record of event.Records) {
    const payload: AiJobPayload = JSON.parse(record.body);
    const { scanId, tenantId, analysisType, framework, industry } = payload;

    console.log(`[ai-worker] Processing ${analysisType} for scan=${scanId} tenant=${tenantId}`);

    try {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): pass the job's tenantId so the service's
      // assertScanOwnership() confirms the scan/finding belongs to this tenant before analysis.
      switch (analysisType) {
        case "gap_analysis":
          await service.gapAnalysis(scanId, framework ?? "SOC 2", tenantId);
          break;
        case "mitre_mapping":
          await service.mitreMapping(scanId, tenantId);
          break;
        case "risk_assessment":
          await service.riskAssessment(tenantId, industry);
          break;
        case "executive_summary":
          await service.executiveSummary(scanId, tenantId);
          break;
        default:
          console.warn(`[ai-worker] Unknown analysis type: ${analysisType}`);
      }
      console.log(`[ai-worker] Completed ${analysisType} for scan=${scanId}`);
    } catch (error) {
      console.error(`[ai-worker] Failed ${analysisType} for scan=${scanId}:`, error);
      throw error; // Let SQS retry
    }
  }
}
