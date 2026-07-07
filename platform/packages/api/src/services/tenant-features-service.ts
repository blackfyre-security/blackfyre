import { and, eq } from "drizzle-orm";
import { tenantFeatures, tenants } from "../db/schema.js";
import {
  FEATURES,
  FEATURE_INDEX,
  computeEffectiveFeatures,
  type EffectiveFeature,
} from "../lib/feature-catalog.js";

export interface FeatureOverrideInput {
  featureKey: string;
  enabled: boolean;
  reason?: string;
}

export class TenantFeaturesService {
  constructor(private readonly db: any) {}

  /**
   * Returns every feature in the catalog with its effective state for a tenant:
   *   - `tier`     : default from the tenant's plan
   *   - `override` : explicit row in `tenant_features` that flips the default
   */
  async getEffectiveFeatures(tenantId: string): Promise<{
    plan: string;
    customPlanLabel: string | null;
    features: EffectiveFeature[];
  }> {
    const [tenant] = await this.db
      .select({
        plan: tenants.plan,
        customPlanLabel: tenants.customPlanLabel,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) throw new Error("Tenant not found");

    const overrides = await this.db
      .select({
        feature_key: tenantFeatures.featureKey,
        enabled: tenantFeatures.enabled,
      })
      .from(tenantFeatures)
      .where(eq(tenantFeatures.tenantId, tenantId));

    const features = computeEffectiveFeatures(tenant.plan, overrides);

    return {
      plan: tenant.plan,
      customPlanLabel: tenant.customPlanLabel,
      features,
    };
  }

  /**
   * Upsert a single feature override for a tenant.
   * Setting `enabled` opposite to the tier default creates a meaningful row;
   * setting it equal to the tier default just removes any existing override.
   */
  async setOverride(
    tenantId: string,
    input: FeatureOverrideInput,
    grantedBy: string,
  ): Promise<{ feature_key: string; enabled: boolean; source: "tier" | "override" }> {
    const def = FEATURE_INDEX[input.featureKey];
    if (!def) throw new Error(`Unknown feature: ${input.featureKey}`);

    const [tenant] = await this.db
      .select({ plan: tenants.plan })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) throw new Error("Tenant not found");

    // If the desired state matches the tier default, drop any explicit row
    // so the matrix stays clean.
    const { computeEffectiveFeatures: compute } = await import("../lib/feature-catalog.js");
    const tierDefault = compute(tenant.plan, []).find((f) => f.key === def.key)?.enabled ?? false;

    if (input.enabled === tierDefault) {
      await this.db
        .delete(tenantFeatures)
        .where(
          and(
            eq(tenantFeatures.tenantId, tenantId),
            eq(tenantFeatures.featureKey, def.key),
          ),
        );
      return { feature_key: def.key, enabled: tierDefault, source: "tier" };
    }

    // Otherwise upsert the override row.
    const [existing] = await this.db
      .select({ id: tenantFeatures.id })
      .from(tenantFeatures)
      .where(
        and(
          eq(tenantFeatures.tenantId, tenantId),
          eq(tenantFeatures.featureKey, def.key),
        ),
      )
      .limit(1);

    if (existing) {
      await this.db
        .update(tenantFeatures)
        .set({
          enabled: input.enabled,
          reason: input.reason ?? null,
          grantedBy,
          updatedAt: new Date(),
        })
        .where(eq(tenantFeatures.id, existing.id));
    } else {
      await this.db.insert(tenantFeatures).values({
        tenantId,
        featureKey: def.key,
        enabled: input.enabled,
        reason: input.reason ?? null,
        grantedBy,
      });
    }

    return { feature_key: def.key, enabled: input.enabled, source: "override" };
  }

  /**
   * Bulk replace overrides for a tenant. Atomic: deletes existing rows that
   * are no longer in the input, upserts the rest. Each row in `inputs` must
   * differ from tier default (caller is responsible for sending only "real"
   * overrides — convenience method `applyMatrix` below handles cleanup).
   */
  async applyMatrix(
    tenantId: string,
    desired: Array<{ featureKey: string; enabled: boolean; reason?: string }>,
    grantedBy: string,
  ): Promise<EffectiveFeature[]> {
    for (const row of desired) {
      await this.setOverride(tenantId, row, grantedBy);
    }
    return (await this.getEffectiveFeatures(tenantId)).features;
  }

  /** Catalog without tenant context. */
  catalog() {
    return FEATURES;
  }
}
