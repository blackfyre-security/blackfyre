// REAL IMPL (BLACKFYRE 2026-06): on-prem agent endpoints (Wave 5, enterprise auth).
//
// The on-prem scanning agent talks to the platform over five endpoints that were
// previously MISSING entirely (the agent had no way to authenticate or report):
//   POST /api/agent/enroll     — owner/admin mints a ONE-TIME agent token.
//   POST /api/agent/heartbeat  — agent reports liveness; updates last_seen_at.
//   POST /api/agent/findings   — agent submits scan findings; ingested tenant-scoped.
//   GET  /api/agent/commands   — agent polls for queued commands.
//   POST /api/agent/sync       — agent acks delivered commands + reports state.
//
// Authentication model (NOTHING STUBBED):
//   * Enroll is performed by an AUTHENTICATED tenant owner/admin (standard JWT/role
//     auth via requireRole). It mints `bfagent_<token_prefix>.<secret>`, persists
//     ONLY a salted Argon2id hash of the full token plus the indexed token_prefix,
//     and returns the raw token exactly once. The token is never persisted or logged.
//   * Agent requests authenticate via that bearer token: a SINGLE indexed lookup by
//     token_prefix (constant work — exactly one Argon2 verify), with a dummy-hash
//     verify on the miss path to flatten the timing channel (same pattern as
//     plugins/scim-auth.ts and the API-key path in plugins/auth.ts).
//   * When an enrollment PINS an mTLS fingerprint, the agent request must ALSO
//     present a matching client certificate (validated upstream by plugins/mtls.ts,
//     which exposes request.clientCert.fingerprint). Bearer AND cert must both pass.
//
// Tenant isolation: enroll runs on the owner/admin's RLS-bound request.db. Agent
// auth is a cross-tenant, pre-auth bearer lookup (no tenant context yet) so it runs
// on the owner pool (app.superDb, bypasses RLS) exactly like scim-auth/auth, then
// BINDS a per-request RLS context (reserve conn → SET ROLE app_user → set
// app.current_tenant) so every downstream agent query runs under RLS. That reserved
// connection is released by the global onResponse/onError hooks in app.ts.
//
// Logging is structured pino with stable event names. The agent token, its secret,
// and submitted assertions are NEVER logged — only a redacted prefix fingerprint
// and non-secret identifiers (tenantId, enrollmentId, counts).

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { drizzleReserved } from "../db/connection.js";
import { scans } from "../db/schema.js";
import { agentFindingSchema } from "@blackfyre/shared";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { redactSecretString } from "../lib/redact.js";
import { unauthorized, forbidden, badRequest } from "../utils/errors.js";
import { FindingService } from "../services/finding-service.js";

// ---------------------------------------------------------------------------
// Token format + auth constants
// ---------------------------------------------------------------------------
// Agent tokens are `bfagent_<token_prefix>.<secret>`. The prefix is a short,
// non-secret, indexed handle used to resolve the enrollment in ONE row lookup;
// the secret half is what Argon2 actually verifies. The prefix is also what we
// log (redacted) so a raw token never reaches the logs.
const AGENT_TOKEN_PREFIX = "bfagent_";
// Bytes of entropy for each half. 12 bytes (96 bits) of base64url prefix is more
// than enough to make the indexed handle collision-free; 32 bytes (256 bits) of
// secret is the actual credential strength.
const PREFIX_BYTES = 12;
const SECRET_BYTES = 32;
// Stable, REAL Argon2id hash of a throwaway value, used to spend a constant unit
// of KDF work on the auth FAILURE path so a miss is not measurably cheaper than a
// hit (timing-channel mitigation). It is not a credential — verifying any token
// against it runs the full KDF and returns false. Mirrors scim-auth.ts.
const DUMMY_ARGON2_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$Z9wuAlH0Sb66z3dmLFYOPA$Hke5jOMmMgWW0HL8CZIqi7BzJ4K0cQnWedbbMeBOG7M";

const PREFIX_RE = /^[A-Za-z0-9_-]{8,64}$/;

