import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyInstance } from "fastify";
import { createHash } from "crypto";
import { sql } from "drizzle-orm";

// REAL IMPL (BLACKFYRE 2026-06): the allowlist is now durable in Postgres
// (mtls_fingerprints, migration 030). At boot the plugin loads the allowlist from
// the DB and — only when the table is empty — seeds it once from the
// MTLS_ALLOWED_FINGERPRINTS env var, after which the DB is the source of truth and
// certificates can be rotated without a redeploy. Verification behavior in the
// onRequest hook is UNCHANGED: it still consults an in-memory
// Map<tenantId, Set<fingerprint>>; only how that Map is populated has changed.

/** Minimal shape of the Drizzle handle this plugin needs (mirrors app.superDb). */
type DbHandle = { execute: (q: unknown) => Promise<any[]> };

/** Plugin options. `db` is OPTIONAL and defaults to app.superDb so existing
 *  callers (app.register(mtlsPlugin)) keep compiling and the export is stable. */
export interface MtlsPluginOptions {
  /** Override the DB handle (tests / alternate pools). Defaults to app.superDb,
   *  the owner pool that bypasses RLS — correct for the boot-time, cross-tenant,
   *  pre-auth load (no tenant context exists yet). */
  db?: DbHandle;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse MTLS_ALLOWED_FINGERPRINTS into a tenantId -> Set<fingerprint> map.
 * Format: <tenantId>:<fp1>,<fp2>;<tenantId2>:<fp3>
 */
function parseEnvAllowlist(raw: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const entry of raw.split(";").filter(Boolean)) {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) continue;
    const tenantId = entry.slice(0, colonIdx).trim();
    if (!tenantId) continue;
    const fps = entry
      .slice(colonIdx + 1)
      .split(",")
      .map((f) => f.trim().toUpperCase())
      .filter(Boolean);
    if (fps.length === 0) continue;
    out.set(tenantId, new Set(fps));
  }
  return out;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): load the durable allowlist from Postgres into an
 * in-memory Map. On first boot (empty table) seed from the env var, then re-read,
 * so the DB becomes the single source of truth. All queries are PARAMETERIZED and
 * run on the owner pool (bypasses RLS) because there is no tenant context at boot.
 * Failures are logged and degrade to the env-derived map so a transient DB issue
 * never silently disables (or hardens) verification differently than before.
 */
async function loadAllowlist(
  app: FastifyInstance,
  db: DbHandle,
  envRaw: string,
): Promise<Map<string, Set<string>>> {
  const log = app.log;

  // 1. Read what is persisted today (enabled fingerprints only).
  let rows: Array<{ tenant_id: string; fingerprint: string }>;
  try {
    rows = (await db.execute(
      sql`SELECT tenant_id, fingerprint
          FROM mtls_fingerprints
          WHERE enabled = true`,
    )) as Array<{ tenant_id: string; fingerprint: string }>;
  } catch (err) {
    log.error(
      { event: "mtls.allowlist.load_failed", err: (err as Error).message },
      "mTLS: failed to load fingerprint allowlist from DB — falling back to env",
    );
    return parseEnvAllowlist(envRaw);
  }

  // 2. First-boot seed: if the table is empty, persist the env entries once.
  if (rows.length === 0) {
    const envMap = parseEnvAllowlist(envRaw);
    if (envMap.size > 0) {
      let seeded = 0;
      let skipped = 0;
      for (const [tenantId, fps] of envMap) {
        // The table FK requires a real tenants.id (uuid). Skip non-UUID keys up
        // front so a malformed env entry cannot abort the whole seed.
        if (!UUID_RE.test(tenantId)) {
          skipped += fps.size;
          log.warn(
            { event: "mtls.allowlist.seed_skip", tenant_id: tenantId },
            "mTLS: skipping env allowlist entry with non-UUID tenant id during seed",
          );
          continue;
        }
        for (const fp of fps) {
          try {
            await db.execute(
              sql`INSERT INTO mtls_fingerprints (tenant_id, fingerprint, label)
                  VALUES (${tenantId}::uuid, ${fp}, ${"env-seed"})
                  ON CONFLICT (tenant_id, fingerprint) DO NOTHING`,
            );
            seeded += 1;
          } catch (err) {
            // Most likely an FK violation (tenant doesn't exist yet) — keep the
            // value in the in-memory map regardless so behavior is unchanged.
            skipped += 1;
            log.warn(
              {
                event: "mtls.allowlist.seed_skip",
                tenant_id: tenantId,
                reason: (err as Error).message,
              },
              "mTLS: could not persist env fingerprint during seed (kept in-memory)",
            );
          }
        }
      }
      log.info(
        { event: "mtls.allowlist.seeded", seeded, skipped },
        "mTLS: seeded fingerprint allowlist from env on first boot",
      );
    }
    // Use the env-derived map for THIS boot so behavior matches the prior code
    // even for entries the FK rejected (e.g. tenants provisioned later).
    return envMap;
  }

  // 3. Steady state: build the map purely from the durable table.
  const out = new Map<string, Set<string>>();
  for (const r of rows) {
    const tenantId = r.tenant_id;
    const fp = (r.fingerprint ?? "").toUpperCase();
    if (!tenantId || !fp) continue;
    let set = out.get(tenantId);
    if (!set) {
      set = new Set<string>();
      out.set(tenantId, set);
    }
    set.add(fp);
  }
  return out;
}

declare module "fastify" {
  interface FastifyRequest {
    clientCert?: {
      fingerprint: string;
      subject: string;
      issuer: string;
      validFrom: string;
      validTo: string;
      serialNumber: string;
    };
    mtlsVerified: boolean;
  }
}

