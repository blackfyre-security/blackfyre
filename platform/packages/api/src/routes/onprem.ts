import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { scans } from "../db/schema.js";
import { badRequest } from "../utils/errors.js";
import { ScanService } from "../services/scan-service.js";
// SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — the on-prem AD/SNMP
// routes enqueued raw inline credentials (AD bindCredential, SNMP community/auth/priv keys)
// in integrations[].credentialRef via a DIRECT scanQueue.add(), bypassing the encryption
// that ScanService.create() applies. BullMQ retains failed jobs 30d, so those plaintext
// secrets sat in the clear on the queue. We now route through ScanService.create() (which
// envelope-encrypts inline secrets and strips plaintext) and, on the on-prem fallback path
// where there is no integration row for create() to emit, apply the SAME contract here:
// gate via isSafeCredentialRef(), AES-256-GCM encrypt the inline credentialRef into a
// credentialEnvelope, and STRIP the plaintext before enqueue. The worker/orchestrator
// reconstruct the plaintext at run time via ScanService.resolveCredentialRef(). Never log
// the secret.
import {
  EncryptionProviderService,
  type SecretEnvelope,
} from "../services/encryption-provider-service.js";

// SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — mirror of
// ScanService.isSafeCredentialRef(): a credentialRef is a SAFE, non-secret pointer ONLY
// when it is exactly an opaque vault:// / arn:aws:iam:: form AND does not parse as inline
// JSON secret material. Default deny — when in doubt, encrypt. On-prem refs are always
// JSON.stringify({...}) of inline secrets, so they correctly fall through to encryption.
function isSafeCredentialRef(ref: string): boolean {
  const trimmed = ref.trim();
  const isPointer =
    trimmed.startsWith("vault://") || trimmed.startsWith("arn:aws:iam::");
  if (!isPointer) return false;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed !== null && typeof parsed === "object") return false;
  } catch {
    // Not JSON — a bare pointer string, which is the expected safe shape.
  }
  return true;
}

/**
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — build a queue-safe
 * integration entry from an inline on-prem credentialRef. Inline secret material is
 * envelope-encrypted into `credentialEnvelope` and the plaintext `credentialRef` is replaced
 * by a non-secret pointer (the synthetic on-prem integration id) so no plaintext is ever
 * enqueued/persisted. Safe pointer refs pass through untouched. Never logs the secret.
 */
function buildEncryptedOnpremIntegration(
  id: string,
  type: string,
  credentialRef: string,
): { id: string; type: string; credentialRef: string; credentialEnvelope?: SecretEnvelope } {
  if (isSafeCredentialRef(credentialRef)) {
    return { id, type, credentialRef };
  }
  const credentialEnvelope = new EncryptionProviderService().encryptSecret(credentialRef);
  return {
    // Reference only — the synthetic on-prem integration id; never raw secret material.
    id,
    type,
    credentialRef: id,
    credentialEnvelope,
  };
}

const adScanSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(389),
  baseDN: z.string().min(1),
  bindDN: z.string().min(1),
  bindCredential: z.string().min(1),
  useTLS: z.boolean().default(false),
  frameworks: z.array(z.string()).default([]),
});

const snmpScanSchema = z.object({
  targets: z.array(z.string()).min(1).max(50),
  version: z.enum(["v2c", "v3"]),
  community: z.string().optional(),
  auth: z.object({
    user: z.string(),
    authProtocol: z.enum(["SHA", "MD5"]),
    authKey: z.string(),
    privProtocol: z.enum(["AES", "DES"]).optional(),
    privKey: z.string().optional(),
  }).optional(),
  frameworks: z.array(z.string()).default([]),
});

