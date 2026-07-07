import crypto from "crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../db/connection.js";
import { tenants } from "../db/schema.js";
import { badRequest, notFound } from "../utils/errors.js";
// REAL IMPL (BLACKFYRE 2026-06): pricing single-source-of-truth. PLAN_PRICE_INR_PAISE is the
// canonical Razorpay charge unit (INR paise) derived from PLANS; reuse it for both the order amount
// AND the tenants.mrr_cents column so MRR never drifts. The platform-wide convention for
// tenants.mrr_cents is INR paise (see routes/admin.ts planPriceInrPaise aggregation), so every
// provisioning path — Razorpay here and Stripe in routes/payments-stripe.ts — must persist the SAME
// INR-paise figure regardless of the currency the customer was actually charged in.
import { PLANS, toPaise, PLAN_PRICE_INR_PAISE } from "@blackfyre/shared";

export type Plan = "comply" | "protect" | "defend";

// Sourced from shared/pricing canonical values.
export const PLAN_PRICES: Record<Plan, number> = {
  comply: toPaise(PLANS.comply.priceMonthlyINR),   // ₹14,999 in paise
  protect: toPaise(PLANS.protect.priceMonthlyINR), // ₹49,999 in paise
  defend: toPaise(PLANS.defend.priceMonthlyINR),   // ₹1,19,999 in paise
};

export const PLAN_LABELS: Record<Plan, string> = {
  comply: `${PLANS.comply.name} — Basic Compliance`,
  protect: `${PLANS.protect.name} — Multi-Cloud + Remediation`,
  defend: `${PLANS.defend.name} — Enterprise + AI + On-Prem`,
};

interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
}

// REAL IMPL (BLACKFYRE 2026-06): minimal, typed view of the Razorpay webhook envelope so the
// capture handler can read the amount + the tenantId/plan notes we stamped on the order. Only the
// fields we actually consume are modelled; everything else is ignored.
export interface RazorpayWebhookEntity {
  id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  order_id?: string;
  notes?: { tenantId?: string; plan?: string } & Record<string, string>;
}

interface RazorpayWebhookPayload {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayWebhookEntity };
    subscription?: { entity?: RazorpayWebhookEntity };
  };
}

export class PaymentService {
  constructor(
    private readonly db: Db,
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
  ) {}

  private get authHeader(): string {
    return "Basic " + Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
  }

