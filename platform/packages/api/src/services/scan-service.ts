import { eq, and, desc, count, sql } from "drizzle-orm";
import { scans } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { IntegrationService } from "./integration-service.js";
import { notFound, badRequest } from "../utils/errors.js";
import { SqsQueue } from "../queue/sqs-client.js";
import type { ScanJobData } from "../queue/scan-queue.js";
import {
  EncryptionProviderService,
  type SecretEnvelope,
} from "./encryption-provider-service.js";
import { redactCredentials } from "../lib/redact.js";

// Max concurrent scans per tenant (spec Section 11)
const MAX_CONCURRENT_SCANS_PER_TENANT = 3;

// SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext cloud creds on the scan queue —
// a credentialRef is a SAFE, non-secret pointer ONLY when it is exactly one of these
// allow-listed pointer forms. EVERYTHING ELSE is treated as inline secret material and
// MUST be envelope-encrypted before it goes on the queue so it is never persisted in the
// clear (BullMQ keeps failed jobs 30d).
//
// SECURITY FIX (BLACKFYRE audit 2026-06-05) fix-up: the previous check only matched the
// `vault://` / `arn:aws:iam::` prefixes, so a stringified JSON blob of inline secrets
// (e.g. the on-prem AD/SNMP credentialRef = JSON.stringify({ bindCredential, ... })) was
// NOT a recognised pointer and correctly fell through to encryption — but a malformed or
// schemeless raw secret could also slip by depending on caller assumptions. We now make
// the contract explicit and fail safe: (1) only the two opaque pointer schemes are safe;
// (2) any value that JSON.parses to an object/array is definitively inline material and is
// NEVER safe. Default deny — when in doubt, encrypt.
function isSafeCredentialRef(ref: string): boolean {
  const trimmed = ref.trim();
  // Allow-list: opaque, non-secret pointers only.
  const isPointer =
    trimmed.startsWith("vault://") || trimmed.startsWith("arn:aws:iam::");
  if (!isPointer) return false;
  // Defense-in-depth: a value that also parses as a JSON object/array is inline secret
  // material masquerading as a pointer — treat it as unsafe so it gets encrypted.
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed !== null && typeof parsed === "object") return false;
  } catch {
    // Not JSON — a bare pointer string, which is the expected safe shape.
  }
  return true;
}

/** Minimal structured-logger shape (Fastify/pino compatible). */
type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

export class ScanService {
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext cloud creds on the scan queue —
  // optional structured logger so credential-reference resolution / encryption can be
  // recorded at info without leaking secrets. Defaulted to a no-op to keep every existing
  // 2-arg `new ScanService(db, queue)` call site building unchanged (back-compat).
  private readonly log: Logger;

  constructor(
    private db: Db,
    private scanQueue: SqsQueue<ScanJobData>,
    log?: Logger,
  ) {
    this.log = log ?? { info: () => {}, warn: () => {} };
  }