// ---------------------------------------------------------------------------
// Request augmentation
// ---------------------------------------------------------------------------
export interface AgentContext {
  enrollmentId: string;
  tenantId: string;
  createdBy: string;
  label: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    agent?: AgentContext;
  }
}

// Minimal owner-pool handle shape (mirrors how scim-auth.ts treats app.superDb).
type SuperDb = { execute: (q: unknown) => Promise<any[]> };

interface EnrollmentRow {
  id: string;
  tenant_id: string;
  created_by: string;
  token_hash: string;
  fingerprint: string | null;
  label: string | null;
  enabled: boolean;
}

/** Parse the indexed prefix out of a `bfagent_<prefix>.<secret>` token. */
function parseAgentToken(raw: string): { prefix: string } | null {
  if (!raw.startsWith(AGENT_TOKEN_PREFIX)) return null;
  const rest = raw.slice(AGENT_TOKEN_PREFIX.length);
  const dot = rest.indexOf(".");
  if (dot <= 0 || dot === rest.length - 1) return null;
  const prefix = rest.slice(0, dot);
  if (!PREFIX_RE.test(prefix)) return null;
  return { prefix };
}

/** Non-reversible fingerprint of a raw token for safe (redacted) log correlation. */
function tokenFingerprint(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------
const enrollBodySchema = z.object({
  label: z.string().min(1).max(200).optional(),
  // Optional mTLS client-certificate fingerprint to pin to this enrollment.
  // Accepts the uppercase/lowercase SHA-256 hex form computeFingerprint() emits
  // (64 hex chars, optionally colon-separated); normalized to uppercase, no colons.
  fingerprint: z
    .string()
    .min(2)
    .max(200)
    .regex(/^[0-9a-fA-F:]+$/, "fingerprint must be hex (optionally colon-separated)")
    .optional(),
});

const heartbeatBodySchema = z.object({
  // Free-form, bounded agent-reported status (e.g. "idle", "scanning"); informational.
  status: z.string().max(100).optional(),
  agentVersion: z.string().max(100).optional(),
});

const findingsBodySchema = z.object({
  // The agent groups findings under one logical scan run; reuse the same scanId
  // across batched submissions to attach them all to one scan.
  scanId: z.string().uuid().optional(),
  frameworks: z.array(z.string().max(50)).max(50).optional(),
  findings: z.array(agentFindingSchema).min(1).max(500),
});

const syncBodySchema = z.object({
  // Command ids the agent has applied; we mark them acked.
  ackedCommandIds: z.array(z.string().uuid()).max(200).optional(),
  // Opaque agent state snapshot (no secrets); bounded so it cannot be abused.
  state: z.record(z.string(), z.unknown()).optional(),
  status: z.string().max(100).optional(),
});

// Normalize an mTLS fingerprint to the canonical uppercase, colon-free hex form
// the mtls plugin stores/compares (computeFingerprint() in plugins/mtls.ts).
function normalizeFingerprint(fp: string): string {
  return fp.replace(/:/g, "").toUpperCase();
}

export const agentRoutes: FastifyPluginAsync = async (app) => {
  const superDb = (app as unknown as { superDb: SuperDb }).superDb;
  // Owner/admin issue enrollments; standard JWT/role auth + RLS-bound request.db.
  const ownerOrAdmin = (app as any).requireRole("owner", "admin");

  // -------------------------------------------------------------------------
  // Agent bearer-token authentication (constant-work) + optional mTLS pin.
  //
  // Used as a preHandler on every agent-facing endpoint EXCEPT enroll (which is
  // human/admin-authenticated). On success it binds a per-request RLS context so
  // downstream queries run as the non-owner app_user with app.current_tenant set;
  // the reserved connection is released by app.ts's onResponse/onError hooks.
  // -------------------------------------------------------------------------
  async function authenticateAgent(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      request.log.warn(
        { event: "agent.auth.failure", reason: "missing_bearer", ip: request.ip },
        "Agent authentication failed",
      );
      throw unauthorized("Agent requires Bearer token authentication");
    }

    const rawToken = authHeader.slice(7).trim();
    const parsed = rawToken ? parseAgentToken(rawToken) : null;
    const fp256 = rawToken ? tokenFingerprint(rawToken) : "";

    // Resolve at most ONE candidate by the indexed prefix (constant work). A
    // malformed token still spends a dummy Argon2 verify below so timing is flat.
    let matched: EnrollmentRow | null = null;
    if (parsed) {
      const rows = (await superDb.execute(
        sql`SELECT id, tenant_id, created_by, token_hash, fingerprint, label, enabled
            FROM agent_enrollments
            WHERE token_prefix = ${parsed.prefix}
            LIMIT 1`,
      )) as EnrollmentRow[];
      const candidate = rows[0] ?? null;
      if (candidate && candidate.enabled) {
        try {
          if (await verifyPassword(candidate.token_hash, rawToken)) matched = candidate;
        } catch {
          // hash format mismatch — treat as no match
        }
      }
    }

    if (!matched) {
      // Spend one constant unit of Argon2 work on the failure path (timing channel).
      try {
        await verifyPassword(DUMMY_ARGON2_HASH, rawToken || "x");
      } catch {
        /* expected — dummy hash never matches */
      }
      request.log.warn(
        {
          event: "agent.auth.failure",
          reason: "invalid_token",
          structured: parsed != null,
          tokenFp: fp256 ? redactSecretString(fp256) : undefined,
          ip: request.ip,
        },
        "Agent authentication failed: invalid, disabled, or unknown token",
      );
      throw unauthorized("Invalid or disabled agent token");
    }

    // --- mTLS pin enforcement -------------------------------------------------
    // When the enrollment pinned a fingerprint, the request MUST present a client
    // certificate (surfaced by plugins/mtls.ts as request.clientCert.fingerprint)
    // whose fingerprint matches. Bearer + certificate must both check out.
    if (matched.fingerprint) {
      const presented = request.clientCert?.fingerprint
        ? normalizeFingerprint(request.clientCert.fingerprint)
        : null;
      const expected = normalizeFingerprint(matched.fingerprint);
      if (!presented || presented !== expected) {
        request.log.warn(
          {
            event: "agent.auth.mtls_mismatch",
            tenantId: matched.tenant_id,
            enrollmentId: matched.id,
            presented: Boolean(presented),
            ip: request.ip,
          },
          "Agent authentication failed: pinned client certificate missing or mismatched",
        );
        throw forbidden("Client certificate required and must match the enrolled fingerprint");
      }
    }

    // --- Bind a per-request RLS tenant context -------------------------------
    // No JWT auth ran for this request, so there is no request.db yet. Reserve a
    // dedicated connection, drop to the non-owner app_user role, and bind
    // app.current_tenant so every downstream agent query is RLS-enforced. The
    // global onResponse/onError hooks in app.ts RESET + release this connection.
    const appSql = (app as unknown as { appSql: any }).appSql;
    const conn = await appSql.reserve();
    try {
      await conn`SELECT set_config('app.current_tenant', ${matched.tenant_id}, false)`;
      await conn`SET ROLE app_user`;
    } catch (err) {
      conn.release();
      request.log.error(
        { event: "agent.rls.bind.failure", tenantId: matched.tenant_id },
        "Failed to bind agent tenant RLS context; denying request",
      );
      throw err;
    }
    request.rlsConn = conn;
    // drizzleReserved (not bare drizzle()) — postgres.js reserved connections lack
    // `.options` at runtime and drizzle 0.33 dereferences it at construction; see
    // db/connection.ts for the full story.
    request.db = drizzleReserved(conn, appSql);
    // Surface tenantId for the global http.timing/audit hooks (they read request.tenantId).
    (request as unknown as { tenantId: string }).tenantId = matched.tenant_id;

    request.agent = {
      enrollmentId: matched.id,
      tenantId: matched.tenant_id,
      createdBy: matched.created_by,
      label: matched.label,
    };

    // Fire-and-forget liveness bump; never blocks the request. Tenant-scoped via RLS.
    request.db
      .execute(
        sql`UPDATE agent_enrollments SET last_seen_at = now(), updated_at = now() WHERE id = ${matched.id}`,
      )
      .catch(() => {});

    request.log.info(
      { event: "agent.auth.success", tenantId: matched.tenant_id, enrollmentId: matched.id },
      "Agent authentication succeeded",
    );
  }

  // -------------------------------------------------------------------------
  // POST /api/agent/enroll — owner/admin issues a one-time agent token.
  // -------------------------------------------------------------------------
  app.post("/api/agent/enroll", { preHandler: [ownerOrAdmin] }, async (request, reply) => {
    const body = enrollBodySchema.parse(request.body);
    const db = request.db ?? app.db;

    // Mint `bfagent_<prefix>.<secret>`; persist only the Argon2 hash + indexed prefix.
    const tokenPrefix = randomBytes(PREFIX_BYTES).toString("base64url");
    const secret = randomBytes(SECRET_BYTES).toString("base64url");
    const rawToken = `${AGENT_TOKEN_PREFIX}${tokenPrefix}.${secret}`;
    const tokenHash = await hashPassword(rawToken);
    const fingerprint = body.fingerprint ? normalizeFingerprint(body.fingerprint) : null;

    const rows = (await db.execute(
      sql`INSERT INTO agent_enrollments
            (tenant_id, created_by, token_prefix, token_hash, fingerprint, label)
          VALUES
            (${request.tenantId}, ${request.userId}, ${tokenPrefix}, ${tokenHash}, ${fingerprint}, ${body.label ?? null})
          RETURNING id, label, fingerprint, enabled, created_at`,
    )) as Array<{
      id: string;
      label: string | null;
      fingerprint: string | null;
      enabled: boolean;
      created_at: string | Date;
    }>;
    const created = rows[0];

    request.log.info(
      {
        event: "agent.enroll",
        tenantId: request.tenantId,
        enrollmentId: created.id,
        mtlsPinned: Boolean(fingerprint),
      },
      "Agent enrollment issued",
    );

    // The raw token is returned EXACTLY ONCE and never persisted/logged.
    return reply.status(201).send({
      enrollment: {
        id: created.id,
        label: created.label,
        fingerprint: created.fingerprint,
        enabled: created.enabled,
        createdAt: created.created_at,
      },
      // One-time agent bearer token. Store it on the agent host; it cannot be retrieved again.
      token: rawToken,
      message: "Agent enrollment created. Store the token securely — it is shown only once.",
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/agent/heartbeat — liveness; last_seen_at already bumped in auth.
  // -------------------------------------------------------------------------
  app.post("/api/agent/heartbeat", { preHandler: [authenticateAgent] }, async (request) => {
    const body = heartbeatBodySchema.parse(request.body ?? {});
    const agent = request.agent!;

    request.log.info(
      {
        event: "agent.heartbeat",
        tenantId: agent.tenantId,
        enrollmentId: agent.enrollmentId,
        status: body.status,
        agentVersion: body.agentVersion,
      },
      "Agent heartbeat received",
    );

    // Report how many commands are waiting so the agent can decide whether to poll.
    const [{ pending }] = (await request.db!.execute(
      sql`SELECT count(*)::int AS pending FROM agent_commands
          WHERE enrollment_id = ${agent.enrollmentId} AND status = 'queued'`,
    )) as Array<{ pending: number }>;

    return { ok: true, enrollmentId: agent.enrollmentId, pendingCommands: pending };
  });

  // -------------------------------------------------------------------------
  // POST /api/agent/findings — ingest agent scan findings (tenant-scoped).
  // -------------------------------------------------------------------------
  app.post("/api/agent/findings", { preHandler: [authenticateAgent] }, async (request, reply) => {
    const body = findingsBodySchema.parse(request.body);
    const agent = request.agent!;
    const db = request.db!;

    // Resolve (or create) the scan the findings attach to. scans.triggered_by is a
    // NOT NULL FK to users — use the owner/admin who issued the enrollment. If the
    // agent supplied a scanId, verify it belongs to this tenant (RLS + explicit
    // predicate) before reusing it; otherwise open a fresh agent scan.
    let scanId = body.scanId ?? null;
    if (scanId) {
      const owned = (await db.execute(
        sql`SELECT id FROM scans WHERE id = ${scanId} AND tenant_id = ${agent.tenantId} LIMIT 1`,
      )) as Array<{ id: string }>;
      if (owned.length === 0) {
        throw badRequest("UNKNOWN_SCAN", "scanId does not belong to this tenant");
      }
    } else {
      const [scan] = await db
        .insert(scans)
        .values({
          tenantId: agent.tenantId,
          triggeredBy: agent.createdBy,
          frameworks: body.frameworks ?? [],
          targets: ["onprem_agent"],
          scanTypes: ["agent"],
          status: "running",
          progress: 0,
          startedAt: new Date(),
        })
        .returning({ id: scans.id });
      scanId = scan.id;
    }

    // Ingest via the finding service (idempotent upsert per dedup key, tenant-scoped).
    const findingService = new FindingService(db);
    let ingested = 0;
    for (const finding of body.findings) {
      await findingService.createFromAgent(scanId, agent.tenantId, finding);
      ingested += 1;
    }

    request.log.info(
      {
        event: "agent.findings.ingested",
        tenantId: agent.tenantId,
        enrollmentId: agent.enrollmentId,
        scanId,
        count: ingested,
      },
      "Agent findings ingested",
    );

    return reply.status(202).send({ scanId, ingested });
  });

  // -------------------------------------------------------------------------
  // GET /api/agent/commands — agent polls for queued commands.
  // Marks returned commands 'delivered' so they are not re-served; the agent acks
  // completion via POST /api/agent/sync (status -> 'acked').
  // -------------------------------------------------------------------------
  app.get("/api/agent/commands", { preHandler: [authenticateAgent] }, async (request) => {
    const agent = request.agent!;
    const db = request.db!;

    const rows = (await db.execute(
      sql`UPDATE agent_commands
          SET status = 'delivered', delivered_at = now()
          WHERE id IN (
            SELECT id FROM agent_commands
            WHERE enrollment_id = ${agent.enrollmentId} AND status = 'queued'
            ORDER BY created_at ASC
            LIMIT 50
          )
          RETURNING id, command, payload, created_at`,
    )) as Array<{ id: string; command: string; payload: unknown; created_at: string | Date }>;

    if (rows.length > 0) {
      request.log.info(
        {
          event: "agent.commands.delivered",
          tenantId: agent.tenantId,
          enrollmentId: agent.enrollmentId,
          count: rows.length,
        },
        "Agent commands delivered",
      );
    }

    return {
      commands: rows.map((r) => ({
        id: r.id,
        command: r.command,
        payload: r.payload,
        createdAt: r.created_at,
      })),
    };
  });

  // -------------------------------------------------------------------------
  // POST /api/agent/sync — state sync; ack delivered commands + report state.
  // -------------------------------------------------------------------------
  app.post("/api/agent/sync", { preHandler: [authenticateAgent] }, async (request) => {
    const body = syncBodySchema.parse(request.body ?? {});
    const agent = request.agent!;
    const db = request.db!;

    let acked = 0;
    if (body.ackedCommandIds && body.ackedCommandIds.length > 0) {
      // Tenant-scoped ack: RLS + the enrollment predicate ensure an agent can only
      // ack its OWN commands. Parameterized array; no raw interpolation.
      const result = (await db.execute(
        sql`UPDATE agent_commands
            SET status = 'acked', acked_at = now()
            WHERE enrollment_id = ${agent.enrollmentId}
              AND id = ANY(${body.ackedCommandIds}::uuid[])
              AND status <> 'acked'
            RETURNING id`,
      )) as Array<{ id: string }>;
      acked = result.length;
    }

    const [{ pending }] = (await db.execute(
      sql`SELECT count(*)::int AS pending FROM agent_commands
          WHERE enrollment_id = ${agent.enrollmentId} AND status = 'queued'`,
    )) as Array<{ pending: number }>;

    request.log.info(
      {
        event: "agent.sync",
        tenantId: agent.tenantId,
        enrollmentId: agent.enrollmentId,
        acked,
        // Only the KEYS of the reported state are logged (never the values), so no
        // agent-reported data can leak into logs.
        stateKeys: body.state ? Object.keys(body.state) : [],
        status: body.status,
      },
      "Agent state sync",
    );

    return { ok: true, acked, pendingCommands: pending };
  });
};