  async createOrder(tenantId: string, plan: Plan): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    key: string;
  }> {
    const amount = PLAN_PRICES[plan];
    if (!amount) {
      throw badRequest("INVALID_PLAN", `Unknown plan: ${plan}`);
    }

    const receipt = `${plan}_${tenantId.slice(0, 8)}_${Date.now()}`;

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt,
        notes: {
          tenantId,
          plan,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (body as any)?.error?.description || `Razorpay error ${res.status}`;
      throw badRequest("PAYMENT_ORDER_FAILED", msg);
    }

    const order = await res.json() as RazorpayOrderResponse;

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: this.keyId,
    };
  }

  verifyPayment(orderId: string, paymentId: string, signature: string): boolean {
    const body = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac("sha256", this.keySecret)
      .update(body)
      .digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  // REAL IMPL (BLACKFYRE 2026-06): the Razorpay webhook envelope. `payload.payment.entity.notes`
  // carries the tenantId/plan we stamped onto the order in createOrder(); Razorpay copies an order's
  // notes onto every payment for that order, so capture provisioning is driven from real, signed
  // payment data rather than a hardcoded plan.
  // NOTE: never log the full entity — it can contain PII/contact fields; callers extract only the
  // fields they need.
  // The optional `entity` return field is ADDITIVE — existing callers that read { event, valid }
  // keep compiling.
  handleWebhook(
    body: string,
    signature: string,
  ): {
    event: string;
    valid: boolean;
    entity?: RazorpayWebhookEntity;
  } {
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(body)
      .digest("hex");

    const valid = (() => {
      try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
      } catch {
        return false;
      }
    })();

    if (!valid) {
      return { event: "unknown", valid: false };
    }

    const payload = JSON.parse(body) as RazorpayWebhookPayload;
    const entity =
      payload.payload?.payment?.entity ??
      payload.payload?.subscription?.entity ??
      undefined;
    return { event: payload.event ?? "unknown", valid: true, entity };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): the canonical Razorpay charge amount (INR paise) for a plan,
   * used to validate the amount on a captured payment before provisioning. Sourced from PLANS via
   * PLAN_PRICE_INR_PAISE — never hardcoded.
   */
  expectedAmountPaise(plan: Plan): number {
    return PLAN_PRICE_INR_PAISE[plan];
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): persist a successful subscription/payment. Sets plan, the billing
   * subscriptionStatus, mrrCents (canonical INR-paise figure — the platform-wide unit for
   * tenants.mrr_cents), and currentPeriodEnd when the provider gives one. `onboardingStatus` is
   * forced back to "active" so a previously past_due/suspended tenant regains access on a successful
   * renewal. Returns the persisted plan. `currentPeriodEnd` is optional/defaulted so the public
   * signature stays stable for callers that don't have a period.
   */
  async applySubscription(
    tenantId: string,
    plan: Plan,
    currentPeriodEnd: Date | null = null,
  ): Promise<{ plan: string }> {
    if (!PLAN_PRICE_INR_PAISE[plan]) {
      throw badRequest("INVALID_PLAN", `Unknown plan: ${plan}`);
    }

    const [updated] = await this.db
      .update(tenants)
      .set({
        plan,
        subscriptionStatus: "active",
        onboardingStatus: "active",
        mrrCents: PLAN_PRICE_INR_PAISE[plan],
        // Only overwrite the period end when the provider gave us one; conditional spread keeps the
        // object literally typed for Drizzle's .set().
        ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning({ plan: tenants.plan });

    if (!updated) {
      throw notFound("Tenant");
    }
    return { plan: updated.plan };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): dunning. On a failed/past-due payment, mark the billing status
   * past_due and suspend access. tenants.subscription_status records the precise billing state
   * (past_due); onboardingStatus is the enforcement column the plan-gate / requireTenantActive guard
   * already checks, and its enum has no past_due member, so we set it to "suspended" to actually
   * block the tenant until they pay. mrrCents is left untouched so churn is recognised only on an
   * explicit cancellation. Returns whether a tenant row matched.
   */
  async markPastDue(tenantId: string): Promise<boolean> {
    const [updated] = await this.db
      .update(tenants)
      .set({
        subscriptionStatus: "past_due",
        onboardingStatus: "suspended",
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning({ id: tenants.id });
    return Boolean(updated);
  }

  async getSubscription(tenantId: string): Promise<{
    plan: string;
    status: string;
    nextBillingDate: string | null;
  }> {
    const [tenant] = await this.db
      .select({
        plan: tenants.plan,
        onboardingStatus: tenants.onboardingStatus,
        // REAL IMPL (BLACKFYRE 2026-06): read the real billing columns so the subscription view
        // reflects the actual subscription state set by the Stripe/Razorpay webhooks.
        subscriptionStatus: tenants.subscriptionStatus,
        currentPeriodEnd: tenants.currentPeriodEnd,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      throw notFound("Tenant");
    }

    // REAL IMPL (BLACKFYRE 2026-06): status prefers the precise billing state
    // (subscription_status: active | past_due | canceled | ...) and falls back to the access state
    // when no subscription has been recorded yet. A suspended tenant always reads "suspended".
    const status =
      tenant.onboardingStatus === "suspended"
        ? "suspended"
        : tenant.subscriptionStatus ?? "active";

    // REAL IMPL (BLACKFYRE 2026-06): the REAL next billing date is the persisted current period end
    // from the subscription columns, not a hardcoded null.
    const nextBillingDate = tenant.currentPeriodEnd
      ? tenant.currentPeriodEnd.toISOString()
      : null;

    return {
      plan: tenant.plan,
      status,
      nextBillingDate,
    };
  }

  async upgradePlan(tenantId: string, newPlan: Plan): Promise<{ plan: string }> {
    if (!PLAN_PRICES[newPlan]) {
      throw badRequest("INVALID_PLAN", `Unknown plan: ${newPlan}`);
    }

    const [updated] = await this.db
      .update(tenants)
      .set({ plan: newPlan, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning({ plan: tenants.plan });

    if (!updated) {
      throw notFound("Tenant");
    }

    return { plan: updated.plan };
  }
}