  /**
   * Create a new scan and enqueue it for processing.
   * Returns the scan record immediately (spec: < 500ms response).
   */
  async create(tenantId: string, triggeredBy: string, data: {
    frameworks: string[];
    targets: string[];
    scanTypes?: string[];
    repoSource?: {
      provider: string;
      repoUrl: string;
      branch?: string;
      credentialRef?: string;
      credentialEnvelope?: SecretEnvelope;
    } | null;
  }) {
    // Check concurrent scan limit
    const [{ active }] = await this.db
      .select({ active: count() })
      .from(scans)
      .where(
        and(
          eq(scans.tenantId, tenantId),
          sql`${scans.status} IN ('queued', 'running')`,
        )
      );

    if (active >= MAX_CONCURRENT_SCANS_PER_TENANT) {
      throw badRequest(
        "SCAN_LIMIT_REACHED",
        `Maximum ${MAX_CONCURRENT_SCANS_PER_TENANT} concurrent scans allowed per tenant`,
      );
    }

    // Verify integrations exist for requested targets
    const integrationService = new IntegrationService(this.db);
    const activeIntegrations = await integrationService.getActiveForTenant(tenantId, data.targets);

    if (activeIntegrations.length === 0) {
      throw badRequest(
        "NO_INTEGRATIONS",
        "No active integrations found for the requested targets. Add integrations first.",
      );
    }

    const scanTypes = data.scanTypes ?? ["quick"];

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext cloud creds on the scan queue —
    // do NOT enqueue (or persist) raw credential material. Inline secret material is
    // AES-256-GCM envelope-encrypted via EncryptionProviderService.encryptSecret() so the
    // persisted job (retained 30d on failure) AND the scans.repoSource JSONB column carry
    // no plaintext. The worker resolves the reference + decrypts the envelope at run time.
    // Already-safe pointer refs (vault:// / arn:aws:iam::) pass through untouched. We log
    // the reference-binding at info (counts only, never the secret) so credential
    // resolution is auditable.
    const encryptionProvider = new EncryptionProviderService();

    // SECURITY FIX (BLACKFYRE audit 2026-06-05) fix-up: repoSource encryption path —
    // the on-prem AD/SNMP routes (and any repo-clone integration) pass inline secret
    // material in repoSource.credentialRef (e.g. AD bindCredential, SNMP community/auth
    // keys, git PAT). Previously repoSource was persisted to the DB and enqueued VERBATIM,
    // leaking those plaintext secrets into the scans table and onto the queue. We now run
    // repoSource.credentialRef through the SAME isSafeCredentialRef() + encryptSecret()
    // gate as integration creds: inline material is envelope-encrypted into
    // repoSource.credentialEnvelope and the plaintext credentialRef is stripped before the
    // value is ever persisted (DB insert) or enqueued (queue.add). The worker decrypts via
    // ScanService.resolveCredentialRef-style decryption at run time. Safe pointer refs pass
    // through untouched.
    let repoSourceEncrypted = false;
    const sourceRepo = data.repoSource ?? null;
    let queueRepoSource: ScanJobData["repoSource"] = sourceRepo;
    if (sourceRepo && sourceRepo.credentialRef && !isSafeCredentialRef(sourceRepo.credentialRef)) {
      const credentialEnvelope: SecretEnvelope = encryptionProvider.encryptSecret(
        sourceRepo.credentialRef,
      );
      queueRepoSource = {
        provider: sourceRepo.provider,
        repoUrl: sourceRepo.repoUrl,
        branch: sourceRepo.branch,
        // Plaintext stripped — only the encrypted envelope is persisted/enqueued.
        credentialEnvelope,
      };
      repoSourceEncrypted = true;
    }

    // Create scan record — persist the ENCRYPTED repoSource so the scans JSONB column never
    // holds plaintext credential material.
    const [scan] = await this.db
      .insert(scans)
      .values({
        tenantId,
        triggeredBy,
        frameworks: data.frameworks,
        targets: data.targets,
        scanTypes,
        status: "queued",
        progress: 0,
        repoSource: queueRepoSource ?? null,
      })
      .returning();

    // For each integration we enqueue only a non-secret reference; inline secret material
    // is envelope-encrypted (same contract as repoSource above).
    let encryptedCount = 0;
    const queueIntegrations = activeIntegrations.map((i) => {
      if (isSafeCredentialRef(i.credentialRef)) {
        // Already an opaque pointer — safe to persist as-is, no envelope needed.
        return { id: i.id, type: i.type, credentialRef: i.credentialRef };
      }
      // Inline secret material — encrypt it and strip the plaintext from the payload.
      const credentialEnvelope: SecretEnvelope = encryptionProvider.encryptSecret(
        i.credentialRef,
      );
      encryptedCount += 1;
      return {
        id: i.id,
        type: i.type,
        // Reference only — the integration id; never raw secret material.
        credentialRef: i.id,
        credentialEnvelope,
      };
    });

    this.log.info(
      {
        event: "scan.credential_ref.bound",
        tenantId,
        scanId: scan.id,
        integrationCount: queueIntegrations.length,
        encryptedInlineCount: encryptedCount,
        // Whether inline repoSource credential material was envelope-encrypted (boolean
        // only — never the secret or the envelope contents).
        repoSourceEncrypted,
        keyId: encryptionProvider.primaryKeyId,
      },
      "bound integration + repoSource credential references for scan job (inline secrets encrypted)",
    );

    // Enqueue job in SQS — repoSource is the ENCRYPTED variant (queueRepoSource), so no
    // plaintext credential material is ever placed on the queue.
    await this.scanQueue.add(`scan-${scan.id}`, {
      scanId: scan.id,
      tenantId,
      frameworks: data.frameworks,
      targets: data.targets,
      scanTypes,
      triggeredBy,
      integrations: queueIntegrations,
      repoSource: queueRepoSource ?? null,
    });

    return scan;
  }

