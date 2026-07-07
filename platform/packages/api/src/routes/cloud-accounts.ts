import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { cloudAccounts, auditLogs } from "../db/schema.js";
import { notFound, badRequest } from "../utils/errors.js";
import { requireUUID } from "../utils/security-fixes.js";
import { planLimiter, normalizePlan } from "../services/provisioning-service.js";

const AWS_ACCOUNT_ID_RE = /^\d{12}$/;
const AWS_ROLE_ARN_RE = /^arn:aws:iam::\d{12}:role\/[\w+=,.@\-/]+$/;

const initAwsSchema = z.object({
  accountId: z.string().regex(AWS_ACCOUNT_ID_RE, "AWS account ID must be 12 digits"),
  accountAlias: z.string().max(200).optional(),
  regions: z.array(z.string().min(1)).min(1).max(20),
});

const verifyAwsSchema = z.object({
  cloudAccountId: z.string().uuid(),
  roleArn: z.string().regex(AWS_ROLE_ARN_RE, "Invalid IAM role ARN"),
});

function generateExternalId(): string {
  return "bfyr-" + randomBytes(24).toString("base64url");
}

export const cloudAccountRoutes: FastifyPluginAsync = async (app) => {
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");

  // GET /api/cloud-accounts — list cloud accounts for current tenant
  app.get("/api/cloud-accounts", { preHandler: [authenticated] }, async (request) => {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): list via the RLS-bound request.db
    // (was app.db, which bypasses RLS — a cross-tenant account-enumeration risk).
    // The explicit tenantId predicate is retained as defense-in-depth. This route
    // runs behind requireRole so request.db is set; app.db is only a fallback.
    const db = request.db ?? app.db;
    const rows = await db
      .select()
      .from(cloudAccounts)
      .where(eq(cloudAccounts.tenantId, request.tenantId));
    return { cloudAccounts: rows, total: rows.length };
  });

  // POST /api/cloud-accounts/aws/init — start AWS link flow.
  // Generates a per-tenant externalId and returns the trust-policy snippet
  // the client must apply to their IAM role. No credentials touched yet.
  app.post("/api/cloud-accounts/aws/init", { preHandler: [adminOrEngineer] }, async (request, reply) => {
    const body = initAwsSchema.parse(request.body);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): use the RLS-bound request.db for
    // all tenant-scoped reads/writes (was app.db, which bypasses RLS). This route
    // runs behind requireRole so request.db is set; app.db is only a fallback.
    // The explicit tenantId predicate below is retained as defense-in-depth.
    const db = request.db ?? app.db;

    const existing = await db
      .select()
      .from(cloudAccounts)
      .where(and(
        eq(cloudAccounts.tenantId, request.tenantId),
        eq(cloudAccounts.provider, "aws"),
        eq(cloudAccounts.accountId, body.accountId),
      ))
      .limit(1);

    let account = existing[0];
    if (!account) {
      // REAL IMPL (BLACKFYRE 2026-06): enforce the plan's maxCloudAccounts limit
      // BEFORE creating a new cloud account (Comply:1, Protect:3, Defend:unlimited).
      // The limit comes from PLAN_FEATURES via the provisioning service — nothing
      // is hardcoded here. We only gate the create path: re-running init for an
      // already-linked account (existing branch below) is not a new allocation.
      // Counting on the RLS-bound request.db keeps it tenant-scoped; blocked
      // attempts throw 403 PLAN_LIMIT_REACHED {upgradeUrl} and log at warn.
      await planLimiter(db).assertCanAddCloudAccount(
        request.tenantId,
        normalizePlan(request.tenantPlan),
        request.log,
      );

      const externalId = generateExternalId();
      const [created] = await db.insert(cloudAccounts).values({
        tenantId: request.tenantId,
        provider: "aws",
        accountId: body.accountId,
        accountAlias: body.accountAlias,
        externalId,
        regions: body.regions,
        status: "pending",
      }).returning();
      account = created;
    } else if (account.status === "verified") {
      throw badRequest("cloud_account_already_linked", "AWS account already linked. Disconnect first to re-link.");
    }

    await db.insert(auditLogs).values({
      tenantId: request.tenantId,
      actorType: "user",
      actorId: (request as any).user?.id ?? null,
      action: "cloud_account.aws.init",
      resourceType: "cloud_account",
      resourceId: account.id,
      details: { accountId: body.accountId, regions: body.regions },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null,
    });

    const blackfyreCallerArn =
      process.env.BLACKFYRE_SCANNER_ROLE_ARN ?? "arn:aws:iam::000000000000:role/BlackfyreScanner";

    const trustPolicy = {
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Principal: { AWS: blackfyreCallerArn },
        Action: "sts:AssumeRole",
        Condition: { StringEquals: { "sts:ExternalId": account.externalId } },
      }],
    };

    return reply.status(201).send({
      cloudAccount: {
        id: account.id,
        accountId: account.accountId,
        externalId: account.externalId,
        status: account.status,
        regions: account.regions,
      },
      trustPolicy,
      instructions: {
        cloudformationStackName: "BlackfyreReadOnlyRole",
        manualSteps: [
          "1. In your AWS console, navigate to IAM → Roles → Create role.",
          "2. Choose 'Another AWS account' as trusted entity.",
          `3. Account ID: ${blackfyreCallerArn.split(":")[4]} · Require external ID: ${account.externalId}`,
          "4. Attach the Blackfyre least-privilege read-only policy (link in docs).",
          "5. Copy the role ARN and submit to /api/cloud-accounts/aws/verify.",
        ],
      },
    });
  });

  // POST /api/cloud-accounts/aws/verify — perform sts:AssumeRole +
  // sts:GetCallerIdentity to confirm the client's trust policy is correctly
  // wired. Persists verified status only on success.
  app.post("/api/cloud-accounts/aws/verify", { preHandler: [adminOrEngineer] }, async (request, reply) => {
    const body = verifyAwsSchema.parse(request.body);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): use the RLS-bound request.db for
    // all tenant-scoped reads/writes (was app.db, which bypasses RLS). This route
    // runs behind requireRole so request.db is set; app.db is only a fallback.
    const db = request.db ?? app.db;

    const [account] = await db
      .select()
      .from(cloudAccounts)
      .where(and(
        eq(cloudAccounts.id, body.cloudAccountId),
        eq(cloudAccounts.tenantId, request.tenantId),
      ))
      .limit(1);

    if (!account) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): 404 (not 403) on a cross-tenant
      // or missing account id so the response cannot confirm an account that
      // belongs to another tenant. Log the denial at warn for anomaly detection.
      request.log.warn(
        { event: "cloud_account.verify.denied", cloudAccountId: body.cloudAccountId, tenantId: request.tenantId },
        "Cloud account verify denied: id not found in tenant",
      );
      throw notFound("Cloud account");
    }
    if (account.provider !== "aws") throw badRequest("invalid_provider", "Cloud account is not AWS");

    // Mark verifying so the UI can poll.
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): scope the mutation with an explicit
    // tenantId predicate (defense-in-depth alongside RLS) so it can never update a
    // same-id account in another tenant.
    await db.update(cloudAccounts)
      .set({ status: "verifying", roleArn: body.roleArn, updatedAt: new Date() })
      .where(and(eq(cloudAccounts.id, account.id), eq(cloudAccounts.tenantId, request.tenantId)));

    const sts = new STSClient({ region: account.regions[0] ?? "us-east-1" });
    const sessionName = `blackfyre-verify-${account.id.slice(0, 8)}`;

    try {
      const assumed = await sts.send(new AssumeRoleCommand({
        RoleArn: body.roleArn,
        ExternalId: account.externalId,
        RoleSessionName: sessionName,
        DurationSeconds: 900,
      }));

      const creds = assumed.Credentials;
      if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken) {
        throw new Error("STS returned incomplete credentials");
      }

      const scopedSts = new STSClient({
        region: account.regions[0] ?? "us-east-1",
        credentials: {
          accessKeyId: creds.AccessKeyId,
          secretAccessKey: creds.SecretAccessKey,
          sessionToken: creds.SessionToken,
        },
      });

      const identity = await scopedSts.send(new GetCallerIdentityCommand({}));

      if (!identity.Account || identity.Account !== account.accountId) {
        throw new Error(
          `Account ID mismatch: trust policy belongs to ${identity.Account}, expected ${account.accountId}`,
        );
      }

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): RLS-bound db + explicit tenantId
      // predicate (defense-in-depth) on the verified-status mutation.
      await db.update(cloudAccounts)
        .set({
          status: "verified",
          lastVerifiedAt: new Date(),
          verifiedCallerArn: identity.Arn ?? null,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(and(eq(cloudAccounts.id, account.id), eq(cloudAccounts.tenantId, request.tenantId)));

      await db.insert(auditLogs).values({
        tenantId: request.tenantId,
        actorType: "user",
        actorId: (request as any).user?.id ?? null,
        action: "cloud_account.aws.verified",
        resourceType: "cloud_account",
        resourceId: account.id,
        details: { accountId: account.accountId, callerArn: identity.Arn },
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] ?? null,
      });

      return reply.send({
        ok: true,
        cloudAccount: {
          id: account.id,
          status: "verified",
          verifiedCallerArn: identity.Arn,
          verifiedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      const errMsg = err?.message ?? "Unknown verification error";

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): log the verification failure at
      // warn (anomalous outcome). The message is an STS/validation error string —
      // no credentials/tokens are included (assumed creds are never logged).
      request.log.warn(
        { event: "cloud_account.verify.failed", cloudAccountId: account.id, tenantId: request.tenantId },
        "AWS cloud account verification failed",
      );

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): RLS-bound db + explicit tenantId
      // predicate (defense-in-depth) on the error-status mutation.
      await db.update(cloudAccounts)
        .set({
          status: "error",
          lastError: errMsg.slice(0, 1000),
          updatedAt: new Date(),
        })
        .where(and(eq(cloudAccounts.id, account.id), eq(cloudAccounts.tenantId, request.tenantId)));

      await db.insert(auditLogs).values({
        tenantId: request.tenantId,
        actorType: "user",
        actorId: (request as any).user?.id ?? null,
        action: "cloud_account.aws.verify_failed",
        resourceType: "cloud_account",
        resourceId: account.id,
        details: { error: errMsg },
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] ?? null,
        outcome: "failure",
      });

      return reply.status(400).send({
        ok: false,
        error: "verification_failed",
        message: errMsg,
        hint: "Check that the trust policy in your IAM role exactly matches the externalId we provided. Verify the role ARN and that the role's account matches the AWS account ID you registered.",
      });
    }
  });

  // DELETE /api/cloud-accounts/:id — disconnect a cloud account.
  app.delete<{ Params: { id: string } }>("/api/cloud-accounts/:id", {
    preHandler: [adminOrEngineer],
  }, async (request, reply) => {
    requireUUID(request.params.id);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): use the RLS-bound request.db for
    // the by-id lookup + delete (was app.db, which bypasses RLS — a cross-tenant
    // account-manipulation risk). This route runs behind requireRole so request.db
    // is set; app.db is only a fallback.
    const db = request.db ?? app.db;

    const [account] = await db
      .select()
      .from(cloudAccounts)
      .where(and(
        eq(cloudAccounts.id, request.params.id),
        eq(cloudAccounts.tenantId, request.tenantId),
      ))
      .limit(1);

    if (!account) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): 404 (not 403) on a cross-tenant
      // or missing account id so a caller cannot probe/disconnect another tenant's
      // account. Log the denial at warn for anomaly detection.
      request.log.warn(
        { event: "cloud_account.disconnect.denied", cloudAccountId: request.params.id, tenantId: request.tenantId },
        "Cloud account disconnect denied: id not found in tenant",
      );
      throw notFound("Cloud account");
    }

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): scope the delete with an explicit
    // tenantId predicate (defense-in-depth alongside RLS) so it can never delete a
    // same-id account in another tenant.
    await db.delete(cloudAccounts)
      .where(and(eq(cloudAccounts.id, account.id), eq(cloudAccounts.tenantId, request.tenantId)));

    await db.insert(auditLogs).values({
      tenantId: request.tenantId,
      actorType: "user",
      actorId: (request as any).user?.id ?? null,
      action: "cloud_account.disconnected",
      resourceType: "cloud_account",
      resourceId: account.id,
      details: { provider: account.provider, accountId: account.accountId },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null,
    });

    return reply.status(204).send();
  });
};
