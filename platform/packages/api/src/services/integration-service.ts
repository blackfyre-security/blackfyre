import { eq, and, count } from "drizzle-orm";
import { integrations, integrationCredentials } from "../db/schema.js";
import type { Db } from "../db/connection.js";
// PERF: the agent registry eagerly imports all ~34 auditor modules and, with them,
// the AWS, Azure and GCP SDKs. Importing it at module scope meant anything that
// touched IntegrationService dragged that entire graph in — ~210s of transform in
// the test suite (which is what made the blocking unit gate flaky), and the same
// cost on every Lambda cold start, for a dependency only two methods use.
// Resolved lazily instead; both call sites are already async.
type AgentRegistry = typeof import("../agents/registry.js");
let registryPromise: Promise<AgentRegistry> | null = null;
function loadAgentRegistry(): Promise<AgentRegistry> {
  registryPromise ??= import("../agents/registry.js");
  return registryPromise;
}
import { notFound, badRequest } from "../utils/errors.js";
import {
  EncryptionProviderService,
  type SecretEnvelope,
} from "./encryption-provider-service.js";
import { redactCredentials } from "../lib/redact.js";

// SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext cloud credentials at rest —
// a credentialRef is a SAFE, non-secret pointer ONLY when it is one of these opaque
// forms. Anything else (raw inline JSON / Azure clientSecret / GCP SA key / AWS keys)
// is secret material that must be AES-256-GCM envelope-encrypted before persistence so
// it never sits in the clear in the `integrations.credential_ref` column. Mirrors the
// same allowlist used by ScanService at scan-enqueue time.
function isSafeCredentialRef(ref: string): boolean {
  return ref.startsWith("vault://") || ref.startsWith("arn:aws:iam::");
}

/** Minimal structured-logger shape (Fastify/pino compatible). */
type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

/**
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext creds returned in API responses —
 * non-secret columns of an integration that are SAFE to serialize back to the client.
 * `credentialRef` is deliberately excluded because for inline integrations it carries (or
 * pointed at) secret material; callers receive `hasCredential` instead of the value.
 */
type SafeIntegration = {
  id: string;
  tenantId: string;
  type: string;
  status: string;
  lastVerifiedAt: Date | null;
  createdAt: Date;
  hasCredential: boolean;
};

function toSafeIntegration(row: typeof integrations.$inferSelect): SafeIntegration {
  return {
    id: row.id,
    tenantId: row.tenantId,
    type: row.type,
    status: row.status,
    lastVerifiedAt: row.lastVerifiedAt,
    createdAt: row.createdAt,
    hasCredential: Boolean(row.credentialRef),
  };
}

