import { eq, count } from "drizzle-orm";
import { tenants, users, cloudAccounts } from "../db/schema.js";
import { hashPassword } from "../utils/password.js";
import { nanoid } from "nanoid";
import { ApiError } from "../utils/errors.js";
import type { Db } from "../db/connection.js";
import type { FastifyBaseLogger } from "fastify";

export type Plan = "comply" | "protect" | "defend";

// REAL IMPL (BLACKFYRE 2026-06): the URL we surface to the client so the UI can
// deep-link a blocked tenant straight to the upgrade flow. Stays in one place so
// the route handlers don't each hardcode it.
const UPGRADE_URL = "/billing/upgrade";

// REAL IMPL (BLACKFYRE 2026-06): -1 in PLAN_FEATURES means "unlimited". Centralise
// the sentinel check so the assert helpers below read clearly.
function isUnlimited(limit: number): boolean {
  return limit < 0;
}

// Feature limits per plan.
// REAL IMPL (BLACKFYRE 2026-06): removed the per-plan `priceInr` fields — they were dead code
// (only feature flags are read here, via isFeatureAllowed) AND had drifted from the canonical
// PLANS table in @blackfyre/shared (they held 49,999/99,999/1,99,999 paise * 100). Pricing has a
// single source of truth (PLAN_PRICE_INR / PLAN_PRICE_INR_PAISE in @blackfyre/shared); keeping a
// stale copy here only invited the next wrong-charge bug.
export const PLAN_FEATURES = {
  comply: {
    label: "Comply",
    maxCloudAccounts: 1,
    frameworks: ["soc2", "iso27001"],
    maxTeamMembers: 3,
    maxEvidenceGb: 1,
    aiAnalysis: "basic",
    remediation: ["manual"],
    monitoring: false,
    sso: false,
    apiAccess: false,
    reports: ["readiness"],
  },
  protect: {
    label: "Protect",
    maxCloudAccounts: 3,
    frameworks: ["soc2", "iso27001", "hipaa", "pcidss", "dpdpa"],
    maxTeamMembers: 10,
    maxEvidenceGb: 10,
    aiAnalysis: "full",
    remediation: ["manual", "approval"],
    monitoring: true,
    sso: false,
    apiAccess: true,
    reports: ["readiness", "evidence_package", "gap_analysis"],
  },
  defend: {
    label: "Defend",
    maxCloudAccounts: -1, // unlimited
    frameworks: ["soc2", "iso27001", "hipaa", "pcidss", "dpdpa", "gdpr", "nist80053", "iso42001", "pdppl"],
    maxTeamMembers: -1,
    maxEvidenceGb: -1,
    aiAnalysis: "full",
    remediation: ["manual", "approval", "auto"],
    monitoring: true,
    sso: true,
    apiAccess: true,
    reports: ["readiness", "evidence_package", "gap_analysis", "board_summary"],
  },
} as const;

export class ProvisioningService {
  constructor(private db: Db, private superDb: Db) {}

