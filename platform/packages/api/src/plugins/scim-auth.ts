import fp from "fastify-plugin";
import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
// @node-rs/argon2 (Rust, prebuilt per-platform binaries) — the rest of the API
// uses it (utils/password.ts). The old native `argon2` package has no prebuild
// for the Node 24 Lambda runtime and crashed the bundle on init; verify() has
// the same (hash, password) => Promise<boolean> signature and reads the same
// argon2id PHC hashes, so this is a drop-in swap.
import { verify as argon2Verify } from "@node-rs/argon2";
import { tenants } from "../db/schema.js";
import { unauthorized, forbidden } from "../utils/errors.js";
import { redactSecretString } from "../lib/redact.js";

export interface ScimTenant {
  id: string;
  plan: string;
}

export interface ScimTokenMeta {
  id: string;
  name: string;
}

declare module "fastify" {
  interface FastifyRequest {
    scimTenant: ScimTenant;
    scimToken: ScimTokenMeta;
  }
  interface FastifyInstance {
    scimAuthenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

// app cast to any to access superDb which is decorated in app.ts
type AppWithSuperDb = FastifyInstance & { superDb: any };

// ---------------------------------------------------------------------------
// SECURITY FIX (BLACKFYRE audit 2026-06-05): SCIM token auth DoS + timing
// channel — the previous implementation Argon2-verified the presented bearer
// token against EVERY non-revoked tenant token on EVERY request. An attacker
// could (a) exhaust CPU/memory by forcing N expensive Argon2 verifications per
// request (amplified by request volume), and (b) infer how many tokens exist /
// mount a timing oracle from the variable amount of hashing performed.
//
// The fix narrows verification to a SINGLE candidate before hashing:
//   * Structured tokens of the form `bfscim_<rowId>.<secret>` are looked up by
//     the indexed primary key `id` (constant work — exactly one Argon2 verify).
//   * Legacy opaque tokens fall back to a BOUNDED scan capped at
//     MAX_LEGACY_CANDIDATES verifications per request, so a single request can
//     never trigger unbounded hashing regardless of how many tokens exist.
// A short-lived, size-bounded success cache (keyed by a SHA-256 of the token,
// never the token itself) lets repeat requests with the same valid token skip
// Argon2 entirely. We always perform exactly one Argon2 verify on the failure
// path (against a stable dummy hash) to flatten the timing channel.
// ---------------------------------------------------------------------------

// Structured SCIM token prefix. New tokens SHOULD be minted as
// `bfscim_<scim_tokens.id>.<random-secret>` so authentication is single-row.
const STRUCTURED_PREFIX = "bfscim_";
// Hard ceiling on Argon2 verifications for legacy (unstructured) tokens. Bounds
// per-request work so the route cannot be used as a CPU-amplification vector.
const MAX_LEGACY_CANDIDATES = 25;
// Stable, REAL argon2id hash (of a throwaway value) used to spend a constant
// amount of KDF work on the failure path so a miss costs roughly the same as a
// hit (timing-channel mitigation). Verifying any presented token against it
// runs the full KDF and simply returns false — it is not a credential.
const DUMMY_ARGON2_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$EJlQdE//RlBEPNDZND2RxQ$qcElnoTz+cOv7s+ZwafPASDrHcNdsVJ4nlxnE6R+TMk";

// REAL IMPL (BLACKFYRE 2026-06): the SCIM success cache moved from a per-instance
// in-memory Map to the SHARED `app.redis` store (decorated in Wave 0). Behind
// multiple Lambda instances the in-memory cache only ever sped up requests that
// happened to hit the same warm instance; the shared store makes a verified token
// fast on EVERY instance. The cache is keyed by sha256(token) (never the raw token)
// and carries a SHORT TTL so a revoked token cannot stay valid for long. This is a
// POSITIVE cache only: a Redis miss / null client / error degrades gracefully to the
// full Argon2 verification path below — it never grants access on its own.
const VERIFY_CACHE_TTL_MS = 60_000;
// Redis key namespace for the SCIM verify cache. The value after the prefix is the
// non-reversible sha256 fingerprint of the token, so the raw secret never lands here.
const VERIFY_CACHE_PREFIX = "scim:verify:";

interface VerifyCacheEntry {
  tokenId: string;
  tenantId: string;
  name: string;
}

function tokenFingerprint(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// REAL IMPL (BLACKFYRE 2026-06): read the verified-token cache from Redis. Returns null
// (forcing full Argon2 verification) when the store is unavailable or on any error —
// a positive cache that fails OPEN to re-verification is safe (it cannot admit a bad
// token; the verification path still gates access). Never logs the token or its hash.
async function cacheGet(app: AppWithSuperDb, key: string): Promise<VerifyCacheEntry | null> {
  const redis = app.redis;
  if (!redis) return null;
  try {
    const raw = await redis.get(`${VERIFY_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VerifyCacheEntry;
    if (!parsed?.tokenId || !parsed?.tenantId) return null;
    return parsed;
  } catch {
    return null;
  }
}

// REAL IMPL (BLACKFYRE 2026-06): populate the verified-token cache in Redis with a
// short TTL (SET ... PX) so subsequent requests with the same valid token skip Argon2,
// while a revoked token self-expires quickly. Best-effort: a store error never blocks
// the request (the caller has already authenticated). Never stores the raw token.
async function cacheSet(app: AppWithSuperDb, key: string, entry: VerifyCacheEntry): Promise<void> {
  const redis = app.redis;
  if (!redis) return;
  try {
    await redis.set(
      `${VERIFY_CACHE_PREFIX}${key}`,
      JSON.stringify(entry),
      "PX",
      VERIFY_CACHE_TTL_MS,
    );
  } catch {
    // Caching is a best-effort optimization; never fail the request on a cache write.
  }
}

/** Parse the indexed row id out of a structured `bfscim_<id>.<secret>` token. */
function parseStructuredTokenId(rawToken: string): string | null {
  if (!rawToken.startsWith(STRUCTURED_PREFIX)) return null;
  const rest = rawToken.slice(STRUCTURED_PREFIX.length);
  const dot = rest.indexOf(".");
  if (dot <= 0 || dot === rest.length - 1) return null;
  const id = rest.slice(0, dot);
  // Constrain to a UUID so the value is safe to use as an indexed lookup key.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return id;
}

export default fp(async (appRaw: FastifyInstance) => {
  const app = appRaw as unknown as AppWithSuperDb;

  /**
   * preHandler for all SCIM routes.
   * 1. Extracts Bearer token from Authorization header.
   * 2. Resolves a SINGLE candidate token (structured prefix → indexed PK lookup;
   *    otherwise a bounded scan) using superDb to bypass RLS (pre-auth lookup).
   * 3. Verifies the argon2 hash of only that candidate.
   * 4. Confirms the tenant's plan is "defend".
   * 5. Sets req.scimTenant and req.scimToken.
   */
  appRaw.decorate(
    "scimAuthenticate",
    async function scimAuthenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        // SECURITY FIX (BLACKFYRE audit 2026-06-05): log SCIM auth failures at
        // warn for anomaly detection. No token value is present to redact here.
        request.log.warn(
          { event: "scim.auth.failure", reason: "missing_bearer", ip: request.ip },
          "SCIM authentication failed",
        );
        throw unauthorized("SCIM requires Bearer token authentication");
      }

      const rawToken = authHeader.slice(7).trim();
      if (!rawToken) {
        request.log.warn(
          { event: "scim.auth.failure", reason: "empty_bearer", ip: request.ip },
          "SCIM authentication failed",
        );
        throw unauthorized("Bearer token is empty");
      }

      type TokenRow = { id: string; tenant_id: string; token_hash: string; name: string };

      // The SHA-256 fingerprint is the cache key and the redacted log identifier.
      // It is non-reversible — the raw token is never logged or cached.
      const fp256 = tokenFingerprint(rawToken);
      let matched: TokenRow | null = null;

      // --- 0. Shared success cache (skips Argon2 for repeat valid tokens) -----
      const cached = await cacheGet(app, fp256);
      if (cached) {
        matched = {
          id: cached.tokenId,
          tenant_id: cached.tenantId,
          token_hash: "",
          name: cached.name,
        };
      }

      // --- 1. Structured-token fast path: single indexed PK lookup ------------
      const structuredId = matched ? null : parseStructuredTokenId(rawToken);
      if (structuredId) {
        const rows: TokenRow[] = await app.superDb.execute(
          sql`SELECT id, tenant_id, token_hash, name FROM scim_tokens
              WHERE id = ${structuredId} AND revoked_at IS NULL LIMIT 1`,
        );
        const candidate = rows[0] ?? null;
        if (candidate) {
          try {
            if (await argon2Verify(candidate.token_hash, rawToken)) matched = candidate;
          } catch {
            // hash format mismatch — treat as no match
          }
        }
      } else if (!matched) {
        // --- 2. Legacy opaque-token path: BOUNDED scan ------------------------
        // Cap the number of rows fetched AND verified so a single request cannot
        // trigger unbounded Argon2 work. Newly minted structured tokens take the
        // fast path above; this branch only covers pre-existing opaque tokens.
        const rows: TokenRow[] = await app.superDb.execute(
          sql`SELECT id, tenant_id, token_hash, name FROM scim_tokens
              WHERE revoked_at IS NULL
              ORDER BY last_used_at DESC NULLS LAST, created_at DESC
              LIMIT ${MAX_LEGACY_CANDIDATES}`,
        );
        for (const row of rows) {
          try {
            if (await argon2Verify(row.token_hash, rawToken)) {
              matched = row;
              break;
            }
          } catch {
            // hash format mismatch — skip
          }
        }
      }

      if (!matched) {
        // Spend one constant unit of Argon2 work on the failure path so a miss
        // is not measurably cheaper than a hit (timing-channel mitigation).
        try {
          await argon2Verify(DUMMY_ARGON2_HASH, rawToken);
        } catch {
          /* expected — dummy hash never matches */
        }
        request.log.warn(
          {
            event: "scim.auth.failure",
            reason: "invalid_token",
            structured: structuredId != null,
            tokenFp: redactSecretString(fp256),
            ip: request.ip,
          },
          "SCIM authentication failed: invalid or revoked token",
        );
        throw unauthorized("Invalid or revoked SCIM token");
      }

      // Load tenant and check plan (superDb: cross-tenant pre-auth lookup).
      const [tenant] = await app.superDb
        .select({ id: tenants.id, plan: tenants.plan })
        .from(tenants)
        .where(eq(tenants.id, matched.tenant_id))
        .limit(1);

      if (!tenant) {
        request.log.warn(
          { event: "scim.auth.failure", reason: "tenant_not_found", tokenId: matched.id, ip: request.ip },
          "SCIM authentication failed: tenant not found",
        );
        throw unauthorized("Tenant not found");
      }
      if (tenant.plan !== "defend") {
        request.log.warn(
          {
            event: "scim.auth.denied",
            reason: "plan_not_eligible",
            tenantId: tenant.id,
            plan: tenant.plan,
            ip: request.ip,
          },
          "SCIM provisioning denied: tenant not on Defend plan",
        );
        throw forbidden("SCIM provisioning requires the Defend plan");
      }

      // Populate the shared (Redis) success cache so subsequent requests with the
      // same valid token skip Argon2 entirely (short TTL bounds revocation staleness).
      await cacheSet(app, fp256, {
        tokenId: matched.id,
        tenantId: tenant.id,
        name: matched.name,
      });

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): record successful SCIM auth
      // at info (sensitive-but-normal access) with a redacted token fingerprint.
      request.log.info(
        { event: "scim.auth.success", tenantId: tenant.id, tokenId: matched.id, tokenName: matched.name },
        "SCIM authentication succeeded",
      );

      // Fire-and-forget last_used_at update
      app.superDb
        .execute(sql`UPDATE scim_tokens SET last_used_at = now() WHERE id = ${matched.id}`)
        .catch(() => {});

      request.scimTenant = { id: tenant.id, plan: tenant.plan };
      request.scimToken = { id: matched.id, name: matched.name };
    },
  );
}, { name: "scim-auth" });
