import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { PaymentService, type Plan } from "../services/payment-service.js";
import { badRequest, unauthorized } from "../utils/errors.js";

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const ownerOrAdmin = (app as any).requireRole("owner", "admin");

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): the Razorpay webhook HMAC was computed over a
  // RE-SERIALIZED body (JSON.stringify(request.body)) — Razorpay signs the EXACT raw bytes, so any
  // re-serialization difference made every real event fail verification (billing DoS). Capture the
  // raw body for this encapsulated plugin and keep it on request.rawBody while still parsing JSON for
  // the authenticated routes. Scoped to this plugin instance — global body handling is unchanged.
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

  function getService(): PaymentService {
    return new PaymentService(
      app.superDb,
      app.config.RAZORPAY_KEY_ID,
      app.config.RAZORPAY_KEY_SECRET,
      app.config.RAZORPAY_WEBHOOK_SECRET,
    );
  }

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): replay/idempotency dedupe for the Razorpay webhook.
  // A captured (validly signed) event could otherwise be replayed to re-trigger billing side effects.
  // Best-effort: the HMAC signature is the authentication control, so when Redis is unavailable we
  // log and proceed rather than fail the webhook (which would be a billing DoS).
  async function alreadyProcessed(eventId: string): Promise<boolean> {
    if (!app.redis) {
      app.log.warn(
        { event: "razorpay.webhook.dedupe_unavailable", eventId },
        "Redis unavailable — skipping Razorpay webhook replay dedupe (signature still enforced)",
      );
      return false;
    }
    const key = `razorpay:webhook:evt:${eventId}`;
    const set = await app.redis.set(key, "1", "EX", 60 * 60 * 24 * 3, "NX");
    return set === null; // null => key already existed => duplicate
  }

  // POST /api/payments/create-order
  app.post<{ Body: { plan: string } }>(
    "/api/payments/create-order",
    { preHandler: [ownerOrAdmin] },
    async (request) => {
      const { plan } = request.body ?? {};
      if (!plan || !["comply", "protect", "defend"].includes(plan)) {
        throw badRequest("INVALID_PLAN", "plan must be one of: comply, protect, defend");
      }

      const service = getService();
      const order = await service.createOrder(request.tenantId, plan as Plan);
      return order;
    },
  );

  // POST /api/payments/verify
  app.post<{ Body: { orderId: string; paymentId: string; signature: string; plan: string } }>(
    "/api/payments/verify",
    { preHandler: [ownerOrAdmin] },
    async (request) => {
      const { orderId, paymentId, signature, plan } = request.body ?? {};
      if (!orderId || !paymentId || !signature) {
        throw badRequest("MISSING_FIELDS", "orderId, paymentId, and signature are required");
      }

      const service = getService();
      const valid = service.verifyPayment(orderId, paymentId, signature);
      if (!valid) {
        throw badRequest("INVALID_SIGNATURE", "Payment signature verification failed");
      }

      if (!plan || !["comply", "protect", "defend"].includes(plan)) {
        throw badRequest("MISSING_PLAN", "plan is required alongside payment verification");
      }

      const result = await service.upgradePlan(request.tenantId, plan as Plan);
      return { success: true, plan: result.plan };
    },
  );

  // POST /api/payments/webhook — unauthenticated (Razorpay callback)
  app.post(
    "/api/payments/webhook",
    async (request, reply) => {
      const signature = request.headers["x-razorpay-signature"] as string | undefined;
      if (!signature) {
        request.log.warn({ event: "razorpay.webhook.missing_signature" }, "Razorpay webhook rejected — no signature header");
        throw unauthorized("Missing webhook signature");
      }

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): verify the HMAC over the RAW request bytes
      // captured by the plugin-scoped content-type parser, not JSON.stringify(request.body).
      const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody;
      if (rawBody == null) {
        request.log.warn({ event: "razorpay.webhook.no_raw_body" }, "Razorpay webhook rejected — raw body unavailable");
        throw unauthorized("Razorpay webhook raw body unavailable");
      }

      const service = getService();
      const { event, valid, entity } = service.handleWebhook(rawBody, signature);

      if (!valid) {
        // SECURITY FIX (BLACKFYRE audit 2026-06-05): log signature rejections at warn (no secrets).
        request.log.warn(
          { event: "razorpay.webhook.signature_invalid" },
          "Razorpay webhook signature verification failed",
        );
        throw unauthorized("Invalid webhook signature");
      }

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): replay/idempotency dedupe by Razorpay event id
      // (x-razorpay-event-id header, present on delivered webhooks). Fall back to a hash-free key so
      // dedupe is skipped (not failed) if the header is absent on an older payload format.
      const eventId = request.headers["x-razorpay-event-id"] as string | undefined;
      if (eventId && (await alreadyProcessed(eventId))) {
        request.log.warn(
          { event: "razorpay.webhook.duplicate", eventId, razorpayEvent: event },
          "Razorpay webhook event already processed — ignoring replay",
        );
        return reply.status(200).send({ received: true, event, deduped: true });
      }

      // REAL IMPL (BLACKFYRE 2026-06): provision on a real, signed Razorpay capture. The tenantId +
      // plan come from the order notes we stamped in createOrder() (Razorpay copies order notes onto
      // the payment), and we VALIDATE the captured amount against the canonical INR-paise price for
      // that plan before touching the tenant — a mismatch is logged and rejected so a tampered/cheap
      // payment can never unlock a higher plan. On success we set plan + subscriptionStatus + mrrCents
      // via PaymentService.applySubscription. Never log the full entity (it can carry contact PII).
      // Scoped to payment.captured: that entity always carries the real charged `amount` we validate
      // against; the subscription.* lifecycle entities do not carry a per-charge amount.
      if (event === "payment.captured") {
        const tenantId = entity?.notes?.tenantId;
        const plan = entity?.notes?.plan as Plan | undefined;
        const amount = entity?.amount;

        if (!tenantId || !plan || !["comply", "protect", "defend"].includes(plan)) {
          app.log.warn(
            { event, hasTenantId: Boolean(tenantId), plan: plan ?? null },
            "Razorpay capture missing tenantId/plan notes — cannot provision",
          );
          return reply.status(200).send({ received: true, event, provisioned: false });
        }

        const expected = service.expectedAmountPaise(plan);
        if (typeof amount !== "number" || amount !== expected) {
          // Amount mismatch: log + reject provisioning (do NOT change the tenant's plan).
          app.log.warn(
            { event, tenantId, plan, expectedPaise: expected, paidPaise: amount ?? null },
            "Razorpay capture amount does not match canonical plan price — rejecting provisioning",
          );
          return reply.status(200).send({ received: true, event, provisioned: false, reason: "amount_mismatch" });
        }

        await service.applySubscription(tenantId, plan);
        app.log.info(
          { event, tenantId, plan, mrrPaise: expected },
          "Razorpay capture provisioned — plan, status and MRR set",
        );
        return reply.status(200).send({ received: true, event, provisioned: true });
      }

      // REAL IMPL (BLACKFYRE 2026-06): dunning. A failed payment or a subscription falling into
      // halted/pending marks the tenant past_due and suspends access until they pay (applied via
      // PaymentService.markPastDue → subscription_status=past_due + onboarding_status=suspended,
      // which the plan-gate / requireTenantActive guard enforces).
      if (
        event === "payment.failed" ||
        event === "subscription.halted" ||
        event === "subscription.pending"
      ) {
        const tenantId = entity?.notes?.tenantId;
        if (tenantId) {
          const matched = await service.markPastDue(tenantId);
          app.log.warn(
            { event, tenantId, matched },
            "Razorpay dunning — tenant marked past_due/suspended",
          );
        } else {
          app.log.warn({ event }, "Razorpay dunning event without tenantId note — no tenant marked");
        }
        return reply.status(200).send({ received: true, event, dunning: true });
      }

      if (event === "subscription.activated") {
        app.log.info({ event }, "Razorpay webhook received");
      }

      return reply.status(200).send({ received: true, event });
    },
  );

  // GET /api/payments/subscription
  app.get(
    "/api/payments/subscription",
    { preHandler: [authenticated] },
    async (request) => {
      const service = getService();
      const subscription = await service.getSubscription(request.tenantId);
      return subscription;
    },
  );
};
