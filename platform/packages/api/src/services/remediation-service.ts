import { eq, and, count, sql } from "drizzle-orm";
import { remediations, findings } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { notFound, badRequest, forbidden } from "../utils/errors.js";

/**
 * Tenant scoping: the `remediations` table has no `tenant_id` column. All
 * tenant scoping is done through the `findings` join (remediations.finding_id
 * → findings.id → findings.tenant_id). Every public method takes `tenantId`
 * and uses it to verify the remediation's parent finding belongs to that
 * tenant before reading or writing.
 */
export class RemediationService {
  constructor(private db: Db) {}

  /** Verify a finding exists and belongs to this tenant. Returns its id. */
  private async assertFindingInTenant(findingId: string, tenantId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: findings.id })
      .from(findings)
      .where(and(eq(findings.id, findingId), eq(findings.tenantId, tenantId)))
      .limit(1);
    if (!row) throw forbidden("Finding does not belong to this tenant");
  }

  async create(
    tenantId: string,
    data: { findingId: string; tier: string; playbookContent?: string },
  ) {
    await this.assertFindingInTenant(data.findingId, tenantId);

    const [created] = await this.db
      .insert(remediations)
      .values({
        findingId: data.findingId,
        tier: data.tier as any,
        status: "pending",
        playbookContent: data.playbookContent ?? null,
      })
      .returning();

    return created;
  }

  async approve(id: string, tenantId: string, approvedBy: string) {
    const existing = await this.getById(id, tenantId);
    if (existing.status !== "pending") {
      throw badRequest("INVALID_STATE", `Cannot approve remediation in '${existing.status}' state`);
    }

    const [updated] = await this.db
      .update(remediations)
      .set({ status: "approved", approvedBy })
      .where(eq(remediations.id, id))
      .returning();

    return updated;
  }

  async execute(id: string, tenantId: string) {
    const existing = await this.getById(id, tenantId);

    // Auto-tier remediations can skip approval (pending -> executing).
    // Approval-tier and manual-tier MUST be approved first.
    if (existing.status === "pending" && existing.tier !== "auto") {
      throw badRequest("INVALID_STATE", `Cannot execute '${existing.tier}'-tier remediation without approval`);
    }
    if (existing.status !== "approved" && existing.status !== "pending") {
      throw badRequest("INVALID_STATE", `Cannot execute remediation in '${existing.status}' state`);
    }

    const [updated] = await this.db
      .update(remediations)
      .set({ status: "executing", executedAt: new Date() })
      .where(eq(remediations.id, id))
      .returning();

    return updated;
  }

  async complete(id: string, tenantId: string, afterSnapshot: Record<string, unknown>) {
    const existing = await this.getById(id, tenantId);
    if (existing.status !== "executing") {
      throw badRequest("INVALID_STATE", `Cannot complete remediation in '${existing.status}' state`);
    }

    const [updated] = await this.db
      .update(remediations)
      .set({
        status: "completed",
        afterSnapshot,
        completedAt: new Date(),
      })
      .where(eq(remediations.id, id))
      .returning();

    return updated;
  }

  async fail(id: string, tenantId: string, errorDetails: string) {
    const existing = await this.getById(id, tenantId);
    if (existing.status !== "executing") {
      throw badRequest("INVALID_STATE", `Cannot fail remediation in '${existing.status}' state`);
    }

    const [updated] = await this.db
      .update(remediations)
      .set({ status: "failed", afterSnapshot: { error: errorDetails } })
      .where(eq(remediations.id, id))
      .returning();

    return updated;
  }

  async rollback(id: string, tenantId: string) {
    const existing = await this.getById(id, tenantId);
    if (existing.status !== "completed" && existing.status !== "failed") {
      throw badRequest("INVALID_STATE", `Cannot rollback remediation in '${existing.status}' state`);
    }

    const [updated] = await this.db
      .update(remediations)
      .set({ status: "rolled_back" })
      .where(eq(remediations.id, id))
      .returning();

    return updated;
  }

  async getById(id: string, tenantId: string) {
    // Join findings to enforce tenant scoping (remediations has no tenant_id).
    const [row] = await this.db
      .select({ remediation: remediations })
      .from(remediations)
      .innerJoin(findings, eq(remediations.findingId, findings.id))
      .where(and(
        eq(remediations.id, id),
        eq(findings.tenantId, tenantId),
      ))
      .limit(1);

    if (!row) throw notFound("Remediation");
    return row.remediation;
  }

  async listForFinding(
    tenantId: string,
    filters: { findingId?: string; status?: string; tier?: string; limit: number; offset: number },
  ) {
    const conditions = [eq(findings.tenantId, tenantId)];
    if (filters.findingId) conditions.push(eq(remediations.findingId, filters.findingId));
    if (filters.status) conditions.push(eq(remediations.status, filters.status as any));
    if (filters.tier) conditions.push(eq(remediations.tier, filters.tier as any));

    const where = and(...conditions);

    const [rows, totalRows] = await Promise.all([
      this.db
        .select({ remediation: remediations })
        .from(remediations)
        .innerJoin(findings, eq(remediations.findingId, findings.id))
        .where(where)
        .limit(filters.limit)
        .offset(filters.offset),
      this.db
        .select({ count: count() })
        .from(remediations)
        .innerJoin(findings, eq(remediations.findingId, findings.id))
        .where(where),
    ]);

    return {
      rows: rows.map((r) => r.remediation),
      total: totalRows[0]?.count ?? 0,
    };
  }
}
