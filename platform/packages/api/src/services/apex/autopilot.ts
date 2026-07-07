import type { Db } from "../../db/connection.js";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AutopilotConfig {
  scanFrequency: "daily" | "weekly" | "biweekly" | "monthly";
  autoRemediate: boolean;
  autoRemediateMaxSeverity: "low" | "medium";
  humanApprovalRequiredFor: ("critical" | "high")[];
  notificationChannels: ("email" | "slack" | "webhook")[];
  reportSchedule: "weekly" | "monthly";
  evidenceCollection: "continuous" | "weekly";
  driftResponse: "alert" | "auto-scan" | "auto-remediate";
  budgetLimitMonthly: number;
}

export interface AutopilotStatus {
  tenantId: string;
  framework: string;
  enabled: boolean;
  configuration: AutopilotConfig;
  lastScanAt?: Date;
  nextScanAt?: Date;
  autoFixesCount: number;
  pendingApprovalsCount: number;
  monthlyAiCost: number;
  agentStatuses: Record<string, "active" | "idle" | "error">;
}

export interface AutopilotAction {
  id: string;
  autopilotId: string;
  tenantId: string;
  actionType: "scan" | "collect_evidence" | "remediate" | "report" | "alert" | "drift_response";
  agentName: "scout" | "shield" | "helix" | "pulse" | "cortex" | "ledger" | "signal";
  details: Record<string, unknown>;
  status: "pending" | "approved" | "running" | "completed" | "failed";
  costTokens: number;
  executedAt?: Date;
  createdAt: Date;
}

export interface EffectivenessMetrics {
  tenantId: string;
  manualHoursSaved: number;
  autoFixesApplied: number;
  complianceScoreMaintained: number;
  evidenceAutoCollected: number;
  driftEventsHandled: number;
  incidentsAutoTriaged: number;
  monthlyROI: number;
}

/* ------------------------------------------------------------------ */
/*  In-Memory Store                                                    */
/* ------------------------------------------------------------------ */

const autopilotConfigs: Map<string, { framework: string; config: AutopilotConfig; enabled: boolean }> = new Map();
const autopilotActions: AutopilotAction[] = [];
let actionId = 1;

/* ------------------------------------------------------------------ */
/*  Autopilot Service                                                  */
/* ------------------------------------------------------------------ */

export class AutopilotService {
  constructor(private db: Db) {}

  /**
   * Enable compliance autopilot for a framework.
   */
  async enableAutopilot(tenantId: string, framework: string, config: AutopilotConfig): Promise<AutopilotStatus> {
    const key = `${tenantId}:${framework}`;
    autopilotConfigs.set(key, { framework, config, enabled: true });

    // Schedule initial scan
    const nextScanAt = this.calculateNextScan(config.scanFrequency);

    // Log the enable action
    this.logAction(tenantId, "scan", "scout", { type: "initial_scan_scheduled", nextScanAt }, "pending");

    return {
      tenantId,
      framework,
      enabled: true,
      configuration: config,
      nextScanAt,
      autoFixesCount: 0,
      pendingApprovalsCount: 0,
      monthlyAiCost: 0,
      agentStatuses: {
        scout: "active", shield: "active", helix: "idle",
        pulse: "active", cortex: "active", ledger: "active", signal: "active",
      },
    };
  }

  /**
   * Disable autopilot for a framework.
   */
  async disableAutopilot(tenantId: string, framework: string): Promise<void> {
    const key = `${tenantId}:${framework}`;
    const existing = autopilotConfigs.get(key);
    if (existing) {
      existing.enabled = false;
    }
  }

  /**
   * Get autopilot status for a tenant.
   */
  async getAutopilotStatus(tenantId: string): Promise<AutopilotStatus[]> {
    const statuses: AutopilotStatus[] = [];

    for (const [key, value] of autopilotConfigs.entries()) {
      if (key.startsWith(`${tenantId}:`)) {
        const tenantActions = autopilotActions.filter((a) => a.tenantId === tenantId);
        statuses.push({
          tenantId,
          framework: value.framework,
          enabled: value.enabled,
          configuration: value.config,
          nextScanAt: this.calculateNextScan(value.config.scanFrequency),
          autoFixesCount: tenantActions.filter((a) => a.actionType === "remediate" && a.status === "completed").length,
          pendingApprovalsCount: tenantActions.filter((a) => a.status === "pending").length,
          monthlyAiCost: tenantActions.reduce((sum, a) => sum + a.costTokens * 0.000003, 0),
          agentStatuses: {
            scout: "active", shield: "active", helix: "idle",
            pulse: "active", cortex: "active", ledger: "active", signal: "active",
          },
        });
      }
    }

    return statuses;
  }

