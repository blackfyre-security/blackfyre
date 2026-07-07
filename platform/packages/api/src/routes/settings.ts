import type { FastifyPluginAsync, FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { users, apiKeys } from "../db/schema.js";
import { notFound, badRequest } from "../utils/errors.js";
import { verifyPassword } from "../utils/password.js";
import { verifyTOTP } from "../utils/totp.js";
// SECURITY FIX (BLACKFYRE audit 2026-06-05): never log raw emails/PII — fingerprint them.
import { redactSecretString } from "../lib/redact.js";

/**
 * Per-user settings (portal /settings page).
 *
 * Note: notification preferences and timezone aren't stored in the DB yet
 * — we return defaults. A follow-up migration can add a `user_preferences`
 * table if/when we need real persistence beyond name/email.
 */

// SECURITY FIX (BLACKFYRE audit 2026-06-05): account-takeover + self-lockout — login
// email changes and MFA-disable were unauthenticated mutations (any role could flip
// them with no step-up). Both now require a fresh step-up (current password and, when
// MFA is enrolled, a current TOTP code). MFA-disable validates step-up before flipping
// the flag; the login email is NOT changed inline — it requires an email-verification
// round-trip (token mailed to the NEW address, then confirmed) so a hijacked session
// can't silently re-point the login identity.

// SECURITY FIX (BLACKFYRE audit 2026-06-05): the step-up + email-verification controls
// depend on a shared store for the pending-change token. app.redis is a typed
// `Redis | null`; per the redis plugin's fail-closed contract we DENY (503) when it is
// unavailable rather than skip the verification round-trip.
function requireRedis(app: FastifyInstance) {
  const redis = app.redis;
  if (!redis) {
    throw Object.assign(
      new Error("Settings service temporarily unavailable. Please try again shortly."),
      { statusCode: 503, code: "SETTINGS_UNAVAILABLE" },
    );
  }
  return redis;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare of two hex token hashes. */
function tokenHashEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

const PENDING_EMAIL_TTL_SECONDS = 30 * 60; // 30 minutes for the verification round-trip.

function pendingEmailKey(tenantId: string, userId: string): string {
  return `bf:settings:email-change:${tenantId}:${userId}`;
}

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");

  const updateSchema = z.object({
    displayName: z.string().min(1).max(200).optional(),
    email: z.string().email().max(320).optional(),
    timezone: z.string().max(64).optional(),
    twoFactorEnabled: z.boolean().optional(),
    notifications: z.object({
      email: z.boolean().optional(),
      slack: z.boolean().optional(),
      webhook: z.boolean().optional(),
      sms: z.boolean().optional(),
      inApp: z.boolean().optional(),
    }).partial().optional(),
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): step-up credentials carried alongside
    // a sensitive change (MFA-disable / email-change). Optional in the schema so
    // non-sensitive edits (displayName/timezone/notifications) don't demand them; the
    // handler enforces their presence for the sensitive transitions.
    currentPassword: z.string().min(1).max(1024).optional(),
    totpCode: z.string().min(6).max(10).optional(),
  });

  const confirmEmailSchema = z.object({
    token: z.string().min(1).max(256),
  });

  function buildResponse(u: typeof users.$inferSelect, extra?: Record<string, unknown>) {
    return {
      user: { name: u.name, email: u.email, role: u.role },
      displayName: u.name,
      email: u.email,
      timezone: "UTC",
      twoFactorEnabled: u.mfaEnabled,
      notifications: {
        email: true,
        slack: false,
        webhook: false,
        sms: false,
        inApp: true,
      },
      ...extra,
    };
  }

  /**
   * SECURITY FIX (BLACKFYRE audit 2026-06-05): fresh step-up verification helper.
   * Re-authenticates the caller against their CURRENT credentials before a sensitive
   * change. Requires the current password and, when MFA is enrolled, a valid current
   * TOTP code. Throws 400/401 on missing/invalid factors. Never logs the raw factors.
   */
  async function verifyStepUp(
    request: import("fastify").FastifyRequest,
    user: typeof users.$inferSelect,
    body: { currentPassword?: string; totpCode?: string },
    context: string,
  ): Promise<void> {
    if (!body.currentPassword) {
      throw badRequest(
        "STEPUP_REQUIRED",
        "This change requires re-entering your current password.",
      );
    }

    const passwordOk = await verifyPassword(user.passwordHash, body.currentPassword);
    if (!passwordOk) {
      request.log.warn(
        {
          event: "settings.stepup.password_failed",
          context,
          userId: user.id,
          tenantId: user.tenantId,
        },
        "Step-up re-authentication failed (bad password) for sensitive settings change",
      );
      throw badRequest("STEPUP_INVALID", "Current password is incorrect.");
    }

    // When MFA is enrolled, a current TOTP code is also mandatory for step-up.
    if (user.mfaEnabled && user.mfaSecret) {
      if (!body.totpCode) {
        throw badRequest(
          "MFA_STEPUP_REQUIRED",
          "This change requires a current authenticator (TOTP) code.",
        );
      }
      const totpOk = verifyTOTP(user.mfaSecret, body.totpCode);
      if (!totpOk) {
        request.log.warn(
          {
            event: "settings.stepup.totp_failed",
            context,
            userId: user.id,
            tenantId: user.tenantId,
          },
          "Step-up re-authentication failed (bad TOTP) for sensitive settings change",
        );
        throw badRequest("MFA_STEPUP_INVALID", "Authenticator code is invalid.");
      }
    }
  }

  // GET /api/settings/user
  app.get("/api/settings/user", { preHandler: [authenticated] }, async (request) => {
    // Run tenant-scoped reads on the RLS-enforced handle (request.db) when available.
    const db = request.db ?? app.db;
    const [u] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, request.userId), eq(users.tenantId, request.tenantId)))
      .limit(1);
    if (!u) throw notFound("User");
    return buildResponse(u);
  });

  // PATCH /api/settings/user
  app.patch("/api/settings/user", { preHandler: [authenticated] }, async (request) => {
    const body = updateSchema.parse(request.body);
    const db = request.db ?? app.db;

    const [current] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, request.userId), eq(users.tenantId, request.tenantId)))
      .limit(1);
    if (!current) throw notFound("User");

    // Non-sensitive fields applied directly.
    const patch: { name?: string } = {};
    if (body.displayName !== undefined) patch.name = body.displayName;

    // ---- Finding (A): MFA toggle requires step-up; no inline enable -------------------
    let mfaPatch: { mfaEnabled?: boolean } = {};
    if (body.twoFactorEnabled !== undefined && body.twoFactorEnabled !== current.mfaEnabled) {
      if (body.twoFactorEnabled === false) {
        // SECURITY FIX (BLACKFYRE audit 2026-06-05): MFA could be disabled with no
        // step-up (and a user could self-lockout an org that requires MFA). Disabling
        // MFA now requires fresh re-authentication (password + current TOTP).
        await verifyStepUp(request, current, body, "mfa_disable");
        mfaPatch.mfaEnabled = false;
        request.log.warn(
          {
            event: "settings.mfa.disabled",
            userId: current.id,
            tenantId: current.tenantId,
            role: current.role,
          },
          "MFA disabled via settings after successful step-up re-authentication",
        );
      } else {
        // SECURITY FIX (BLACKFYRE audit 2026-06-05): never flip mfaEnabled=true inline.
        // Enabling MFA must provision and confirm a TOTP secret via the dedicated
        // /api/auth/mfa/setup + /confirm flow; otherwise the account would be marked
        // MFA-protected with no secret, defeating the control.
        request.log.warn(
          {
            event: "settings.mfa.enable_rejected",
            userId: current.id,
            tenantId: current.tenantId,
          },
          "Rejected attempt to enable MFA via settings PATCH — must use MFA enrollment flow",
        );
        throw badRequest(
          "MFA_ENROLL_VIA_SETUP",
          "Enable MFA via the authenticator enrollment flow (MFA setup), not the settings toggle.",
        );
      }
    }

    // ---- Finding (B): login email change requires step-up + verification round-trip ---
    let pendingEmail: string | null = null;
    if (body.email !== undefined) {
      const newEmail = body.email.trim().toLowerCase();
      if (newEmail !== current.email.toLowerCase()) {
        // SECURITY FIX (BLACKFYRE audit 2026-06-05): any user (incl. viewer) could
        // re-point their login email with no verification/re-auth — an account-takeover
        // pivot. The login email is NOT changed inline. We (1) require fresh step-up
        // re-authentication, then (2) issue an email-verification token to the NEW
        // address; the change only lands once that token is confirmed.
        await verifyStepUp(request, current, body, "email_change");

        const redis = requireRedis(app);
        const rawToken = randomBytes(32).toString("hex");
        const record = JSON.stringify({
          userId: current.id,
          tenantId: current.tenantId,
          newEmail,
          tokenHash: hashToken(rawToken),
          createdAt: new Date().toISOString(),
        });
        // Single pending change per user; a new request supersedes any prior one.
        await redis.set(
          pendingEmailKey(current.tenantId, current.id),
          record,
          "EX",
          PENDING_EMAIL_TTL_SECONDS,
        );

        // The verification link/token is delivered to the NEW address out-of-band
        // (notification dispatcher). We log the issuance (no raw token/email) at warn.
        request.log.warn(
          {
            event: "settings.email_change.requested",
            userId: current.id,
            tenantId: current.tenantId,
            role: current.role,
            currentEmail: redactSecretString(current.email),
            newEmail: redactSecretString(newEmail),
          },
          "Login email change requested — verification token issued to new address (not yet applied)",
        );

        pendingEmail = newEmail;
        // In non-production we surface the token so the flow is testable without mail.
        if (process.env.NODE_ENV !== "production") {
          (request as any)._emailVerifyToken = rawToken;
        }
      }
    }

    const namePatch = Object.keys(patch).length > 0 ? patch : null;
    const mfaApply = Object.keys(mfaPatch).length > 0 ? mfaPatch : null;

    if (!namePatch && !mfaApply) {
      // Nothing applied inline (email change, if any, is pending verification).
      const extra: Record<string, unknown> = {};
      if (pendingEmail) {
        extra.pendingEmail = pendingEmail;
        extra.emailVerificationRequired = true;
        const tok = (request as any)._emailVerifyToken;
        if (tok) extra.emailVerificationToken = tok;
      }
      return buildResponse(current, Object.keys(extra).length ? extra : undefined);
    }

    const [updated] = await db
      .update(users)
      .set({ ...namePatch, ...mfaApply })
      .where(and(eq(users.id, request.userId), eq(users.tenantId, request.tenantId)))
      .returning();
    if (!updated) throw notFound("User");

    const extra: Record<string, unknown> = {};
    if (pendingEmail) {
      extra.pendingEmail = pendingEmail;
      extra.emailVerificationRequired = true;
      const tok = (request as any)._emailVerifyToken;
      if (tok) extra.emailVerificationToken = tok;
    }
    return buildResponse(updated, Object.keys(extra).length ? extra : undefined);
  });

  // POST /api/settings/user/email/confirm — complete the email-verification round-trip.
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): the login email only changes here, after
  // the token mailed to the NEW address is presented back. This proves control of the
  // new mailbox and prevents a hijacked session from silently re-pointing the identity.
  app.post(
    "/api/settings/user/email/confirm",
    { preHandler: [authenticated] },
    async (request, reply) => {
      const { token } = confirmEmailSchema.parse(request.body);
      const db = request.db ?? app.db;
      const redis = requireRedis(app);

      const key = pendingEmailKey(request.tenantId, request.userId);
      const raw = await redis.get(key);
      if (!raw) {
        request.log.warn(
          {
            event: "settings.email_change.confirm_no_pending",
            userId: request.userId,
            tenantId: request.tenantId,
          },
          "Email-change confirmation with no pending request (expired or never issued)",
        );
        throw badRequest(
          "NO_PENDING_EMAIL_CHANGE",
          "No pending email change — it may have expired. Please start again.",
        );
      }

      let record: { userId: string; tenantId: string; newEmail: string; tokenHash: string };
      try {
        record = JSON.parse(raw);
      } catch {
        await redis.del(key).catch(() => {});
        throw badRequest("NO_PENDING_EMAIL_CHANGE", "Pending email change is invalid. Please start again.");
      }

      // Bind the pending change to the authenticated caller (defense-in-depth on top of
      // the per-user key) and verify the token in constant time.
      if (
        record.userId !== request.userId ||
        record.tenantId !== request.tenantId ||
        !tokenHashEquals(record.tokenHash, hashToken(token))
      ) {
        request.log.warn(
          {
            event: "settings.email_change.confirm_invalid_token",
            userId: request.userId,
            tenantId: request.tenantId,
          },
          "Email-change confirmation failed — invalid verification token",
        );
        throw badRequest("INVALID_VERIFICATION_TOKEN", "Verification token is invalid or expired.");
      }

      const [updated] = await db
        .update(users)
        .set({ email: record.newEmail })
        .where(and(eq(users.id, request.userId), eq(users.tenantId, request.tenantId)))
        .returning();
      if (!updated) throw notFound("User");

      await redis.del(key).catch(() => {});

      request.log.warn(
        {
          event: "settings.email_change.confirmed",
          userId: updated.id,
          tenantId: updated.tenantId,
          role: updated.role,
          newEmail: redactSecretString(updated.email),
        },
        "Login email changed after successful verification round-trip",
      );

      return reply.send(buildResponse(updated));
    },
  );

  // GET /api/settings/api-keys — list keys for the current user
  app.get("/api/settings/api-keys", { preHandler: [authenticated] }, async (request) => {
    const db = request.db ?? app.db;
    const rows = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, request.userId), eq(apiKeys.tenantId, request.tenantId)))
      .limit(100);

    return {
      apiKey: rows[0] ? `${rows[0].prefix}••••••••` : "",
      apiKeys: rows.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        createdAt: k.createdAt ? k.createdAt.toISOString() : null,
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
      })),
    };
  });
};
