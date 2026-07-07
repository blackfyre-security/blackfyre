import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import {
  FEATURES,
  FEATURE_INDEX,
  PLAN_TIER_FROM_DB,
  planTierFor,
  isFeatureEnabled,
  type PlanTier,
} from "../lib/feature-catalog.js";

export type { PlanTier };
export { FEATURES, FEATURE_INDEX, PLAN_TIER_FROM_DB as PLAN_TIERS };

// Legacy export — kept for any external import. Derived from the canonical
// catalog so it cannot drift.
export const FEATURE_TIER_MAP: Record<string, PlanTier> = Object.fromEntries(
  FEATURES.filter((f) => f.tier !== "Comply").map((f) => [f.key, f.tier]),
);

const TIER_RANK: Record<PlanTier, number> = {
  Comply: 1,
  Protect: 2,
  Defend: 3,
};

declare module "fastify" {
  interface FastifyInstance {
    requirePlan(tier: PlanTier): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireFeature(featureKey: string): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireTenantActive(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
  interface FastifyRequest {
    tenantPlan: string;
  }
}

async function loadTenantOverrides(
  app: any,
  tenantId: string,
): Promise<Array<{ feature_key: string; enabled: boolean }>> {
  const { tenantFeatures } = await import("../db/schema.js");
  const rows = await app.db
    .select({ feature_key: tenantFeatures.featureKey, enabled: tenantFeatures.enabled })
    .from(tenantFeatures)
    .where(eq(tenantFeatures.tenantId, tenantId));
  return rows;
}

const planGatePlugin: FastifyPluginAsync = async (app) => {
  app.decorate("requirePlan", (requiredTier: PlanTier) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantPlan = (request as any).tenantPlan ?? "hourly";
      const currentTier = PLAN_TIER_FROM_DB[tenantPlan] ?? "Comply";

      if (TIER_RANK[currentTier] < TIER_RANK[requiredTier]) {
        return reply.status(403).send({
          error: {
            code: "PLAN_UPGRADE_REQUIRED",
            message: `This feature requires the ${requiredTier} plan. Your plan: ${tenantPlan}.`,
            requiredPlan: requiredTier,
            currentPlan: tenantPlan,
            upgradeUrl: "https://blackfyre.tech/pricing",
          },
        });
      }
    };
  });

  app.decorate("requireFeature", (featureKey: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const def = FEATURE_INDEX[featureKey];
      if (!def) {
        return reply.status(500).send({
          error: { code: "UNKNOWN_FEATURE", message: `Unknown feature: ${featureKey}` },
        });
      }

      const tenantPlan = (request as any).tenantPlan ?? "hourly";
      const tenantId = request.tenantId as string | undefined;

      const overrides = tenantId ? await loadTenantOverrides(app, tenantId) : [];
      const enabled = isFeatureEnabled(featureKey, tenantPlan, overrides);

      if (!enabled) {
        return reply.status(403).send({
          error: {
            code: "FEATURE_DISABLED",
            message: `Feature "${def.name}" is not enabled for your plan.`,
            feature: def.key,
            requiredTier: def.tier,
            currentPlan: tenantPlan,
            upgradeUrl: "https://blackfyre.tech/pricing",
          },
        });
      }
    };
  });

  app.decorate("requireTenantActive", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.tenantId) return; // unauthenticated routes skip

    const { tenants } = await import("../db/schema.js");
    const [tenant] = await app.db
      .select({ status: tenants.onboardingStatus })
      .from(tenants)
      .where(eq(tenants.id, request.tenantId))
      .limit(1);

    if (!tenant || tenant.status === "suspended") {
      reply.status(403).send({
        error: {
          code: "TENANT_SUSPENDED",
          message: "Your account is suspended. Please contact support or update your payment method.",
        },
      });
    }
  });
};

// Keep the existing "auth" dependency (the tenant-context name from the
// marathon branch refers to a plugin that wasn't ported here). Re-export
// the feature-catalog helpers so non-route call sites can resolve effective
// features without a Fastify request handle.
export default fp(planGatePlugin, { name: "plan-gate", dependencies: ["auth"] });

export { computeEffectiveFeatures, isFeatureEnabled, planTierFor } from "../lib/feature-catalog.js";