  /**
   * Get recent autopilot actions for a tenant.
   */
  async getAutopilotActions(tenantId: string, filter?: {
    agentName?: string;
    actionType?: string;
    status?: string;
    limit?: number;
  }): Promise<AutopilotAction[]> {
    let results = autopilotActions.filter((a) => a.tenantId === tenantId);
    if (filter?.agentName) results = results.filter((a) => a.agentName === filter.agentName);
    if (filter?.actionType) results = results.filter((a) => a.actionType === filter.actionType);
    if (filter?.status) results = results.filter((a) => a.status === filter.status);
    return results.slice(0, filter?.limit ?? 50);
  }

  /**
   * Approve a pending action (for HELIX remediation requiring human approval).
   */
  async approveAction(actionId: string, tenantId: string, approvedBy: string): Promise<AutopilotAction | undefined> {
    const action = autopilotActions.find((a) => a.id === actionId && a.tenantId === tenantId);
    if (action && action.status === "pending") {
      action.status = "approved";
      action.details = { ...action.details, approvedBy, approvedAt: new Date().toISOString() };
    }
    return action;
  }

  /**
   * Get effectiveness metrics — ROI of autopilot.
   */
  async getEffectiveness(tenantId: string): Promise<EffectivenessMetrics> {
    const actions = autopilotActions.filter((a) => a.tenantId === tenantId && a.status === "completed");

    return {
      tenantId,
      manualHoursSaved: actions.length * 2.5, // ~2.5 hours saved per automated action
      autoFixesApplied: actions.filter((a) => a.actionType === "remediate").length,
      complianceScoreMaintained: 85, // placeholder
      evidenceAutoCollected: actions.filter((a) => a.actionType === "collect_evidence").length,
      driftEventsHandled: actions.filter((a) => a.actionType === "drift_response").length,
      incidentsAutoTriaged: actions.filter((a) => a.agentName === "signal").length,
      monthlyROI: actions.length * 2.5 * 75, // hours * avg hourly rate
    };
  }

  /**
   * Get AI cost tracking for a tenant.
   */
  async getCostTracking(tenantId: string): Promise<{
    totalTokens: number;
    totalCost: number;
    costByAgent: Record<string, number>;
    budgetUsedPercent: number;
  }> {
    const actions = autopilotActions.filter((a) => a.tenantId === tenantId);
    const totalTokens = actions.reduce((sum, a) => sum + a.costTokens, 0);
    const totalCost = totalTokens * 0.000003; // approximate cost per token

    const costByAgent: Record<string, number> = {};
    for (const a of actions) {
      costByAgent[a.agentName] = (costByAgent[a.agentName] ?? 0) + a.costTokens * 0.000003;
    }

    // Find budget from any active config
    let budget = 100;
    for (const [key, value] of autopilotConfigs.entries()) {
      if (key.startsWith(`${tenantId}:`) && value.enabled) {
        budget = value.config.budgetLimitMonthly;
        break;
      }
    }

    return {
      totalTokens,
      totalCost,
      costByAgent,
      budgetUsedPercent: (totalCost / budget) * 100,
    };
  }

  private logAction(
    tenantId: string,
    actionType: AutopilotAction["actionType"],
    agentName: AutopilotAction["agentName"],
    details: Record<string, unknown>,
    status: AutopilotAction["status"],
  ): void {
    autopilotActions.push({
      id: `APT-${actionId++}`,
      autopilotId: `${tenantId}-autopilot`,
      tenantId,
      actionType,
      agentName,
      details,
      status,
      costTokens: 0,
      createdAt: new Date(),
    });
  }

  private calculateNextScan(frequency: AutopilotConfig["scanFrequency"]): Date {
    const now = new Date();
    const ms: Record<string, number> = {
      daily: 86400000, weekly: 604800000, biweekly: 1209600000, monthly: 2592000000,
    };
    return new Date(now.getTime() + (ms[frequency] ?? ms.weekly));
  }
}