  /** Provision a new tenant after payment confirmation */
  async provisionTenant(data: {
    companyName: string;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
    plan: Plan;
  }) {
    const slug = data.companyName
      .toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      + "-" + nanoid(6);

    // Create tenant with "active" status (payment already confirmed)
    const [tenant] = await this.superDb
      .insert(tenants)
      .values({
        name: data.companyName,
        slug,
        plan: data.plan,
        onboardingStatus: "active",
      })
      .returning();

    // Create owner user
    const [user] = await this.superDb
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: data.ownerEmail,
        name: data.ownerName,
        passwordHash: await hashPassword(data.ownerPassword),
        role: "owner",
      })
      .returning();

    return { tenant, user };
  }

  /** Admin-provisioned client (no payment required — admin handles billing) */
  async adminProvisionClient(data: {
    companyName: string;
    ownerEmail: string;
    ownerName: string;
    plan: Plan;
    industry?: string;
  }) {
    const slug = data.companyName
      .toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      + "-" + nanoid(6);

    const [tenant] = await this.superDb
      .insert(tenants)
      .values({
        name: data.companyName,
        slug,
        plan: data.plan,
        industryProfile: (data.industry as any) ?? "custom",
        onboardingStatus: "active",
      })
      .returning();

    // Create user with temporary password — they'll reset via email
    const tempPassword = nanoid(16);
    const [user] = await this.superDb
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: data.ownerEmail,
        name: data.ownerName,
        passwordHash: await hashPassword(tempPassword),
        role: "owner",
      })
      .returning();

    return { tenant, user, tempPassword };
  }

  /** Upgrade/downgrade a tenant's plan */
  async changePlan(tenantId: string, newPlan: Plan) {
    const [updated] = await this.superDb
      .update(tenants)
      .set({ plan: newPlan, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated;
  }

  /** Suspend a tenant (e.g., payment lapsed) */
  async suspendTenant(tenantId: string) {
    await this.superDb
      .update(tenants)
      .set({ onboardingStatus: "suspended", updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));
  }

  /** Reactivate a suspended tenant */
  async reactivateTenant(tenantId: string) {
    await this.superDb
      .update(tenants)
      .set({ onboardingStatus: "active", updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));
  }

  /** Get plan features for a tenant */
  getPlanFeatures(plan: Plan) {
    return PLAN_FEATURES[plan] ?? PLAN_FEATURES.comply;
  }

  /** Check if a feature is allowed for a plan */
  isFeatureAllowed(plan: Plan, feature: string): boolean {
    const features = this.getPlanFeatures(plan);
    switch (feature) {
      case "monitoring": return features.monitoring;
      case "sso": return features.sso;
      case "api_access": return features.apiAccess;
      case "auto_remediation": return (features.remediation as readonly string[]).includes("auto");
      case "approval_remediation": return (features.remediation as readonly string[]).includes("approval");
      default: return true;
    }
  }

  // REAL IMPL (BLACKFYRE 2026-06): plan limits were DEFINED in PLAN_FEATURES but
  // never ENFORCED — a Comply tenant (maxCloudAccounts:1) could link unlimited
  // clouds, and any tenant could exceed maxTeamMembers. These assert helpers
  // count the tenant's existing rows and throw a 403 PLAN_LIMIT_REACHED before
  // the create runs, so the limit is real. The limit comes straight from
  // PLAN_FEATURES (single source of truth) — nothing is hardcoded per-route.
  //
  // The counts run on `this.db`. Callers pass their RLS-bound request.db (so the
  // count is naturally tenant-scoped); the explicit tenantId predicate is kept as
  // defense-in-depth in case a caller ever passes a privileged handle.

  /**
   * Throw a 403 PLAN_LIMIT_REACHED if adding one more cloud account would exceed
   * the tenant's plan limit (maxCloudAccounts). Unlimited plans (-1) are skipped.
   * @param tenantId  tenant whose existing cloud accounts are counted
   * @param plan      the tenant's plan (drives the limit via PLAN_FEATURES)
   * @param log       optional pino logger; blocked attempts are logged at warn
   */
  async assertCanAddCloudAccount(
    tenantId: string,
    plan: Plan,
    log?: FastifyBaseLogger,
  ): Promise<void> {
    const limit = this.getPlanFeatures(plan).maxCloudAccounts;
    if (isUnlimited(limit)) return;

    const [{ value: existing }] = await this.db
      .select({ value: count() })
      .from(cloudAccounts)
      .where(eq(cloudAccounts.tenantId, tenantId));

    if (existing >= limit) {
      log?.warn(
        {
          event: "plan.limit.blocked",
          resource: "cloud_account",
          tenantId,
          plan,
          limit,
          current: existing,
        },
        "Blocked cloud-account creation: plan limit reached",
      );
      throw new ApiError(
        403,
        "PLAN_LIMIT_REACHED",
        `Your ${this.getPlanFeatures(plan).label} plan allows ${limit} cloud account${limit === 1 ? "" : "s"}. Upgrade to add more.`,
        { resource: "cloud_account", plan, limit, current: existing, upgradeUrl: UPGRADE_URL },
      );
    }
  }

  /**
   * Throw a 403 PLAN_LIMIT_REACHED if adding one more team member would exceed
   * the tenant's plan limit (maxTeamMembers). Unlimited plans (-1) are skipped.
   * @param tenantId  tenant whose existing users are counted
   * @param plan      the tenant's plan (drives the limit via PLAN_FEATURES)
   * @param log       optional pino logger; blocked attempts are logged at warn
   */
  async assertCanAddTeamMember(
    tenantId: string,
    plan: Plan,
    log?: FastifyBaseLogger,
  ): Promise<void> {
    const limit = this.getPlanFeatures(plan).maxTeamMembers;
    if (isUnlimited(limit)) return;

    const [{ value: existing }] = await this.db
      .select({ value: count() })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    if (existing >= limit) {
      log?.warn(
        {
          event: "plan.limit.blocked",
          resource: "team_member",
          tenantId,
          plan,
          limit,
          current: existing,
        },
        "Blocked team-member creation: plan limit reached",
      );
      throw new ApiError(
        403,
        "PLAN_LIMIT_REACHED",
        `Your ${this.getPlanFeatures(plan).label} plan allows ${limit} team member${Number(limit) === 1 ? "" : "s"}. Upgrade to add more.`,
        { resource: "team_member", plan, limit, current: existing, upgradeUrl: UPGRADE_URL },
      );
    }
  }
}

// REAL IMPL (BLACKFYRE 2026-06): the route handlers (cloud-accounts.ts, team.ts)
// already hold an RLS-bound request.db and the resolved tenant plan, but don't
// construct a ProvisioningService. This tiny factory lets a route enforce a plan
// limit with its own request-scoped handle in one line:
//   await planLimiter(request.db).assertCanAddCloudAccount(tenantId, plan, log)
// keeping the count tenant-scoped under RLS. The DB handle is used only for the
// read-only COUNT here.
export function planLimiter(db: Db): ProvisioningService {
  return new ProvisioningService(db, db);
}

// REAL IMPL (BLACKFYRE 2026-06): the tenants table stores the plan as a string
// enum; normalise it to the Plan union (defaulting to the most restrictive plan,
// "comply", on anything unexpected) so limit enforcement always fails closed.
export function normalizePlan(plan: string | null | undefined): Plan {
  return plan === "protect" || plan === "defend" ? plan : "comply";
}
