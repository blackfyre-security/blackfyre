import { eq, and, desc, count, sql } from "drizzle-orm";
import { findings, controlMappings } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { createHash } from "node:crypto";
import { notFound } from "../utils/errors.js";
import {
  calculateFindingPriority,
  clampFactor,
  EXPLOITABILITY_DEFAULT,
  COMPLIANCE_IMPACT_DEFAULT,
} from "../compliance/scoring.js";

// REAL IMPL (BLACKFYRE 2026-06): finding priority formula (GAP-003). Severity
// enum -> ordinal, used ONLY as a deterministic tiebreaker when two findings
// have an equal effective priority_score, preserving the previous severity-DESC
// ordering for ties.
const SEVERITY_ORDER: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

// REAL IMPL (BLACKFYRE 2026-06): finding priority formula (GAP-003).
// Resource types whose exposure makes a finding materially more reachable /
// weaponizable. Internet- or network-facing surfaces raise exploitability above
// the severity-implied baseline; matched case-insensitively as a substring of
// the finding's resourceType (e.g. "AWS::EC2::SecurityGroup", "LoadBalancer",
// "PublicBucket"). Kept conservative and explicit — no hidden magic numbers.
const EXPOSURE_RESOURCE_HINTS = [
  "securitygroup",
  "loadbalancer",
  "elb",
  "internetgateway",
  "publicip",
  "elasticip",
  "apigateway",
  "cloudfront",
  "route53",
  "dns",
  "ingress",
  "nodeport",
  "endpoint",
  "vpc",
  "subnet",
  "network",
  "firewall",
];

// Categories that, by nature, sit on the network/identity attack surface and so
// nudge exploitability up regardless of resource naming.
const EXPOSURE_CATEGORIES = new Set(["network", "identity", "iam", "endpoint"]);

export class FindingService {
  constructor(private db: Db) {}

  /**
   * Store a finding from an agent scan, including its control mappings.
   * Handles deduplication: if a finding with the same dedup_hash exists
   * for this tenant, updates rather than inserts.
   */
  async createFromAgent(
    scanId: string,
    tenantId: string,
    agentFinding: AgentFindingPayload,
  ) {
    const dedupHash = this.generateDedupHash(
      tenantId,
      agentFinding.category,
      agentFinding.resourceType ?? null,
      agentFinding.resourceId ?? null,
      agentFinding.title,
    );

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): concurrent-agent duplicate findings —
    // the previous flow did a SELECT for an existing (tenant_id, dedup_hash) row OUTSIDE the
    // write transaction and against a NON-UNIQUE index. Two agents (or two scans) running in
    // parallel both saw "no existing row" and both INSERTed, producing duplicate findings that
    // inflate risk counts and double-map controls. Foundation added the UNIQUE index
    // `findings_tenant_dedup_unique(tenant_id, dedup_hash)`; we now do a single idempotent upsert
    // (INSERT ... ON CONFLICT (tenant_id, dedup_hash) DO UPDATE) inside the transaction, so the
    // database — not an app-level read — arbitrates the race. The losing writer updates the
    // surviving row instead of creating a duplicate. RLS still applies: dedup is scoped per tenant.
    const findingId = await this.db.transaction(async (tx) => {
      const [upserted] = await tx
        .insert(findings)
        .values({
          scanId,
          tenantId,
          title: agentFinding.title,
          description: agentFinding.description,
          severity: agentFinding.severity as any,
          category: agentFinding.category as any,
          resourceType: agentFinding.resourceType ?? null,
          resourceId: agentFinding.resourceId ?? null,
          resourceRegion: agentFinding.resourceRegion ?? null,
          remediationTier: agentFinding.remediationTier as any,
          autoFixAvailable: agentFinding.autoFixAvailable,
          dedupHash,
        })
        .onConflictDoUpdate({
          target: [findings.tenantId, findings.dedupHash],
          set: {
            // Refresh the surviving row from the latest scan that re-detected it.
            scanId,
            description: agentFinding.description,
            severity: agentFinding.severity as any,
            remediationTier: agentFinding.remediationTier as any,
            autoFixAvailable: agentFinding.autoFixAvailable,
          },
        })
        .returning({ id: findings.id });

      const id = upserted.id;

      // Insert control mappings (always from latest scan)
      if (agentFinding.controlMappings && agentFinding.controlMappings.length > 0) {
        await tx
          .delete(controlMappings)
          .where(eq(controlMappings.findingId, id));

        await tx.insert(controlMappings).values(
          agentFinding.controlMappings.map((cm) => ({
            findingId: id,
            framework: cm.framework as any,
            controlId: cm.controlId,
            controlName: cm.controlName,
            status: cm.status as any,
            weight: cm.weight,
          }))
        );
      }

      // REAL IMPL (BLACKFYRE 2026-06): finding priority formula (GAP-003).
      // Derive the two factors the spec needs (priority = severity x
      // exploitability x compliance_impact) and persist them + the computed
      // priority via PARAMETERIZED raw SQL. The new columns live in migration
      // 042 (NOT in db/schema.ts), so they are written with sql`UPDATE ... SET`
      // bound params rather than via the drizzle model. This runs inside the
      // same upsert transaction so the row's factors are always consistent with
      // the control mappings just written, and FORCE RLS on `findings` still
      // applies (the UPDATE is tenant-scoped by id, which is itself tenant-keyed).
      const exploitability = this.deriveExploitability(agentFinding);
      const complianceImpact = this.deriveComplianceImpact(agentFinding);
      const priorityScore = calculateFindingPriority({
        severity: agentFinding.severity,
        exploitability,
        complianceImpact,
      });

      await tx.execute(
        sql`
          UPDATE findings
          SET exploitability = ${exploitability},
              compliance_impact = ${complianceImpact},
              priority_score = ${priorityScore}
          WHERE id = ${id}
        `,
      );

      return id;
    });

