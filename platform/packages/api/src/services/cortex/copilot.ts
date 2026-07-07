import { getLlmClient, type LlmClient, type LlmTextBlock } from "../llm/client.js";
import type { Db } from "../../db/connection.js";
import { findings, complianceScores, scans, driftEvents } from "../../db/schema.js";
import { eq, and, desc, count, sql } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type CopilotIntent =
  | "gap_analysis"
  | "findings_query"
  | "remediation_query"
  | "analytics_query"
  | "risk_assessment"
  | "benchmarking"
  | "drift_query"
  | "readiness_assessment"
  | "general";

export interface CopilotResponse {
  answer: string;
  intent: CopilotIntent;
  supportingEvidence: string[];
  actionItems: string[];
  confidence: number;
  sources: string[];
}

export interface CopilotConversation {
  id: string;
  tenantId: string;
  userId: string;
  question: string;
  intent: CopilotIntent;
  response: CopilotResponse;
  feedbackRating?: number;
  sessionId: string;
  createdAt: Date;
}

/* ------------------------------------------------------------------ */
/*  Intent Classification                                              */
/* ------------------------------------------------------------------ */

const INTENT_PATTERNS: Array<{ intent: CopilotIntent; patterns: RegExp[] }> = [
  { intent: "gap_analysis", patterns: [/compli(ant|ance)/i, /gap/i, /ready for.*audit/i, /certification/i] },
  { intent: "findings_query", patterns: [/fail(ed)?/i, /finding/i, /issue/i, /vulnerab/i, /what('s| is) wrong/i] },
  { intent: "remediation_query", patterns: [/fix/i, /remediat/i, /how (do|can|to)/i, /resolve/i, /patch/i] },
  { intent: "analytics_query", patterns: [/trend/i, /score/i, /progress/i, /improv/i, /metric/i, /dashboard/i] },
  { intent: "risk_assessment", patterns: [/risk/i, /biggest.*threat/i, /danger/i, /exposure/i, /attack/i] },
  { intent: "benchmarking", patterns: [/compar/i, /benchmark/i, /industry/i, /peer/i, /percentile/i] },
  { intent: "drift_query", patterns: [/drift/i, /change/i, /modif/i, /since last/i, /what changed/i] },
  { intent: "readiness_assessment", patterns: [/ready/i, /prepared/i, /audit/i, /certification/i, /soc.?2/i] },
];

function classifyIntent(question: string): CopilotIntent {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(question))) {
      return intent;
    }
  }
  return "general";
}

/* ------------------------------------------------------------------ */
/*  Copilot Service                                                    */
/* ------------------------------------------------------------------ */

export class CopilotService {
  private client: LlmClient;

  constructor(private db: Db) {
    this.client = getLlmClient();
  }