const SKIP_PATHS = ["/health", "/healthz", "/ready", "/api/health"];

/**
 * Parse a PEM-encoded certificate from the X-Client-Cert header.
 * Load-balancers typically URL-encode the PEM and forward it as a header.
 */
function parsePemHeader(raw: string): string {
  // Some LBs (e.g. AWS ALB) URL-encode the cert
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Compute a SHA-256 fingerprint from a DER buffer or PEM string.
 * When the input is PEM, we hash the raw PEM bytes (consistent with what most
 * toolchains report as the cert fingerprint).
 */
function computeFingerprint(certData: string | Buffer): string {
  const data = typeof certData === "string" ? Buffer.from(certData) : certData;
  return createHash("sha256").update(data).digest("hex").toUpperCase();
}

const mtlsPlugin: FastifyPluginAsync<MtlsPluginOptions> = async (app, opts) => {
  const mtlsEnabled = process.env.MTLS_ENABLED === "true";
  const mtlsStrict = process.env.MTLS_STRICT === "true";

  // REAL IMPL (BLACKFYRE 2026-06): durable, per-tenant allowed-fingerprint map.
  // Loaded from Postgres (mtls_fingerprints) so certs can be rotated without a
  // redeploy; seeded ONCE from MTLS_ALLOWED_FINGERPRINTS on first boot when the
  // table is empty. The db handle is OPTIONAL and defaults to app.superDb (owner
  // pool, bypasses RLS) — correct for this boot-time, cross-tenant load that runs
  // before any request/tenant context exists. The verification hook below is
  // unchanged; only the source of this map moved from env to DB.
  const rawFpConfig = process.env.MTLS_ALLOWED_FINGERPRINTS ?? "";
  const db: DbHandle = opts?.db ?? (app as unknown as { superDb: DbHandle }).superDb;
  const allowedFingerprints = await loadAllowlist(app, db, rawFpConfig);
  app.log.info(
    {
      event: "mtls.allowlist.loaded",
      enabled: mtlsEnabled,
      strict: mtlsStrict,
      tenants: allowedFingerprints.size,
      fingerprints: [...allowedFingerprints.values()].reduce((n, s) => n + s.size, 0),
    },
    "mTLS: fingerprint allowlist loaded",
  );

  app.addHook("onRequest", async (request, reply) => {
    // Initialise to false on every request
    (request as any).mtlsVerified = false;

    // Skip mTLS enforcement if the feature is not enabled
    if (!mtlsEnabled) return;

    // Skip health/readiness probes — they never carry client certs
    const urlPath = request.url.split("?")[0];
    if (SKIP_PATHS.some((p) => urlPath === p || urlPath.startsWith(p + "/"))) return;

    // --- Extract certificate ---
    let pem: string | undefined;
    let rawFp: string | undefined;

    const headerCert = request.headers["x-client-cert"] as string | undefined;
    if (headerCert) {
      pem = parsePemHeader(headerCert);
      rawFp = computeFingerprint(pem);
    } else {
      // Direct TLS — attempt to read from the underlying socket
      const socket = (request.raw.socket as any);
      if (typeof socket?.getPeerCertificate === "function") {
        const cert = socket.getPeerCertificate(false);
        if (cert && cert.raw) {
          rawFp = computeFingerprint(cert.raw as Buffer);
          pem = undefined;

          // Populate structured cert info when available
          if (cert.subject || cert.issuer) {
            (request as any).clientCert = {
              fingerprint: rawFp,
              subject: JSON.stringify(cert.subject ?? {}),
              issuer: JSON.stringify(cert.issuer ?? {}),
              validFrom: cert.valid_from ?? "",
              validTo: cert.valid_to ?? "",
              serialNumber: cert.serialNumber ?? "",
            };
          }
        }
      }
    }

    if (!rawFp) {
      if (mtlsStrict) {
        app.log.warn({ url: request.url }, "mTLS: no client certificate presented — blocking");
        return reply.status(403).send({
          error: { code: "MTLS_REQUIRED", message: "Client certificate required" },
        });
      }
      return;
    }

    // Populate clientCert on request if not already set from socket path above
    if (!(request as any).clientCert) {
      (request as any).clientCert = {
        fingerprint: rawFp,
        subject: "",
        issuer: "",
        validFrom: "",
        validTo: "",
        serialNumber: "",
      };
    }

    // --- Verify against allowed fingerprints for this tenant ---
    // tenantId may not be set yet at onRequest stage (auth runs in preHandler),
    // so we do a best-effort check: if MTLS_ALLOWED_FINGERPRINTS is configured,
    // validate; otherwise just accept and mark verified.
    const tenantId = (request as any).tenantId as string | undefined;
    const tenantFps = tenantId ? allowedFingerprints.get(tenantId) : undefined;

    if (tenantFps && tenantFps.size > 0) {
      if (!tenantFps.has(rawFp)) {
        app.log.warn(
          { tenantId, fingerprint: rawFp, url: request.url },
          "mTLS: client certificate fingerprint not in tenant allowlist",
        );
        if (mtlsStrict) {
          return reply.status(403).send({
            error: { code: "MTLS_CERT_REJECTED", message: "Client certificate not authorised" },
          });
        }
        return;
      }
    }

    (request as any).mtlsVerified = true;
    app.log.debug({ fingerprint: rawFp }, "mTLS: client certificate verified");
  });
};

export default fp(mtlsPlugin, { name: "mtls" });
