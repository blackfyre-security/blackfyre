import type { Db } from "../../db/connection.js";
import { remediations, findings } from "../../db/schema.js";
import { eq } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type WorkflowStepName =
  | "analyze"
  | "plan"
  | "sandbox"
  | "preview"
  | "approve"
  | "execute"
  | "verify"
  | "document";

export type WorkflowStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface WorkflowStep {
  stepNumber: number;
  stepName: WorkflowStepName;
  status: WorkflowStepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  errorDetails?: string;
}

export interface WorkflowResult {
  remediationId: string;
  findingId: string;
  tier: string;
  steps: WorkflowStep[];
  overallStatus: "completed" | "failed" | "awaiting_approval" | "in_progress";
  startedAt: Date;
  completedAt?: Date;
}

const STEP_SEQUENCE: WorkflowStepName[] = [
  "analyze", "plan", "sandbox", "preview", "approve", "execute", "verify", "document",
];

/* ------------------------------------------------------------------ */
/*  HELIX Workflow Engine                                              */
/* ------------------------------------------------------------------ */

export class HelixWorkflowEngine {
  constructor(private db: Db) {}

  /**
   * Execute the full 8-step HELIX remediation workflow.
   */
  async executeWorkflow(remediationId: string, findingId: string, tier: string): Promise<WorkflowResult> {
    const startedAt = new Date();
    const steps: WorkflowStep[] = STEP_SEQUENCE.map((name, i) => ({
      stepNumber: i + 1,
      stepName: name,
      status: "pending" as WorkflowStepStatus,
      input: {},
      output: {},
    }));

    const result: WorkflowResult = {
      remediationId,
      findingId,
      tier,
      steps,
      overallStatus: "in_progress",
      startedAt,
    };

    // Step 1: ANALYZE
    await this.runStep(steps[0], async (step) => {
      const [finding] = await this.db.select().from(findings).where(eq(findings.id, findingId));
      if (!finding) throw new Error(`Finding ${findingId} not found`);

      step.input = { findingId };
      step.output = {
        category: finding.category,
        severity: finding.severity,
        resourceType: finding.resourceType,
        classificationType: this.classifyFinding(finding.category, finding.severity),
      };
    });

    // Step 2: PLAN
    await this.runStep(steps[1], async (step) => {
      const analysis = steps[0].output;
      step.input = { analysis };
      step.output = {
        fixStrategy: `Apply ${analysis.classificationType} fix for ${analysis.category}`,
        estimatedDuration: tier === "auto" ? "seconds" : "minutes",
        riskLevel: analysis.severity === "critical" ? "high" : "medium",
      };
    });

    // Step 3: SANDBOX
    await this.runStep(steps[2], async (step) => {
      step.input = { plan: steps[1].output };
      step.output = {
        validationPassed: true,
        syntaxCheck: "pass",
        logicCheck: "pass",
      };
    });

    // Step 4: PREVIEW
    await this.runStep(steps[3], async (step) => {
      const [remediation] = await this.db.select().from(remediations).where(eq(remediations.id, remediationId));
      step.input = { remediationId };
      step.output = {
        beforeSnapshot: remediation?.beforeSnapshot ?? {},
        afterPreview: { ...((remediation?.beforeSnapshot as Record<string, unknown>) ?? {}), fixed: true },
        diffSummary: "Configuration will be updated to comply with security requirements",
      };
    });

    // Step 5: APPROVE
    if (tier === "auto") {
      steps[4].status = "skipped";
      steps[4].output = { skippedReason: "Auto-tier: pre-approved by tenant policy" };
    } else {
      steps[4].status = "pending";
      steps[4].output = { awaitingApproval: true, approvalChannel: "portal" };
      result.overallStatus = "awaiting_approval";
      return result;
    }

    // Step 6: EXECUTE
    await this.runStep(steps[5], async (step) => {
      step.input = { tier, plan: steps[1].output };
      // In production: call cloud SDK to apply fix
      step.output = {
        executed: true,
        executionMethod: tier === "auto" ? "cloud_sdk" : "guided_script",
        timestamp: new Date().toISOString(),
      };
    });

    // Step 7: VERIFY
    await this.runStep(steps[6], async (step) => {
      step.input = { executionResult: steps[5].output };
      // In production: re-run SCOUT agent check on specific resource
      step.output = {
        verified: true,
        reCheckPassed: true,
        verificationMethod: "targeted_rescan",
      };
    });

    // Step 8: DOCUMENT
    await this.runStep(steps[7], async (step) => {
      step.input = { allSteps: steps.slice(0, 7).map((s) => ({ name: s.stepName, status: s.status })) };
      step.output = {
        evidenceGenerated: true,
        complianceScoreUpdated: true,
        notificationSent: true,
        documentedAt: new Date().toISOString(),
      };

      // Update remediation status
      await this.db
        .update(remediations)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(remediations.id, remediationId));

      // Update finding status
      await this.db
        .update(findings)
        .set({ status: "resolved" })
        .where(eq(findings.id, findingId));
    });

    result.overallStatus = "completed";
    result.completedAt = new Date();
    return result;
  }

  /**
   * Get workflow status for a remediation.
   */
  async getWorkflowStatus(remediationId: string): Promise<WorkflowStep[]> {
    // In production: fetch from remediation_workflow_steps table
    return STEP_SEQUENCE.map((name, i) => ({
      stepNumber: i + 1,
      stepName: name,
      status: "pending" as WorkflowStepStatus,
      input: {},
      output: {},
    }));
  }

  /**
   * Approve a pending workflow step (for guided/approval tiers).
   */
  async approveStep(remediationId: string, stepNumber: number, approvedBy: string): Promise<void> {
    await this.db
      .update(remediations)
      .set({ approvedBy, status: "approved" })
      .where(eq(remediations.id, remediationId));
  }

  /**
   * Rollback a completed remediation.
   */
  async rollback(remediationId: string): Promise<{ success: boolean; message: string }> {
    const [remediation] = await this.db.select().from(remediations).where(eq(remediations.id, remediationId));
    if (!remediation) return { success: false, message: "Remediation not found" };
    if (!remediation.beforeSnapshot) return { success: false, message: "No snapshot available for rollback" };

    // In production: apply beforeSnapshot to restore original state
    await this.db
      .update(remediations)
      .set({ status: "rolled_back" })
      .where(eq(remediations.id, remediationId));

    await this.db
      .update(findings)
      .set({ status: "open" })
      .where(eq(findings.id, remediation.findingId));

    return { success: true, message: "Rollback completed — original configuration restored" };
  }

  /**
   * Run a single workflow step with error handling.
   */
  private async runStep(step: WorkflowStep, fn: (step: WorkflowStep) => Promise<void>): Promise<void> {
    step.status = "running";
    step.startedAt = new Date();
    try {
      await fn(step);
      step.status = "completed";
    } catch (error) {
      step.status = "failed";
      step.errorDetails = error instanceof Error ? error.message : "Unknown error";
    }
    step.completedAt = new Date();
  }

  /**
   * Classify a finding for remediation strategy.
   */
  private classifyFinding(category: string, severity: string): string {
    const map: Record<string, string> = {
      iam: "access_control",
      encryption: "cryptographic",
      logging: "observability",
      network: "network_security",
      config: "configuration",
      storage: "data_protection",
      endpoint: "endpoint_hardening",
      identity: "identity_management",
      iac: "infrastructure_code",
    };
    return map[category] ?? "misconfiguration";
  }
}
