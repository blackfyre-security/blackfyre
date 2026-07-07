import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { tenants } from "../db/schema.js";
import { badRequest, unauthorized, notFound } from "../utils/errors.js";
import type { Plan } from "../services/payment-service.js";
// REAL IMPL (BLACKFYRE 2026-06): pricing single-source-of-truth. The local STRIPE_PLAN_PRICES
// ($499/$999/$1999) disagreed with the canonical USD prices in PLANS ($180/$600/$1440), so the
// inline price_data fallback would have charged the wrong amount. Import the canonical USD-cents
// table from @blackfyre/shared instead.
// REAL IMPL (BLACKFYRE 2026-06): PLAN_PRICE_USD_CENTS is the canonical Stripe charge unit and is
// used to VALIDATE the amount Stripe actually billed. PLAN_PRICE_INR_PAISE is the platform-wide
// unit for the tenants.mrr_cents column (see routes/admin.ts) — so even a USD/Stripe subscription
// persists its MRR in INR paise to keep the admin MRR aggregation coherent across providers.
import { PLAN_PRICE_USD_CENTS, PLAN_PRICE_INR_PAISE } from "@blackfyre/shared";

// SECURITY FIX (BLACKFYRE audit 2026-06-05): open redirect via attacker-supplied checkout
// success/cancel URLs — Stripe redirects the user's browser to these after checkout, so an
// unvalidated value lets an attacker craft a phishing/redirect link off our own checkout flow.
// Allowlist to first-party hosts only; anything else falls back to the canonical billing URL.
// Both .tech (used by the existing defaults / SAML config) and .com (CORS_ORIGINS default) are
// first-party Blackfyre domains, plus localhost for local dev.
const ALLOWED_REDIRECT_HOSTS: readonly string[] = [
  "app.blackfyre.tech",
  "app.blackfyre.com",
  "blackfyre.tech",
  "blackfyre.com",
  "localhost",
  "127.0.0.1",
];

const DEFAULT_SUCCESS_URL = "https://app.blackfyre.tech/billing?success=1";
const DEFAULT_CANCEL_URL = "https://app.blackfyre.tech/billing?cancelled=1";

/**
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): open redirect — resolve a caller-supplied
 * redirect URL only if it is https (or http on localhost) and its host is in the
 * first-party allowlist; otherwise return the safe default. Never trust the raw input.
 */
function safeRedirectUrl(
  raw: string | undefined,
  fallback: string,
  log: FastifyRequest["log"],
): string {
  if (!raw) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    log.warn({ event: "stripe.checkout.redirect_blocked", reason: "unparseable" }, "Stripe checkout redirect URL rejected");
    return fallback;
  }
  const host = parsed.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const schemeOk = parsed.protocol === "https:" || (isLocal && parsed.protocol === "http:");
  if (!schemeOk || !ALLOWED_REDIRECT_HOSTS.includes(host)) {
    log.warn(
      { event: "stripe.checkout.redirect_blocked", host, protocol: parsed.protocol },
      "Stripe checkout redirect URL not in first-party allowlist — using safe default",
    );
    return fallback;
  }
  return parsed.toString();
}

// REAL IMPL (BLACKFYRE 2026-06): canonical USD-cents prices from @blackfyre/shared (derived from
// PLANS.priceMonthlyUSD): comply $180 / protect $600 / defend $1440. Used only for the inline
// price_data fallback when a Stripe price ID is not configured.
const STRIPE_PLAN_PRICES: Record<Plan, number> = PLAN_PRICE_USD_CENTS;

// Map Stripe price IDs (set via env) — fallback to lookup price creation
const STRIPE_PRICE_IDS: Record<Plan, string> = {
  comply:  process.env.STRIPE_PRICE_ID_COMPLY  ?? "",
  protect: process.env.STRIPE_PRICE_ID_PROTECT ?? "",
  defend:  process.env.STRIPE_PRICE_ID_DEFEND  ?? "",
};

// Pin to the apiVersion the installed Stripe SDK ships — its `apiVersion` option is typed as the
// exact `ApiVersion` literal the SDK was built against; using any other string is a tsc error.
function getStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });
}