  /**
   * Resolve a queued integration credential to its plaintext credentialRef at run time.
   *
   * @internal WORKER/AGENT-ONLY. This decrypts secret material and MUST NOT be called from
   * HTTP route handlers or any code path that returns data to a client — doing so would
   * surface plaintext credentials in an API response. It is intended to be invoked by the
   * scan workers (queue/scan-worker.ts, workers/scan-worker.ts) and the swarm orchestrator
   * immediately before handing credentials to an agent, so decryption is centralized at the
   * single run-time boundary where agents actually need plaintext.
   *
   * SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext cloud creds on the scan queue —
   * the worker calls this instead of trusting the on-queue value. If the integration
   * carried an encrypted envelope, it is decrypted here (fail closed on bad keyId/tag);
   * otherwise the safe pointer ref is returned as-is. Logs the resolution at info via the
   * supplied logger (never the secret) so credential access is auditable.
   *
   * SECURITY FIX (BLACKFYRE audit 2026-06-05) fix-up: documented as worker-only so routes
   * never decrypt; routes redact (redactCredentials) rather than resolve.
   */
  static resolveCredentialRef(
    integration: { id: string; type: string; credentialRef: string; credentialEnvelope?: SecretEnvelope },
    log?: Logger,
  ): string {
    if (!integration.credentialEnvelope) {
      log?.info(
        {
          event: "scan.credential_ref.resolve",
          integrationId: integration.id,
          integrationType: integration.type,
          source: "pointer",
        },
        "resolved integration credential reference (pointer)",
      );
      return integration.credentialRef;
    }

    const provider = new EncryptionProviderService();
    const plaintext = provider.decryptSecret(integration.credentialEnvelope);
    log?.info(
      {
        event: "scan.credential_ref.resolve",
        integrationId: integration.id,
        integrationType: integration.type,
        source: "envelope",
        keyId: integration.credentialEnvelope.keyId,
        // Defense-in-depth: redact any accidental object logging; the plaintext itself
        // is NEVER logged.
        envelope: redactCredentials({ keyId: integration.credentialEnvelope.keyId }),
      },
      "decrypted integration credential reference (envelope) at scan run time",
    );
    return plaintext;
  }

  async list(tenantId: string, filters: {
    status?: string;
    limit: number;
    offset: number;
  }) {
    const conditions = [eq(scans.tenantId, tenantId)];
    if (filters.status) conditions.push(eq(scans.status, filters.status as any));

    const rows = await this.db
      .select()
      .from(scans)
      .where(and(...conditions))
      .orderBy(desc(scans.startedAt))
      .limit(filters.limit)
      .offset(filters.offset);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(scans)
      .where(and(...conditions));

    return { scans: rows, total };
  }

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): Scans IDOR — getById resolved a scan by
  // primary key with NO tenant predicate, letting any authenticated tenant read another
  // tenant's scan (cross-tenant disclosure / enumeration). The tenantId is now a REQUIRED
  // argument and is part of the WHERE clause, so a scan belonging to another tenant is
  // indistinguishable from a missing one (404). request.db RLS is the primary control;
  // this predicate is defense-in-depth for any caller on the owner pool (workers).
  async getById(id: string, tenantId: string) {
    const [scan] = await this.db
      .select()
      .from(scans)
      .where(and(eq(scans.id, id), eq(scans.tenantId, tenantId)))
      .limit(1);

    if (!scan) throw notFound("Scan");
    return scan;
  }

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): Scans IDOR — cancel resolved + mutated a
  // scan by id only, allowing cross-tenant denial-of-service (cancelling another tenant's
  // running scan). Both the existence check and the UPDATE are now tenant-scoped.
  async cancel(id: string, tenantId: string) {
    const scan = await this.getById(id, tenantId);

    if (!["queued", "running"].includes(scan.status)) {
      throw badRequest("INVALID_STATE", `Cannot cancel scan in "${scan.status}" state`);
    }

    const [updated] = await this.db
      .update(scans)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(and(eq(scans.id, id), eq(scans.tenantId, tenantId)))
      .returning();

    return updated;
  }

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): Scans IDOR — the PATCH /api/scans/:id route
  // built its UPDATE with `eq(scans.id, id)` only, so an admin in tenant A could mutate
  // (or null out / mark failed) tenant B's scan by guessing its id. This tenant-scoped
  // update funnels that mutation through a tenantId predicate; a scan in another tenant is
  // not found (404) rather than silently updated.
  async updateForTenant(
    id: string,
    tenantId: string,
    updateData: Record<string, unknown>,
  ) {
    const [updated] = await this.db
      .update(scans)
      .set(updateData)
      .where(and(eq(scans.id, id), eq(scans.tenantId, tenantId)))
      .returning();

    if (!updated) throw notFound("Scan");
    return updated;
  }

  /**
   * Update scan progress. Called by the scan worker during execution.
   */
  async updateProgress(id: string, progress: number) {
    await this.db
      .update(scans)
      .set({ progress })
      .where(eq(scans.id, id));
  }

  /**
   * Mark scan as running. Called when the worker picks up the job.
   */
  async markRunning(id: string, agentSwarmId: string) {
    await this.db
      .update(scans)
      .set({
        status: "running",
        startedAt: new Date(),
        agentSwarmId,
      })
      .where(eq(scans.id, id));
  }

  /**
   * Mark scan as completed. Called when all agents finish.
   */
  async markCompleted(id: string, hasErrors: boolean) {
    await this.db
      .update(scans)
      .set({
        status: hasErrors ? "completed_partial" : "completed",
        progress: 100,
        completedAt: new Date(),
      })
      .where(eq(scans.id, id));
  }

  /**
   * Mark scan as failed. Called when the entire scan fails.
   */
  async markFailed(id: string, errorDetails: string) {
    await this.db
      .update(scans)
      .set({
        status: "failed",
        errorDetails,
        completedAt: new Date(),
      })
      .where(eq(scans.id, id));
  }
}
