import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors, { type FastifyCorsOptions, type OriginFunction } from "@fastify/cors";
import { ApiError } from "./utils/errors.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { clientRoutes } from "./routes/clients.js";
import { integrationRoutes } from "./routes/integrations.js";
import { scanRoutes } from "./routes/scans.js";
import { findingRoutes } from "./routes/findings.js";
import { reportRoutes } from "./routes/reports.js";
import { complianceRoutes } from "./routes/compliance.js";
import { evidenceRoutes } from "./routes/evidence.js";
import { auditorRoutes } from "./routes/auditors.js";
import { remediationRoutes } from "./routes/remediations.js";
import { alertRoutes } from "./routes/alerts.js";
import { driftRoutes } from "./routes/drift.js";
import { learningRoutes } from "./routes/learning.js";
import { adminRoutes } from "./routes/admin.js";
import { adminReportRoutes } from "./routes/admin-reports.js";
import { aiRoutes } from "./routes/ai-analysis.js";
import { aiEthicsRoutes } from "./routes/ai-ethics.js";
import { threatIntelRoutes } from "./routes/threat-intel.js";
import { policyRoutes } from "./routes/policies.js";
import { confidentialComputeRoutes } from "./routes/confidential-compute.js";
import { sovereigntyRoutes } from "./routes/sovereignty.js";
import { auditChainRoutes } from "./routes/audit-chain.js";
import { satelliteHardeningRoutes } from "./routes/satellite-hardening.js";
import { mcpRoutes } from "./routes/mcp.js";
import { privacyShieldRoutes } from "./routes/privacy-shield.js";
import { stakeholderRoutes } from "./routes/stakeholder.js";
import { otScadaRoutes } from "./routes/ot-scada.js";
import { onpremRoutes } from "./routes/onprem.js";
import { agentRoutes } from "./routes/agent.js";
import { paymentRoutes } from "./routes/payments.js";
import { stripePaymentRoutes } from "./routes/payments-stripe.js";
import { samlRoutes } from "./routes/saml.js";
import { teamRoutes } from "./routes/team.js";
import { settingsRoutes } from "./routes/settings.js";
import { contactRoutes } from "./routes/contact.js";
import { cloudAccountRoutes } from "./routes/cloud-accounts.js";
import { tenantContactRoutes } from "./routes/tenant-contacts.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { scimRoutes } from "./routes/scim.js";
import scimAuthPlugin from "./plugins/scim-auth.js";
import { createDb, type Db } from "./db/connection.js";
import rateLimitPlugin from "./plugins/rate-limit.js";
import securityHeadersPlugin from "./plugins/security-headers.js";
import requestLoggerPlugin from "./plugins/request-logger.js";
import redisPlugin from "./plugins/redis.js";
import authPlugin from "./plugins/auth.js";
import type postgres from "postgres";
import auditLogPlugin from "./plugins/audit-log.js";
import csrfPlugin from "./plugins/csrf.js";
import { SqsQueue } from "./queue/sqs-client.js";
import planGatePlugin from "./plugins/plan-gate.js";
import mtlsPlugin from "./plugins/mtls.js";
import zeroLeakagePlugin from "./plugins/zero-leakage.js";
import dlpPlugin from "./plugins/dlp.js";
import type { Config } from "./config.js";
import type { ScanJobData } from "./queue/scan-queue.js";
import { initSentry } from "./sentry.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    superDb: Db;
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): raw postgres.js client for the
    // application (non-super) pool. auth.ts reserves a connection from this to
    // bind a per-request, RLS-enforced tenant context for request.db.
    appSql: postgres.Sql;
    config: Config;
    scanQueue: SqsQueue<ScanJobData>;
    monitorQueue: SqsQueue<unknown>;
    aiQueue: SqsQueue<unknown>;
    evidenceQueue: SqsQueue<unknown>;
  }
  interface FastifyRequest {
    requestId: string;
    tenantPlan: string;
  }
}