export const onpremRoutes: FastifyPluginAsync = async (app) => {
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");

  // POST /api/scans/ad — trigger an Active Directory audit scan
  app.post("/api/scans/ad", { preHandler: [adminOrEngineer] }, async (request, reply) => {
    const body = adScanSchema.parse(request.body);

    // Encode the AD config as the credentialRef for the scan job
    const credentialRef = JSON.stringify({
      host: body.host,
      port: body.port,
      baseDN: body.baseDN,
      bindDN: body.bindDN,
      bindCredential: body.bindCredential,
      useTLS: body.useTLS,
    });

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — route through
    // ScanService.create() (logger passed so credential binding is audited; never the
    // secret) so that when an active_directory integration EXISTS its credentials are
    // envelope-encrypted by the service contract instead of being enqueued in the clear.
    const service = new ScanService(app.db, app.scanQueue, app.log);
    const scan = await service.create(request.tenantId, request.userId, {
      frameworks: body.frameworks,
      targets: ["active_directory"],
    }).catch(async (err) => {
      // If no active integration for active_directory, create a direct on-prem scan
      if (err?.code === "SCAN_LIMIT_REACHED") throw err;
      // Fall through: on-prem scans bypass integration check via direct credential ref
      const [row] = await app.db
        .insert(scans)
        .values({
          tenantId: request.tenantId,
          triggeredBy: request.userId,
          frameworks: body.frameworks,
          targets: ["active_directory"],
          status: "queued",
          progress: 0,
        })
        .returning();

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — encrypt the inline
      // AD credentialRef and strip the plaintext before enqueue, mirroring ScanService's
      // contract. The worker decrypts via ScanService.resolveCredentialRef() at run time.
      const integration = buildEncryptedOnpremIntegration(
        `onprem-ad-${row.id}`,
        "active_directory",
        credentialRef,
      );
      app.log.info(
        {
          event: "scan.credential_ref.bound",
          tenantId: request.tenantId,
          scanId: row.id,
          target: "active_directory",
          encrypted: Boolean(integration.credentialEnvelope),
          keyId: integration.credentialEnvelope?.keyId,
        },
        "bound on-prem AD credential reference for scan job (inline secret encrypted)",
      );

      await app.scanQueue.add(`scan-${row.id}`, {
        scanId: row.id,
        tenantId: request.tenantId,
        frameworks: body.frameworks,
        targets: ["active_directory"],
        triggeredBy: request.userId,
        integrations: [integration],
      });

      return row;
    });

    return reply.status(202).send({
      scan,
      message: "Active Directory audit scan queued for processing",
    });
  });

  // POST /api/scans/snmp — trigger an SNMP network audit scan
  app.post("/api/scans/snmp", { preHandler: [adminOrEngineer] }, async (request, reply) => {
    const body = snmpScanSchema.parse(request.body);

    if (body.version === "v2c" && !body.community) {
      throw badRequest("MISSING_COMMUNITY", "SNMP v2c requires a community string");
    }
    if (body.version === "v3" && !body.auth) {
      throw badRequest("MISSING_AUTH", "SNMP v3 requires authentication configuration");
    }

    const credentialRef = JSON.stringify({
      targets: body.targets,
      version: body.version,
      community: body.community,
      auth: body.auth,
    });

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — route through
    // ScanService.create() (logger passed for audit; never the secret) so an existing snmp
    // integration's credentials are envelope-encrypted by the service contract rather than
    // enqueued in the clear.
    const service = new ScanService(app.db, app.scanQueue, app.log);
    const scan = await service.create(request.tenantId, request.userId, {
      frameworks: body.frameworks,
      targets: ["snmp"],
    }).catch(async (err) => {
      if (err?.code === "SCAN_LIMIT_REACHED") throw err;
      // Fall through: on-prem SNMP scans bypass the integration check via direct cred ref.
      const [row] = await app.db
        .insert(scans)
        .values({
          tenantId: request.tenantId,
          triggeredBy: request.userId,
          frameworks: body.frameworks,
          targets: ["snmp"],
          status: "queued",
          progress: 0,
        })
        .returning();

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — encrypt the inline
      // SNMP credentialRef (community / auth / priv keys) and strip the plaintext before
      // enqueue. The worker decrypts via ScanService.resolveCredentialRef() at run time.
      const integration = buildEncryptedOnpremIntegration(
        `onprem-snmp-${row.id}`,
        "snmp",
        credentialRef,
      );
      app.log.info(
        {
          event: "scan.credential_ref.bound",
          tenantId: request.tenantId,
          scanId: row.id,
          target: "snmp",
          encrypted: Boolean(integration.credentialEnvelope),
          keyId: integration.credentialEnvelope?.keyId,
        },
        "bound on-prem SNMP credential reference for scan job (inline secret encrypted)",
      );

      await app.scanQueue.add(`scan-${row.id}`, {
        scanId: row.id,
        tenantId: request.tenantId,
        frameworks: body.frameworks,
        targets: ["snmp"],
        triggeredBy: request.userId,
        integrations: [integration],
      });

      return row;
    });

    return reply.status(202).send({
      scan,
      message: "SNMP network audit scan queued for processing",
    });
  });

  // GET /api/scans/onprem/status — on-prem scan status summary for the tenant
  app.get("/api/scans/onprem/status", { preHandler: [adminOrEngineer] }, async (request) => {
    const onpremTargets = ["active_directory", "ad", "snmp", "network_device"];

    // Count scans by status for on-prem target types
    const recentScans = await app.db
      .select()
      .from(scans)
      .where(
        and(
          eq(scans.tenantId, request.tenantId),
          sql`${scans.targets} && ARRAY[${onpremTargets.map((t) => `'${t}'`).join(",")}]::text[]`,
        ),
      )
      .orderBy(scans.startedAt)
      .limit(50);

    const statusCounts: Record<string, number> = {};
    for (const scan of recentScans) {
      statusCounts[scan.status] = (statusCounts[scan.status] ?? 0) + 1;
    }

    const lastAd = recentScans
      .filter((s) => Array.isArray(s.targets) && s.targets.some((t) => ["active_directory", "ad"].includes(t)))
      .at(-1);

    const lastSnmp = recentScans
      .filter((s) => Array.isArray(s.targets) && s.targets.some((t) => ["snmp", "network_device"].includes(t)))
      .at(-1);

    return {
      summary: {
        totalScans: recentScans.length,
        statusBreakdown: statusCounts,
        lastAdScan: lastAd
          ? { id: lastAd.id, status: lastAd.status, startedAt: lastAd.startedAt, progress: lastAd.progress }
          : null,
        lastSnmpScan: lastSnmp
          ? { id: lastSnmp.id, status: lastSnmp.status, startedAt: lastSnmp.startedAt, progress: lastSnmp.progress }
          : null,
      },
      scans: recentScans.map((s) => ({
        id: s.id,
        targets: s.targets,
        status: s.status,
        progress: s.progress,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
    };
  });
};