  /**
   * Ask CORTEX a question about compliance, security, or posture.
   */
  async askQuestion(tenantId: string, userId: string, question: string): Promise<CopilotResponse> {
    const intent = classifyIntent(question);
    const context = await this.buildContext(tenantId, intent);

    const systemPrompt = `You are CORTEX, Blackfyre's AI security compliance assistant. You help security teams understand their compliance posture, findings, and remediation options.

CONTEXT FOR THIS TENANT:
${context}

RULES:
- Be specific and actionable
- Reference specific findings, scores, or controls when available
- Suggest concrete next steps
- If you're unsure, say so and recommend manual review
- Never fabricate compliance data
- Cite framework controls (e.g., SOC 2 CC6.1, ISO 27001 A.9.1) when relevant`;

    const message = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    });

    const answerText = message.content
      .filter((b): b is LlmTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    // Extract action items from the response
    const actionItems = this.extractActionItems(answerText);
    const sources = this.extractSources(answerText);

    return {
      answer: answerText,
      intent,
      supportingEvidence: [],
      actionItems,
      confidence: 0.85,
      sources,
    };
  }

  /**
   * Build context for the AI based on intent and tenant data.
   */
  private async buildContext(tenantId: string, intent: CopilotIntent): Promise<string> {
    const contextParts: string[] = [];

    // Get recent compliance scores
    const scores = await this.db
      .select()
      .from(complianceScores)
      .where(eq(complianceScores.tenantId, tenantId))
      .orderBy(desc(complianceScores.snapshotAt))
      .limit(20);

    if (scores.length > 0) {
      const latestByFramework = new Map<string, typeof scores[0]>();
      for (const s of scores) {
        if (!latestByFramework.has(s.framework)) {
          latestByFramework.set(s.framework, s);
        }
      }
      const scoreLines = Array.from(latestByFramework.entries())
        .map(([fw, s]) => `  ${fw}: ${s.score}% (${s.passCount} pass, ${s.failCount} fail, ${s.partialCount} partial)`)
        .join("\n");
      contextParts.push(`COMPLIANCE SCORES:\n${scoreLines}`);
    }

    // Get finding counts by severity
    const findingCounts = await this.db
      .select({
        severity: findings.severity,
        cnt: count(),
      })
      .from(findings)
      .where(and(eq(findings.tenantId, tenantId), eq(findings.status, "open")))
      .groupBy(findings.severity);

    if (findingCounts.length > 0) {
      const findingLines = findingCounts
        .map((f) => `  ${f.severity}: ${f.cnt}`)
        .join("\n");
      contextParts.push(`OPEN FINDINGS:\n${findingLines}`);
    }

    // Get recent scan info
    const recentScans = await this.db
      .select()
      .from(scans)
      .where(eq(scans.tenantId, tenantId))
      .orderBy(desc(scans.createdAt))
      .limit(3);

    if (recentScans.length > 0) {
      const scanLines = recentScans
        .map((s) => `  ${s.createdAt.toISOString().slice(0, 10)}: ${s.status} (${s.frameworks.join(", ")})`)
        .join("\n");
      contextParts.push(`RECENT SCANS:\n${scanLines}`);
    }

    // Add drift events for drift queries
    if (intent === "drift_query") {
      const drifts = await this.db
        .select()
        .from(driftEvents)
        .where(eq(driftEvents.tenantId, tenantId))
        .orderBy(desc(driftEvents.detectedAt))
        .limit(10);

      if (drifts.length > 0) {
        const driftLines = drifts
          .map((d) => `  ${d.detectedAt.toISOString().slice(0, 10)}: ${d.changeType} on ${d.resourceType}/${d.resourceId} (${d.severity})`)
          .join("\n");
        contextParts.push(`RECENT DRIFT EVENTS:\n${driftLines}`);
      }
    }

    return contextParts.join("\n\n") || "No data available for this tenant yet.";
  }

  /**
   * Extract action items from AI response text.
   */
  private extractActionItems(text: string): string[] {
    const items: string[] = [];
    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^[\-\*\d]+[\.\)]\s/.test(trimmed) && /should|must|need|recommend|consider|ensure|implement|enable|fix|update|review/i.test(trimmed)) {
        items.push(trimmed.replace(/^[\-\*\d]+[\.\)]\s*/, ""));
      }
    }
    return items.slice(0, 10);
  }

  /**
   * Extract framework/control references from text.
   */
  private extractSources(text: string): string[] {
    const sources: string[] = [];
    const patterns = [
      /SOC\s*2\s+CC[\d\.]+/gi,
      /ISO\s*27001\s+A\.[\d\.]+/gi,
      /ISO\s*42001\s+[\d\.]+/gi,
      /HIPAA\s+§?164\.[\d]+\([a-z]\)/gi,
      /NIST\s+[\w\-]+/gi,
      /PCI[\s\-]DSS\s+Req\.?\s*\d+/gi,
      /GDPR\s+Art\.?\s*\d+/gi,
    ];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) sources.push(...matches);
    }
    return [...new Set(sources)];
  }
}