export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.NODE_ENV !== "test",
  });

  // CORS — enterprise-hardened (GAP-014).
  // In Lambda, the Function URL CORS layer handles preflight + ACAO/ACAC. Registering
  // Fastify cors here too produces duplicate access-control-allow-origin headers
  // which browsers reject. Skip when AWS_LAMBDA_FUNCTION_NAME is set; keep for local
  // dev so cross-port (localhost:3001 → :4000) still works.
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    // REAL IMPL (BLACKFYRE 2026-06): build a request-validated CORS allowlist from
    // CORS_ORIGINS (comma-separated). Previously prod allowed exactly one origin and
    // dev allowed origin:true (any), so enterprise custom domains were CORS-rejected
    // in prod. Now every configured origin is honored, with a safe default fallback,
    // and each request's Origin is validated against the allowlist.
    const SAFE_DEFAULT_ORIGINS =
      config.NODE_ENV === "production"
        ? ["https://app.blackfyre.com"]
        : ["http://localhost:3001", "http://localhost:3003"];

    const allowlist = (config.CORS_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    // Fall back to a safe default when CORS_ORIGINS resolves to empty/whitespace so we
    // never accidentally degrade to "allow any" or "allow none".
    const effectiveAllowlist = allowlist.length > 0 ? allowlist : SAFE_DEFAULT_ORIGINS;
    const allowAll = effectiveAllowlist.includes("*");

    if (allowAll && config.NODE_ENV === "production") {
      // Audit signal: a wildcard in production with credentials:true is a misconfig the
      // browser will refuse anyway; surface it loudly so it is caught before incidents.
      app.log.warn(
        { event: "cors.wildcard_in_production" },
        "CORS_ORIGINS contains '*' in production with credentials enabled — this is unsafe and browsers will reject credentialed wildcard responses",
      );
    }

    const allowSet = new Set(effectiveAllowlist);
    app.log.info(
      { event: "cors.allowlist", count: effectiveAllowlist.length, wildcard: allowAll },
      "CORS allowlist initialized",
    );

    // REAL IMPL (BLACKFYRE 2026-06): per-request origin validation against the allowlist.
    // Typed with @fastify/cors's exported OriginFunction so the callback params are not
    // implicitly `any` (noImplicitAny). Same-origin / non-browser requests (no Origin
    // header) are permitted; a present Origin must match an allowlisted entry exactly.
    const corsOriginFn: OriginFunction = (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowAll || allowSet.has(origin)) {
        cb(null, true);
        return;
      }
      // REAL IMPL (BLACKFYRE 2026-06): audit log rejected cross-origin attempts so
      // tenant domain-allowlisting gaps are observable. Never returns an error to the
      // client (that would 500); cb(null,false) omits ACAO so the browser blocks it.
      app.log.warn({ event: "cors.rejected", origin }, "CORS origin not in allowlist");
      cb(null, false);
    };

    const corsOptions: FastifyCorsOptions = {
      origin: corsOriginFn,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Request-ID", "X-CSRF-Token"],
      exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
      maxAge: 86400,
    };

    await app.register(cors, corsOptions);
  }

  // Database
  const { db, superDb, sql: appSql } = createDb(config);
  app.decorate("db", db);
  app.decorate("superDb", superDb);
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): expose the app pool's raw client
  // so auth.ts can reserve a connection and bind a per-request RLS tenant context.
  app.decorate("appSql", appSql);
  app.decorate("config", config);

  // REAL IMPL (BLACKFYRE 2026-06): wire real Sentry error reporting. Initializes
  // the SDK from SENTRY_DSN and registers an onError hook that reports only
  // unhandled (5xx / non-ApiError) errors with PII/secrets scrubbed. No-ops with a
  // boot warn when SENTRY_DSN is unset, so local/dev/test and DSN-less deploys are
  // unaffected. Called here (in buildApp) so both the server and Lambda entrypoints
  // are covered by a single call site.
  initSentry(app, config);

  // SQS queues
  app.decorate("scanQueue", new SqsQueue<ScanJobData>(config.SCAN_QUEUE_URL));
  app.decorate("monitorQueue", new SqsQueue(config.MONITOR_QUEUE_URL));
  app.decorate("aiQueue", new SqsQueue(config.AI_QUEUE_URL));
  app.decorate("evidenceQueue", new SqsQueue(config.EVIDENCE_QUEUE_URL));

  // Request ID for error tracing (spec Section 8)
  app.addHook("onRequest", async (request) => {
    request.requestId = `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  });

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): release the per-request, RLS-bound
  // reserved connection acquired by auth.ts. We RESET ALL first so the SET ROLE
  // (app_user) and app.current_tenant GUC cannot leak to the next request that
  // reuses this pooled connection, then return it to the pool. onResponse fires
  // for handled errors too; onError is a belt-and-braces net for the rest.
  async function releaseRlsConn(request: FastifyRequest) {
    const conn = request.rlsConn;
    if (!conn) return;
    request.rlsConn = undefined;
    request.db = undefined;
    try {
      await conn`RESET ALL`;
    } catch {
      // If reset fails the connection state is unknown — log and still release;
      // postgres.js will recycle a broken connection rather than reuse a dirty one.
      request.log.warn(
        { event: "rls.reset.failure" },
        "Failed to RESET reserved RLS connection before release",
      );
    } finally {
      conn.release();
    }
  }
  app.addHook("onResponse", async (request) => {
    await releaseRlsConn(request);
  });
  app.addHook("onError", async (request) => {
    await releaseRlsConn(request);
  });

  // REAL IMPL (BLACKFYRE 2026-06): structured request-timing telemetry. Emits one
  // pino record per response with event:"http.timing" so latency is queryable in log
  // aggregation (p50/p95/p99 by route + status). Complements request-logger (which
  // only logs errors/slow requests). Never logs request bodies, headers, or secrets.
  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        event: "http.timing",
        method: request.method,
        route: request.routeOptions?.url ?? request.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
        requestId: request.requestId,
        tenantId: (request as { tenantId?: string }).tenantId,
      },
      "http.timing",
    );
  });

  // Error handler — maps ApiError to spec error format
  app.setErrorHandler((error, request, reply) => {
    const base = {
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    };

    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message, details: error.details, ...base },
      });
    }

    // Zod validation errors
    if (error.name === "ZodError") {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: error.message, ...base },
      });
    }

    // Fastify validation errors
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: error.message, ...base },
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred", ...base },
    });
  });

  // Not-found handler
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      success: false,
      error: { code: "NOT_FOUND", message: `Route ${request.method} ${request.url} not found` },
    });
  });

  // Hardening plugins (before auth)
  await app.register(rateLimitPlugin);
  await app.register(securityHeadersPlugin);
  await app.register(requestLoggerPlugin);
  await app.register(mtlsPlugin);
  await app.register(csrfPlugin);

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): Redis must be available before
  // auth (auth lockouts / rate state depend on it). Registered ahead of
  // authPlugin so decorators like fastify.redis exist when auth initializes.
  await app.register(redisPlugin);

  // Auth (sets request.tenantId/userId/tenantPlan + request.db in authenticate())
  await app.register(authPlugin);
  await app.register(planGatePlugin);

  // Audit logging (after auth so tenantId/userId are available)
  await app.register(auditLogPlugin);

  // Tenant isolation + DLP (after auth so tenantId is available)
  await app.register(zeroLeakagePlugin);
  await app.register(dlpPlugin);

  // Routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(integrationRoutes);
  await app.register(scanRoutes);
  await app.register(findingRoutes);
  await app.register(reportRoutes);
  await app.register(complianceRoutes);
  await app.register(evidenceRoutes);
  await app.register(auditorRoutes);
  await app.register(remediationRoutes);
  await app.register(alertRoutes);
  await app.register(driftRoutes);
  await app.register(learningRoutes);
  // Platform-admin (operator) surface — see config.PLATFORM_ADMIN_API.
  // Off by default: a self-hosted install is a single tenant and has no use for
  // cross-tenant reads, tenant provisioning or billing. When disabled these
  // routes do not exist, so `is_platform_admin` confers nothing over HTTP.
  if (config.PLATFORM_ADMIN_API === "true") {
    app.log.warn(
      "PLATFORM_ADMIN_API=true — cross-tenant operator routes are enabled",
    );
    await app.register(clientRoutes);
    await app.register(adminRoutes);
    await app.register(adminReportRoutes);
  }
  await app.register(aiRoutes);
  await app.register(aiEthicsRoutes);
  await app.register(threatIntelRoutes);
  await app.register(policyRoutes);
  await app.register(confidentialComputeRoutes);
  await app.register(sovereigntyRoutes);
  await app.register(auditChainRoutes);
  await app.register(satelliteHardeningRoutes);
  await app.register(mcpRoutes);
  await app.register(privacyShieldRoutes);
  await app.register(stakeholderRoutes);
  await app.register(otScadaRoutes);
  await app.register(onpremRoutes);
  // REAL IMPL (BLACKFYRE 2026-06): on-prem agent enrollment/heartbeat/findings/
  // commands/sync (Wave 5). Agent endpoints authenticate via their own bearer
  // token (+ optional mTLS pin); enroll is gated by standard owner/admin role auth.
  await app.register(agentRoutes);
  await app.register(paymentRoutes);
  await app.register(stripePaymentRoutes);
  await app.register(samlRoutes);
  await app.register(teamRoutes);
  await app.register(settingsRoutes);
  await app.register(contactRoutes);
  await app.register(cloudAccountRoutes);
  await app.register(tenantContactRoutes);
  await app.register(onboardingRoutes);

  // SCIM 2.0 — own bearer-token auth, registered after standard auth plugins
  await app.register(scimAuthPlugin);
  await app.register(scimRoutes, { prefix: "/scim/v2" });

  return app;
}