export const stripePaymentRoutes: FastifyPluginAsync = async (app) => {
  const ownerOrAdmin = (app as any).requireRole("owner", "admin");
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): webhook signature was verified against a
  // RE-SERIALIZED body (JSON.stringify(request.body)) — Stripe signs the EXACT raw bytes, so any
  // key reordering / whitespace difference made constructEvent reject every real event (billing
  // DoS). Capture the raw body for this encapsulated plugin (so it only affects payment routes) and
  // keep it on request.rawBody, while still parsing JSON for the authenticated routes. The parser is
  // scoped to this plugin instance, so it does not change global body handling.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      (req as FastifyRequest & { rawBody?: string }).rawBody =
        typeof body === "string" ? body : body.toString("utf8");
      try {
        const json = body && (body as string).length > 0 ? JSON.parse(body as string) : {};
        done(null, json);
      } catch (err) {
        (err as any).statusCode = 400;
        done(err as Error, undefined);
      }
    },
  );

  function stripe(): Stripe {
    return getStripe(app.config.STRIPE_SECRET_KEY);
  }

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): no replay/idempotency guard on webhooks — a captured
  // (validly signed) event could be replayed to re-trigger plan changes. Dedupe by Stripe event id
  // in Redis (best-effort: the HMAC signature is the authentication control, so when Redis is
  // unavailable we log and proceed rather than fail the webhook and cause a billing DoS).
  async function alreadyProcessed(eventId: string): Promise<boolean> {
    if (!app.redis) {
      app.log.warn(
        { event: "stripe.webhook.dedupe_unavailable", eventId },
        "Redis unavailable — skipping Stripe webhook replay dedupe (signature still enforced)",
      );
      return false;
    }
    // SET NX with a TTL: first writer wins, key expires after the Stripe retry window (~3 days).
    const key = `stripe:webhook:evt:${eventId}`;
    const set = await app.redis.set(key, "1", "EX", 60 * 60 * 24 * 3, "NX");
    return set === null; // null => key already existed => duplicate
  }

  // REAL IMPL (BLACKFYRE 2026-06): pull the billed amount (USD cents) and the current-period-end
  // from a Stripe Subscription. In the pinned API version (2026-05-27.dahlia) current_period_end
  // and the price live on the SUBSCRIPTION ITEM, not the subscription itself, so read items.data[0].
  // unit_amount is preferred (the exact recurring price); fall back to the legacy plan.amount.
  function subscriptionAmountAndPeriod(sub: Stripe.Subscription): {
    amountCents: number | null;
    currentPeriodEnd: Date | null;
  } {
    const item = sub.items?.data?.[0];
    const amountCents =
      item?.price?.unit_amount ??
      item?.plan?.amount ??
      null;
    // current_period_end is unix SECONDS on the subscription item.
    const periodEndSecs = item?.current_period_end ?? null;
    const currentPeriodEnd =
      typeof periodEndSecs === "number" && periodEndSecs > 0
        ? new Date(periodEndSecs * 1000)
        : null;
    return { amountCents, currentPeriodEnd };
  }

  // REAL IMPL (BLACKFYRE 2026-06): persist a successful Stripe subscription. Validates the billed
  // amount against the canonical USD-cents price for the plan BEFORE writing — a mismatch is logged
  // and the provisioning is rejected so an underpaid/tampered subscription can never unlock a plan.
  // On success: plan + subscriptionStatus=active + onboardingStatus=active (regains access after a
  // past_due/suspension) + currentPeriodEnd + mrrCents. mrr_cents is stored in INR paise to match the
  // platform-wide convention (admin MRR aggregation), NOT the USD amount we validated against.
  // Returns true when the tenant was provisioned.
  async function provisionStripeSubscription(args: {
    tenantId: string;
    plan: Plan;
    subscriptionId: string | null;
    amountCents: number | null;
    currentPeriodEnd: Date | null;
    log: FastifyRequest["log"];
    eventId: string;
  }): Promise<boolean> {
    const { tenantId, plan, subscriptionId, amountCents, currentPeriodEnd, log, eventId } = args;
    const expectedCents = PLAN_PRICE_USD_CENTS[plan];

    if (amountCents != null && amountCents !== expectedCents) {
      // Amount mismatch: never log card/secret data — only the integer cent amounts.
      log.warn(
        { event: "stripe.subscription.amount_mismatch", eventId, tenantId, plan, expectedCents, paidCents: amountCents },
        "Stripe subscription amount does not match canonical plan price — rejecting provisioning",
      );
      return false;
    }

    await app.superDb
      .update(tenants)
      .set({
        plan,
        stripeSubscriptionId: subscriptionId ?? null,
        subscriptionStatus: "active",
        // Regain access if the tenant had been suspended for non-payment.
        onboardingStatus: "active",
        // INR-paise canonical MRR (platform-wide unit), not the USD amount.
        mrrCents: PLAN_PRICE_INR_PAISE[plan],
        ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    log.info(
      { event: "stripe.subscription.provisioned", eventId, tenantId, plan, mrrPaise: PLAN_PRICE_INR_PAISE[plan] },
      "Stripe subscription provisioned — plan, status, period and MRR set",
    );
    return true;
  }

  // REAL IMPL (BLACKFYRE 2026-06): dunning. Mark the tenant past_due and suspend access by Stripe
  // customer id. subscription_status records the precise billing state; onboarding_status (the column
  // the plan-gate / requireTenantActive guard enforces, whose enum has no past_due member) is set to
  // suspended to actually block the tenant until they pay. mrrCents is left as-is (churn is only
  // recognised on cancellation). Returns how many tenant rows matched.
  async function markPastDueByCustomer(customerId: string, log: FastifyRequest["log"], eventId: string): Promise<void> {
    const rows = await app.superDb
      .update(tenants)
      .set({
        subscriptionStatus: "past_due",
        onboardingStatus: "suspended",
        updatedAt: new Date(),
      })
      .where(eq(tenants.stripeCustomerId, customerId))
      .returning({ id: tenants.id });
    log.warn(
      { event: "stripe.dunning.past_due", eventId, matched: rows.length },
      "Stripe dunning — tenant(s) marked past_due/suspended",
    );
  }

  // -----------------------------------------------------------------------
  // POST /api/payments/stripe/checkout
  // Creates a Stripe Checkout Session for a plan upgrade.
  // Returns { url } — redirect the browser to this URL.
  // -----------------------------------------------------------------------
  app.post<{ Body: { plan: Plan; successUrl?: string; cancelUrl?: string } }>(
    "/api/payments/stripe/checkout",
    { preHandler: [ownerOrAdmin] },
    async (request) => {
      const { plan, successUrl, cancelUrl } = request.body ?? {};
      if (!plan || !["comply", "protect", "defend"].includes(plan)) {
        throw badRequest("INVALID_PLAN", "plan must be one of: comply, protect, defend");
      }

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): drop `as any` — stripeCustomerId is now a typed
      // column (db/schema.ts), so the build verifies the read/write target instead of silently
      // accepting a non-existent column.
      const [tenant] = await app.superDb
        .select({ id: tenants.id, name: tenants.name, stripeCustomerId: tenants.stripeCustomerId })
        .from(tenants)
        .where(eq(tenants.id, request.tenantId))
        .limit(1);

      if (!tenant) throw notFound("Tenant");

      const s = stripe();

      // Resolve or create the Stripe customer for this tenant
      let customerId: string = tenant.stripeCustomerId ?? "";
      if (!customerId) {
        const customer = await s.customers.create({
          name: tenant.name,
          metadata: { tenantId: request.tenantId },
        });
        customerId = customer.id;
        await app.superDb
          .update(tenants)
          // SECURITY FIX (BLACKFYRE audit 2026-06-05): typed column, no `as any` cast.
          .set({ stripeCustomerId: customerId, updatedAt: new Date() })
          .where(eq(tenants.id, request.tenantId));
      }

      const priceId = STRIPE_PRICE_IDS[plan];
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        mode: "subscription",
        // SECURITY FIX (BLACKFYRE audit 2026-06-05): open redirect — validate caller-supplied URLs
        // against the first-party allowlist before handing them to Stripe.
        success_url: safeRedirectUrl(successUrl, DEFAULT_SUCCESS_URL, request.log),
        cancel_url: safeRedirectUrl(cancelUrl, DEFAULT_CANCEL_URL, request.log),
        metadata: { tenantId: request.tenantId, plan },
        ...(priceId
          ? { line_items: [{ price: priceId, quantity: 1 }] }
          : {
              line_items: [
                {
                  price_data: {
                    currency: "usd",
                    unit_amount: STRIPE_PLAN_PRICES[plan],
                    recurring: { interval: "month" },
                    product_data: { name: `Blackfyre ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan` },
                  },
                  quantity: 1,
                },
              ],
            }),
      };

      const session = await s.checkout.sessions.create(sessionParams);
      return { url: session.url };
    },
  );

  // -----------------------------------------------------------------------
  // POST /api/webhooks/stripe  (unauthenticated — Stripe callback)
  // Verifies webhook signature, handles subscription lifecycle events.
  // -----------------------------------------------------------------------
  app.post(
    "/api/webhooks/stripe",
    async (request, reply) => {
      const sig = request.headers["stripe-signature"] as string | undefined;
      if (!sig) {
        request.log.warn({ event: "stripe.webhook.missing_signature" }, "Stripe webhook rejected — no signature header");
        throw unauthorized("Missing Stripe-Signature header");
      }

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): verify against the RAW request bytes (captured by
      // the plugin-scoped content-type parser), not JSON.stringify(request.body). Re-serializing
      // mutates byte order/whitespace and made every legitimately signed event fail (billing DoS).
      const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody;
      if (rawBody == null) {
        request.log.warn({ event: "stripe.webhook.no_raw_body" }, "Stripe webhook rejected — raw body unavailable");
        throw unauthorized("Stripe webhook raw body unavailable");
      }

      let event: Stripe.Event;
      try {
        event = stripe().webhooks.constructEvent(
          rawBody,
          sig,
          app.config.STRIPE_WEBHOOK_SECRET,
        );
      } catch (err) {
        // SECURITY FIX (BLACKFYRE audit 2026-06-05): log signature rejections at warn (no secrets).
        request.log.warn(
          { event: "stripe.webhook.signature_invalid", reason: (err as Error).message },
          "Stripe webhook signature verification failed",
        );
        throw unauthorized("Stripe webhook signature invalid");
      }

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): replay/idempotency dedupe by event id.
      if (await alreadyProcessed(event.id)) {
        request.log.warn(
          { event: "stripe.webhook.duplicate", eventId: event.id, type: event.type },
          "Stripe webhook event already processed — ignoring replay",
        );
        return reply.status(200).send({ received: true, type: event.type, deduped: true });
      }

      app.log.info({ type: event.type, eventId: event.id }, "Stripe webhook received");

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const tenantId = session.metadata?.tenantId;
          const plan = session.metadata?.plan as Plan | undefined;
          const subscriptionId = session.subscription as string | null;

          if (tenantId && plan && ["comply", "protect", "defend"].includes(plan)) {
            // REAL IMPL (BLACKFYRE 2026-06): retrieve the real subscription so we can read the
            // billed amount + current period end and VALIDATE the amount against the canonical plan
            // price before provisioning. Set plan, subscriptionStatus, currentPeriodEnd AND mrrCents
            // — not just plan/status. If the subscription can't be retrieved we still record the plan
            // (status active) but cannot validate the amount, so we log that gap.
            let amountCents: number | null = null;
            let currentPeriodEnd: Date | null = null;
            if (subscriptionId) {
              try {
                const sub = await stripe().subscriptions.retrieve(subscriptionId);
                ({ amountCents, currentPeriodEnd } = subscriptionAmountAndPeriod(sub));
              } catch (err) {
                request.log.warn(
                  { event: "stripe.subscription.retrieve_failed", eventId: event.id, reason: (err as Error).message },
                  "Could not retrieve Stripe subscription to validate amount — provisioning plan without amount check",
                );
              }
            }
            await provisionStripeSubscription({
              tenantId,
              plan,
              subscriptionId,
              amountCents,
              currentPeriodEnd,
              log: request.log,
              eventId: event.id,
            });
          }
          break;
        }

        case "customer.subscription.updated": {
          // REAL IMPL (BLACKFYRE 2026-06): keep plan/status/period/mrr in sync on subscription
          // changes and drive dunning. past_due/unpaid → suspend; active/trialing → (re)provision.
          const sub = event.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;
          const status = sub.status;

          if (status === "past_due" || status === "unpaid") {
            await markPastDueByCustomer(customerId, request.log, event.id);
            break;
          }

          if (status === "active" || status === "trialing") {
            // Resolve the tenant + plan from the subscription's customer. metadata.plan is set at
            // checkout; fall back to the tenant's current plan if absent.
            const [tenant] = await app.superDb
              .select({ id: tenants.id, plan: tenants.plan })
              .from(tenants)
              .where(eq(tenants.stripeCustomerId, customerId))
              .limit(1);
            if (tenant) {
              const metaPlan = sub.metadata?.plan as Plan | undefined;
              const plan: Plan =
                metaPlan && ["comply", "protect", "defend"].includes(metaPlan)
                  ? metaPlan
                  : (tenant.plan as Plan);
              const { amountCents, currentPeriodEnd } = subscriptionAmountAndPeriod(sub);
              await provisionStripeSubscription({
                tenantId: tenant.id,
                plan,
                subscriptionId: sub.id,
                amountCents,
                currentPeriodEnd,
                log: request.log,
                eventId: event.id,
              });
            } else {
              request.log.warn(
                { event: "stripe.subscription.updated.no_tenant", eventId: event.id, customerId },
                "Stripe subscription.updated for unknown customer — no tenant updated",
              );
            }
          }
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          // Ensure subscription stays active — no plan downgrade needed
          app.log.info({ customerId }, "Stripe invoice.paid — subscription renewed");
          break;
        }

        case "invoice.payment_failed": {
          // REAL IMPL (BLACKFYRE 2026-06): dunning. A failed invoice payment marks the tenant
          // past_due and suspends access until they pay (resolved by customer id).
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string | null;
          if (customerId) {
            await markPastDueByCustomer(customerId, request.log, event.id);
          } else {
            request.log.warn(
              { event: "stripe.invoice.payment_failed.no_customer", eventId: event.id },
              "Stripe invoice.payment_failed without customer id — no tenant marked",
            );
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          // SECURITY FIX (BLACKFYRE audit 2026-06-05): match on the typed stripeCustomerId column
          // (no `as any`). Previously this filter compiled against an untyped cast, so a typo would
          // have silently matched nothing and cancellations would never downgrade the tenant.
          await app.superDb
            .update(tenants)
            .set({
              plan: "comply",
              stripeSubscriptionId: null,
              subscriptionStatus: "canceled",
              updatedAt: new Date(),
            })
            .where(eq(tenants.stripeCustomerId, customerId));
          app.log.info({ customerId }, "Stripe subscription deleted — tenant downgraded to comply");
          break;
        }

        default:
          app.log.debug({ type: event.type }, "Unhandled Stripe webhook event");
      }

      return reply.status(200).send({ received: true, type: event.type });
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/payments/stripe/portal
  // Creates a Stripe Billing Portal session for the current tenant.
  // -----------------------------------------------------------------------
  app.get(
    "/api/payments/stripe/portal",
    { preHandler: [authenticated] },
    async (request) => {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): typed stripeCustomerId column, no `as any`.
      const [tenant] = await app.superDb
        .select({ stripeCustomerId: tenants.stripeCustomerId })
        .from(tenants)
        .where(eq(tenants.id, request.tenantId))
        .limit(1);

      if (!tenant) throw notFound("Tenant");

      const customerId: string = tenant.stripeCustomerId ?? "";
      if (!customerId) {
        throw badRequest("NO_STRIPE_CUSTOMER", "No Stripe billing account found for this tenant. Complete a checkout first.");
      }

      const session = await stripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: "https://app.blackfyre.tech/billing",
      });

      return { url: session.url };
    },
  );
};
