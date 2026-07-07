import type { Db } from "../../db/connection.js";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ComplianceDeadline {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  framework: string;
  deadlineDate: Date;
  reminderDays: number[];
  status: "upcoming" | "due" | "overdue" | "completed";
  readinessScore: number;
  createdBy: string;
  createdAt: Date;
}

export interface CalendarEvent {
  id: string;
  type: "deadline" | "audit" | "scan" | "renewal" | "report" | "training";
  title: string;
  date: Date;
  framework?: string;
  status: string;
  urgency: "critical" | "high" | "medium" | "low";
}

/* ------------------------------------------------------------------ */
/*  In-Memory Store (production uses compliance_deadlines table)        */
/* ------------------------------------------------------------------ */

const deadlines: Map<string, ComplianceDeadline> = new Map();
let nextId = 1;

/* ------------------------------------------------------------------ */
/*  Compliance Calendar Service                                        */
/* ------------------------------------------------------------------ */

export class ComplianceCalendarService {
  constructor(private db: Db) {}

  /**
   * Get all calendar events for a tenant within a date range.
   */
  async getCalendar(tenantId: string, dateRange: { from: Date; to: Date }): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];
    const now = new Date();

    // Add deadline events
    for (const d of deadlines.values()) {
      if (d.tenantId !== tenantId) continue;
      if (d.deadlineDate >= dateRange.from && d.deadlineDate <= dateRange.to) {
        const daysUntil = Math.ceil((d.deadlineDate.getTime() - now.getTime()) / 86400000);
        events.push({
          id: d.id,
          type: "deadline",
          title: d.title,
          date: d.deadlineDate,
          framework: d.framework,
          status: d.status,
          urgency: daysUntil <= 3 ? "critical" : daysUntil <= 7 ? "high" : daysUntil <= 30 ? "medium" : "low",
        });

        // Add reminder events
        for (const reminderDay of d.reminderDays) {
          const reminderDate = new Date(d.deadlineDate.getTime() - reminderDay * 86400000);
          if (reminderDate >= dateRange.from && reminderDate <= dateRange.to) {
            events.push({
              id: `${d.id}-reminder-${reminderDay}`,
              type: "deadline",
              title: `Reminder: ${d.title} (${reminderDay} days)`,
              date: reminderDate,
              framework: d.framework,
              status: "upcoming",
              urgency: reminderDay <= 7 ? "high" : "medium",
            });
          }
        }
      }
    }

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Create a compliance deadline with auto-alerting.
   */
  async createDeadline(tenantId: string, input: {
    title: string;
    description: string;
    framework: string;
    deadlineDate: Date;
    reminderDays?: number[];
    createdBy: string;
  }): Promise<ComplianceDeadline> {
    const id = `DL-${nextId++}`;
    const now = new Date();
    const daysUntil = Math.ceil((input.deadlineDate.getTime() - now.getTime()) / 86400000);

    const deadline: ComplianceDeadline = {
      id,
      tenantId,
      title: input.title,
      description: input.description,
      framework: input.framework,
      deadlineDate: input.deadlineDate,
      reminderDays: input.reminderDays ?? [30, 14, 7, 3, 1],
      status: daysUntil < 0 ? "overdue" : daysUntil <= 7 ? "due" : "upcoming",
      readinessScore: 0,
      createdBy: input.createdBy,
      createdAt: now,
    };

    deadlines.set(id, deadline);
    return deadline;
  }

  /**
   * Get readiness status for a specific deadline.
   */
  async getReadinessForDeadline(tenantId: string, deadlineId: string): Promise<{
    deadline: ComplianceDeadline | undefined;
    readinessPercent: number;
    blockers: string[];
    effortRemainingHours: number;
  }> {
    const deadline = deadlines.get(deadlineId);
    if (!deadline || deadline.tenantId !== tenantId) {
      return { deadline: undefined, readinessPercent: 0, blockers: ["Deadline not found"], effortRemainingHours: 0 };
    }

    // In production: calculate from compliance scores + evidence gaps
    return {
      deadline,
      readinessPercent: deadline.readinessScore,
      blockers: deadline.readinessScore < 80 ? ["Outstanding critical findings", "Missing evidence for key controls"] : [],
      effortRemainingHours: Math.max(0, (100 - deadline.readinessScore) * 2),
    };
  }

  /**
   * Update deadline status.
   */
  async updateDeadlineStatus(deadlineId: string, status: ComplianceDeadline["status"]): Promise<void> {
    const deadline = deadlines.get(deadlineId);
    if (deadline) {
      deadline.status = status;
    }
  }

  /**
   * List all deadlines for a tenant.
   */
  async listDeadlines(tenantId: string): Promise<ComplianceDeadline[]> {
    return Array.from(deadlines.values())
      .filter((d) => d.tenantId === tenantId)
      .sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime());
  }
}