    return findingId;
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): derive exploitability (1..5) from the
   * severity-implied baseline plus resource-exposure signals available on the
   * finding. Severity sets the floor (critical/high are inherently more
   * exploitable); internet/network-facing resource types, network/identity
   * categories, and auto-fixable surface area each add a small, bounded bump.
   * Returns an integer clamped to 1..5. Deterministic — no randomness, no
   * external lookups — so the value is reproducible from the finding alone.
   */
  private deriveExploitability(f: AgentFindingPayload): number {
    const severityBaseline: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
      info: 1,
    };
    let score = severityBaseline[f.severity] ?? 1;

    const resourceType = (f.resourceType ?? "").toLowerCase();
    if (resourceType && EXPOSURE_RESOURCE_HINTS.some((h) => resourceType.includes(h))) {
      score += 1;
    }

    if (EXPOSURE_CATEGORIES.has(f.category)) {
      score += 1;
    }

    // An auto-fixable misconfiguration is, by construction, a concrete reachable
    // surface (we know exactly what to change), which correlates with real
    // exploitability — a small nudge, capped by the clamp below.
    if (f.autoFixAvailable) {
      score += 1;
    }

    return clampFactor(score);
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): derive compliance_impact (1..5) from how many
   * controls/frameworks the finding maps to and their control weights. A finding
   * that breaks many high-weight controls across multiple frameworks carries far
   * more regulatory impact than one mapping to a single low-weight control.
   *
   * Signal = number of distinct frameworks (regulatory breadth) + a contribution
   * from total mapped control weight (depth). A finding with NO control mappings
   * has minimal direct compliance impact (returns the floor of 1). Deterministic
   * and clamped to 1..5.
   */
  private deriveComplianceImpact(f: AgentFindingPayload): number {
    const mappings = f.controlMappings ?? [];
    if (mappings.length === 0) {
      return 1;
    }

    const frameworks = new Set(mappings.map((cm) => cm.framework));
    const totalWeight = mappings.reduce((sum, cm) => sum + (cm.weight ?? 1), 0);

    // Breadth: each additional distinct framework matters; start at 1 for the
    // single-framework case. Depth: every ~3 weight-units of mapped controls
    // adds a point. Combined then clamped to the 1..5 scale.
    const breadth = frameworks.size; // >= 1 here
    const depth = Math.floor(totalWeight / 3);

    return clampFactor(breadth + depth);
  }

  async list(tenantId: string, filters: {
    severity?: string;
    status?: string;
    category?: string;
    scanId?: string;
    limit: number;
    offset: number;
  }) {
    const conditions = [eq(findings.tenantId, tenantId)];
    if (filters.severity) conditions.push(eq(findings.severity, filters.severity as any));
    if (filters.status) conditions.push(eq(findings.status, filters.status as any));
    if (filters.category) conditions.push(eq(findings.category, filters.category as any));
    if (filters.scanId) conditions.push(eq(findings.scanId, filters.scanId));

    // REAL IMPL (BLACKFYRE 2026-06): finding priority formula (GAP-003). RANK the
    // PAGE by effective priority directly in SQL so pagination is priority-ordered
    // ACROSS pages (not just re-sorted within a page). priority_score lives in
    // migration 042 (not db/schema.ts), so the ORDER BY is a parameterized sql``
    // fragment: prefer the persisted priority_score, else fall back to a derived
    // score = severityWeight x EXPLOITABILITY_DEFAULT x COMPLIANCE_IMPACT_DEFAULT
    // (the same neutral defaults calculateFindingPriority() uses) so legacy NULL
    // rows still slot in sensibly with no backfill. Severity enum is the stable
    // tiebreaker, preserving the previous deterministic ordering for ties. The
    // SELECT is unchanged (drizzle model), so existing response fields are intact.
    // priority_score is a migration-042 column NOT present in the drizzle model,
    // so it is referenced via sql.identifier (a safely-quoted identifier, not
    // string interpolation). The numeric defaults are bound params.
    const priorityOrder = sql`
      COALESCE(${sql.identifier("priority_score")}, (
        CASE ${findings.severity}
          WHEN 'critical' THEN 5
          WHEN 'high'     THEN 4
          WHEN 'medium'   THEN 3
          WHEN 'low'      THEN 2
          ELSE 1
        END
      ) * ${EXPLOITABILITY_DEFAULT} * ${COMPLIANCE_IMPACT_DEFAULT}) DESC`;

    const baseRows = await this.db
      .select()
      .from(findings)
      .where(and(...conditions))
      .orderBy(priorityOrder, desc(findings.severity))
      .limit(filters.limit)
      .offset(filters.offset);

    // Attach the persisted factors (exploitability / compliance_impact /
    // priority_score) from migration 042's columns via a tenant-scoped
    // parameterized read. attachPriority preserves the SQL order for equal-
    // priority rows and fills priorityScore for legacy NULL rows the same way.
    const rows = await this.attachPriority(baseRows, tenantId);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(findings)
      .where(and(...conditions));

    return { findings: rows, total };
  }

  async getById(id: string) {
    const [finding] = await this.db
      .select()
      .from(findings)
      .where(eq(findings.id, id))
      .limit(1);

    if (!finding) throw notFound("Finding");

    const mappings = await this.db
      .select()
      .from(controlMappings)
      .where(eq(controlMappings.findingId, id));

    // REAL IMPL (BLACKFYRE 2026-06): finding priority formula (GAP-003). Surface
    // the persisted exploitability / compliance_impact / priority_score (migration
    // 042 columns, read via parameterized SQL) on the detail response. A legacy
    // row with NULL factors gets an effective priority derived on the fly so the
    // field is always populated and consistent with calculateFindingPriority().
    const [priority] = await this.attachPriority([finding], finding.tenantId);

    return {
      ...finding,
      exploitability: priority.exploitability,
      complianceImpact: priority.complianceImpact,
      priorityScore: priority.priorityScore,
      controlMappings: mappings,
    };
  }

  async updateStatus(id: string, status: string) {
    const [updated] = await this.db
      .update(findings)
      .set({ status: status as any })
      .where(eq(findings.id, id))
      .returning();

    if (!updated) throw notFound("Finding");
    return updated;
  }

  async getCountByScanId(scanId: string): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(findings)
      .where(eq(findings.scanId, scanId));

    return total;
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): finding priority formula (GAP-003). Read the
   * persisted priority factors (migration 042 columns: exploitability,
   * compliance_impact, priority_score) for the given base rows and attach an
   * effective priority to each, then re-rank by it.
   *
   * - The 042 columns are NOT in db/schema.ts, so they are fetched with a single
   *   PARAMETERIZED tenant-scoped raw query (id = ANY($ids)), not via the model.
   * - For a row whose priority_score is NULL (created before 042 / never
   *   derived), the effective priority is computed via calculateFindingPriority()
   *   using neutral defaults for the missing factors, so legacy rows still rank
   *   sensibly without a backfill and the API field is never null.
   * - Returned rows are a SUPERSET of the input rows (all original fields kept;
   *   exploitability / complianceImpact / priorityScore added), so the public
   *   response shape stays stable. Ordered by effective priority DESC with the
   *   severity enum as a deterministic tiebreaker.
   */
  private async attachPriority<T extends { id: string; severity: string }>(
    rows: T[],
    tenantId: string,
  ): Promise<Array<T & {
    exploitability: number | null;
    complianceImpact: number | null;
    priorityScore: number;
  }>> {
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    // Parameterized: ids bound as a uuid[] and ANY()-matched; tenant_id bound so
    // the read is tenant-scoped even on a pool that does not set RLS context.
    const factorRows = (await this.db.execute(
      sql`
        SELECT id, exploitability, compliance_impact, priority_score
        FROM findings
        WHERE tenant_id = ${tenantId}
          AND id = ANY(${ids}::uuid[])
      `,
    )) as unknown as Array<{
      id: string;
      exploitability: number | string | null;
      compliance_impact: number | string | null;
      priority_score: number | string | null;
    }>;

    const byId = new Map(factorRows.map((f) => [f.id, f]));

    const enriched = rows.map((row) => {
      const f = byId.get(row.id);
      const exploitability =
        f?.exploitability != null ? Number(f.exploitability) : null;
      const complianceImpact =
        f?.compliance_impact != null ? Number(f.compliance_impact) : null;

      // Prefer the persisted score; otherwise derive on the fly so legacy/NULL
      // rows still rank and the field is always populated.
      const priorityScore =
        f?.priority_score != null
          ? Number(f.priority_score)
          : calculateFindingPriority({
              severity: row.severity,
              exploitability,
              complianceImpact,
            });

      return { ...row, exploitability, complianceImpact, priorityScore };
    });

    // Re-rank by effective priority; severity enum order as a stable tiebreaker.
    enriched.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    });

    return enriched;
  }

  private generateDedupHash(
    tenantId: string,
    category: string,
    resourceType: string | null,
    resourceId: string | null,
    title: string,
  ): string {
    const input = [tenantId, category, resourceType ?? "", resourceId ?? "", title].join("|");
    return createHash("sha256").update(input).digest("hex").slice(0, 64);
  }
}
