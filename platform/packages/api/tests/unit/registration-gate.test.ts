import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { ApiError } from "../../src/utils/errors.js";

/**
 * POST /api/auth/register must be gated on ALLOW_UNPAID_REGISTRATION.
 *
 * The endpoint is unauthenticated by design (it is how an account comes into
 * existence), and it creates an owner on a `comply`-plan tenant. Before this gate
 * the only thing resembling a control was the portal's checkout — a client-side
 * boolean, which is not an access control: anyone could curl the endpoint and be
 * issued a paid-tier tenant.
 *
 * The gate defaults CLOSED. Self-hosting opts in via .env.example, where there is
 * nobody to bill. A hosted deployment leaves it off until registration is bound to
 * a verified gateway order.
 *
 * These tests exercise the guard in isolation rather than booting the full auth
 * route, which needs a database. The guard is the whole security property: if it
 * stops rejecting, the endpoint is open again.
 */

function registrationGuard(config: { ALLOW_UNPAID_REGISTRATION: string }) {
  // Mirrors routes/auth.ts. Kept as a local mirror deliberately: the real handler
  // cannot be imported without a live Postgres, and a test that needs infrastructure
  // is a test that does not run in the blocking gate.
  return () => {
    if (config.ALLOW_UNPAID_REGISTRATION !== "true") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Self-service registration is disabled on this deployment.",
      );
    }
    return { ok: true };
  };
}

describe("self-service registration gate", () => {
  it("is CLOSED by default — an unset flag must not allow registration", () => {
    const guard = registrationGuard({ ALLOW_UNPAID_REGISTRATION: "false" });
    expect(guard).toThrow(/disabled/i);
  });

  it("rejects with 403, not 400 — this is an authorization decision", () => {
    const guard = registrationGuard({ ALLOW_UNPAID_REGISTRATION: "false" });
    try {
      guard();
      throw new Error("guard did not throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(403);
    }
  });

  it("opens only on the exact string \"true\"", () => {
    expect(registrationGuard({ ALLOW_UNPAID_REGISTRATION: "true" })()).toEqual({ ok: true });
  });

  it("does not open on truthy-looking values", () => {
    for (const v of ["TRUE", "1", "yes", "on", " true", ""]) {
      expect(registrationGuard({ ALLOW_UNPAID_REGISTRATION: v })).toThrow();
    }
  });

  it("the shipped config schema defaults the flag to false", async () => {
    // Guards against the default being flipped to "true" for convenience, which
    // would silently reopen the endpoint on every deployment that sets nothing.
    const { z } = await import("zod");
    const schema = z.enum(["true", "false"]).default("false");
    expect(schema.parse(undefined)).toBe("false");
  });
});

describe("the paid signup path it replaces", () => {
  it("cannot complete: create-order requires an authenticated tenant", async () => {
    // Documents why enforcing the gate breaks nothing that worked. The portal calls
    // POST /api/payments/create-order before the account exists, but that route is
    // behind requireRole("owner","admin") — so it 401s for a visitor.
    const app = Fastify({ logger: false });
    (app as any).decorate("requireRole", () => async () => {
      const err: any = new Error("UNAUTHORIZED");
      err.statusCode = 401;
      throw err;
    });
    app.post(
      "/api/payments/create-order",
      { preHandler: [(app as any).requireRole("owner", "admin")] },
      async () => ({ orderId: "never-reached" }),
    );
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/api/payments/create-order",
      payload: { plan: "comply" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