export class IntegrationService {
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): credential-access auditability —
  // optional structured logger so credential encrypt/decrypt/access events are recorded
  // (info) and decrypt failures are recorded (warn) WITHOUT ever logging the secret.
  // Defaulted to a no-op to keep every existing `new IntegrationService(db)` call site
  // building unchanged (back-compat).
  private readonly log: Logger;
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): credential encryption at rest — the
  // encryption provider is constructed LAZILY (only when a credential is actually
  // encrypted/decrypted) because EncryptionProviderService fails closed if no key
  // material is configured. Read-only routes (list/get) must not require keys to be set.
  private encryptionProvider?: EncryptionProviderService;

  constructor(private db: Db, log?: Logger) {
    this.log = log ?? { info: () => {}, warn: () => {} };
  }

  private get encryption(): EncryptionProviderService {
    if (!this.encryptionProvider) {
      this.encryptionProvider = new EncryptionProviderService();
    }
    return this.encryptionProvider;
  }

  async list(tenantId: string) {
    const [rows, [totalResult]] = await Promise.all([
      this.db
        .select()
        .from(integrations)
        .where(eq(integrations.tenantId, tenantId))
        .orderBy(integrations.type),
      this.db
        .select({ count: count() })
        .from(integrations)
        .where(eq(integrations.tenantId, tenantId)),
    ]);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext creds returned in
    // GET /api/integrations — strip secret material; never serialize credentialRef.
    return { rows: rows.map(toSafeIntegration), total: totalResult.count };
  }

  /**
   * Internal/raw lookup — returns the FULL row including credentialRef. For scan-time
   * credential resolution only; route handlers must use getSafeById() so secrets never
   * leave the service boundary.
   */
  async getById(id: string) {
    const [integration] = await this.db
      .select()
      .from(integrations)
      .where(eq(integrations.id, id))
      .limit(1);

    if (!integration) throw notFound("Integration");
    return integration;
  }

  /**
   * SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext creds returned in
   * GET /api/integrations/:id — secret-free projection for client responses.
   */
  async getSafeById(id: string, tenantId: string): Promise<SafeIntegration> {
    const [integration] = await this.db
      .select()
      .from(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)))
      .limit(1);

    if (!integration) throw notFound("Integration");
    return toSafeIntegration(integration);
  }

  /**
   * SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant credential access via
   * testConnection() — the prior getById(id) lookup had NO tenant predicate, so a user in
   * TenantA could POST /api/integrations/<TenantB_ID>/test and trigger decryption of
   * TenantB's credentials. This tenant-scoped raw lookup returns the FULL row (including
   * credentialRef) ONLY when the row belongs to the caller's tenant, so secret resolution
   * can never cross the tenant boundary. A miss (wrong tenant or unknown id) is logged at
   * warn as a denied access and surfaced as a 404 (no existence oracle), never the secret.
   */
  private async getByIdForTenant(id: string, tenantId: string) {
    const [integration] = await this.db
      .select()
      .from(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)))
      .limit(1);

    if (!integration) {
      this.log.warn(
        {
          event: "integration.access.denied",
          tenantId,
          integrationId: id,
          reason: "not_found_or_cross_tenant",
        },
        "denied integration access — id not found within caller tenant scope",
      );
      throw notFound("Integration");
    }
    return integration;
  }

  async create(tenantId: string, data: {
    type: string;
    credentialRef: string;
  }): Promise<SafeIntegration> {
    const { getAgentsForIntegration } = await loadAgentRegistry();
    const agents = getAgentsForIntegration(data.type);
    if (agents.length === 0) {
      throw badRequest("UNSUPPORTED_TYPE", `No scanning agent registered for type "${data.type}"`);
    }

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext cloud creds stored at rest —
    // if the submitted credentialRef carries inline secret material (Azure clientSecret,
    // GCP SA key, AWS access keys), AES-256-GCM envelope-encrypt it via encryptSecret()
    // and persist ONLY the encrypted envelope in integration_credentials. The
    // integrations.credential_ref column (NOT NULL, consumed widely downstream) keeps a
    // NON-secret pointer to that encrypted record. Already-opaque pointer refs
    // (vault:// / arn:aws:iam::) are persisted as-is. We never write or log the plaintext.
    const inlineSecret = !isSafeCredentialRef(data.credentialRef);

    const [created] = await this.db
      .insert(integrations)
      .values({
        tenantId,
        type: data.type as any,
        // For inline secrets we replace the plaintext with a stable, non-secret pointer
        // once we know the credential row id (set below). For safe pointer refs we store
        // the ref verbatim. Use a placeholder that we overwrite for inline secrets.
        credentialRef: inlineSecret ? "pending-credential" : data.credentialRef,
        status: "active",
      })
      .returning();

    if (inlineSecret) {
      const envelope: SecretEnvelope = this.encryption.encryptSecret(data.credentialRef);
      const [credRow] = await this.db
        .insert(integrationCredentials)
        .values({
          tenantId,
          integrationId: created.id,
          vaultProvider: "aws_kms_inline",
          // vaultRef must be non-null; point it at the integration record itself.
          vaultRef: `integration://${created.id}`,
          credentialCiphertext: envelope.ciphertext,
          credentialKeyId: envelope.keyId,
          credentialAlg: envelope.alg,
          credentialNonce: envelope.nonce,
          credentialAuthTag: envelope.authTag,
        })
        .returning({ id: integrationCredentials.id });

      // Rebind credentialRef to a non-secret pointer at the encrypted credential row.
      await this.db
        .update(integrations)
        .set({ credentialRef: `credref://${credRow.id}` })
        .where(eq(integrations.id, created.id));

      this.log.info(
        {
          event: "integration.credential.encrypted",
          tenantId,
          integrationId: created.id,
          credentialId: credRow.id,
          type: data.type,
          keyId: envelope.keyId,
        },
        "stored integration credential encrypted at rest (no plaintext persisted)",
      );
    }

    return toSafeIntegration(created);
  }

  /**
   * SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext cloud creds stored at rest (PATCH
   * path) — apply a tenant-scoped update. Non-secret fields (status) pass through. If a new
   * inline credentialRef is supplied it is envelope-encrypted into integration_credentials
   * exactly like create(); credential_ref is rebound to a non-secret credref:// pointer so
   * no plaintext is ever written. Returns a secret-free projection.
   */
  async updateForTenant(
    id: string,
    tenantId: string,
    body: { status?: string; credentialRef?: string },
  ): Promise<SafeIntegration> {
    const [existing] = await this.db
      .select()
      .from(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw notFound("Integration");

    const setFields: Partial<typeof integrations.$inferInsert> = {};
    if (body.status !== undefined) setFields.status = body.status as any;

    if (body.credentialRef !== undefined) {
      if (isSafeCredentialRef(body.credentialRef)) {
        setFields.credentialRef = body.credentialRef;
      } else {
        // Inline secret — encrypt and rebind to a credref:// pointer.
        const envelope: SecretEnvelope = this.encryption.encryptSecret(body.credentialRef);
        const [credRow] = await this.db
          .insert(integrationCredentials)
          .values({
            tenantId,
            integrationId: id,
            vaultProvider: "aws_kms_inline",
            vaultRef: `integration://${id}`,
            credentialCiphertext: envelope.ciphertext,
            credentialKeyId: envelope.keyId,
            credentialAlg: envelope.alg,
            credentialNonce: envelope.nonce,
            credentialAuthTag: envelope.authTag,
          })
          .returning({ id: integrationCredentials.id });
        setFields.credentialRef = `credref://${credRow.id}`;

        this.log.info(
          {
            event: "integration.credential.encrypted",
            tenantId,
            integrationId: id,
            credentialId: credRow.id,
            keyId: envelope.keyId,
          },
          "rotated integration credential encrypted at rest (no plaintext persisted)",
        );
      }
    }

    const [updated] = await this.db
      .update(integrations)
      .set(setFields)
      .where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)))
      .returning();

    if (!updated) throw notFound("Integration");
    return toSafeIntegration(updated);
  }

  /**
   * SECURITY FIX (BLACKFYRE audit 2026-06-05): credential decrypt path — resolve the
   * plaintext secret for an integration ONLY when a scan/connectivity test actually needs
   * it. Logs the access at info (never the secret) and decrypt failures at warn. Opaque
   * pointer refs (vault:// / arn:aws:iam::) are returned untouched for the worker to
   * resolve; credref:// pointers are decrypted from the encrypted credential row.
   */
  private async resolveCredential(integration: typeof integrations.$inferSelect): Promise<string> {
    const ref = integration.credentialRef;
    if (isSafeCredentialRef(ref)) return ref;

    if (ref.startsWith("credref://")) {
      const credentialId = ref.slice("credref://".length);
      const [credRow] = await this.db
        .select()
        .from(integrationCredentials)
        .where(
          and(
            eq(integrationCredentials.id, credentialId),
            eq(integrationCredentials.tenantId, integration.tenantId),
          ),
        )
        .limit(1);

      if (
        !credRow ||
        !credRow.credentialCiphertext ||
        !credRow.credentialNonce ||
        !credRow.credentialAuthTag ||
        !credRow.credentialKeyId
      ) {
        this.log.warn(
          {
            event: "integration.credential.decrypt_failed",
            tenantId: integration.tenantId,
            integrationId: integration.id,
            reason: "missing_envelope",
          },
          "integration credential envelope missing or incomplete",
        );
        throw badRequest("CREDENTIAL_UNAVAILABLE", "Integration credential is unavailable");
      }

      try {
        const plaintext = this.encryption.decryptSecret({
          ciphertext: credRow.credentialCiphertext,
          nonce: credRow.credentialNonce,
          authTag: credRow.credentialAuthTag,
          keyId: credRow.credentialKeyId,
          alg: "aes-256-gcm",
        });
        this.log.info(
          {
            event: "integration.credential.accessed",
            tenantId: integration.tenantId,
            integrationId: integration.id,
            credentialId: credRow.id,
            keyId: credRow.credentialKeyId,
          },
          "decrypted integration credential for scan/connection test",
        );
        return plaintext;
      } catch (err) {
        this.log.warn(
          {
            event: "integration.credential.decrypt_failed",
            tenantId: integration.tenantId,
            integrationId: integration.id,
            credentialId: credRow.id,
            reason: "decrypt_error",
          },
          "failed to decrypt integration credential",
        );
        throw badRequest("CREDENTIAL_DECRYPT_FAILED", "Failed to decrypt integration credential");
      }
    }

    // Legacy rows that still hold inline plaintext (pre-fix data) — return as-is so
    // existing integrations keep working, but flag at warn so they can be re-encrypted.
    this.log.warn(
      {
        event: "integration.credential.plaintext_legacy",
        tenantId: integration.tenantId,
        integrationId: integration.id,
      },
      "integration still using legacy plaintext credential — should be re-encrypted",
    );
    return ref;
  }

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): missing tenant predicate in testConnection —
  // require the caller's tenantId and resolve the integration via the tenant-scoped
  // getByIdForTenant() so a cross-tenant id can no longer reach resolveCredential() and
  // decrypt another tenant's secret. This call decrypts credentials, so the tenant guard
  // must live here, not only at the route layer.
  async testConnection(id: string, tenantId: string) {
    const integration = await this.getByIdForTenant(id, tenantId);
    const { getAgentsForIntegration } = await loadAgentRegistry();
    const agents = getAgentsForIntegration(integration.type);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): credential access auditability — record
    // the tenant-scoped connectivity test that will decrypt the at-rest credential; never
    // the secret itself.
    this.log.info(
      {
        event: "integration.connection.test",
        tenantId,
        integrationId: integration.id,
        type: integration.type,
      },
      "running tenant-scoped integration connection test (credential decrypt to follow)",
    );

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): credential decrypt only when needed —
    // resolve the secret (decrypting the at-rest envelope) solely for the connectivity
    // check; the plaintext lives only in memory for the duration of this call.
    const credential = await this.resolveCredential(integration);

    const results = await Promise.all(
      agents.map(async (agent) => {
        try {
          const success = await agent.testConnection(credential);
          return { agent: agent.type, success, error: null };
        } catch (error) {
          return {
            agent: agent.type,
            success: false,
            error: error instanceof Error ? error.message : "Connection test failed",
          };
        }
      })
    );

    const allSuccess = results.every((r) => r.success);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): tenant-scope the status writeback too so
    // the connectivity test can only mutate the caller-tenant's row.
    await this.db
      .update(integrations)
      .set({
        status: allSuccess ? "active" : "error",
        lastVerifiedAt: new Date(),
      })
      .where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)));

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): never echo secret material — results are
    // agent-type + boolean + error string only; redact defensively before returning.
    return redactCredentials({ success: allSuccess, results });
  }

  async remove(id: string) {
    const integration = await this.getById(id);

    await this.db
      .delete(integrations)
      .where(eq(integrations.id, id));

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext creds returned in responses —
    // return a secret-free projection of the removed integration.
    return toSafeIntegration(integration);
  }

  async removeForTenant(id: string, tenantId: string): Promise<SafeIntegration> {
    const [integration] = await this.db
      .select()
      .from(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)))
      .limit(1);

    if (!integration) throw notFound("Integration");

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): drop the encrypted credential row too so
    // no orphaned secret material lingers after the integration is deleted.
    await this.db
      .delete(integrationCredentials)
      .where(
        and(
          eq(integrationCredentials.integrationId, id),
          eq(integrationCredentials.tenantId, tenantId),
        ),
      );

    await this.db
      .delete(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)));

    return toSafeIntegration(integration);
  }

  async getActiveForTenant(tenantId: string, types?: string[]) {
    const rows = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.status, "active"),
        )
      );

    if (types && types.length > 0) {
      return rows.filter((r) => types.includes(r.type));
    }
    return rows;
  }
}
