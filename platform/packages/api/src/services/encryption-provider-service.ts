import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";
// REAL IMPL (BLACKFYRE 2026-06): durable per-tenant sovereignty config. The
// EncryptionConfig + GeoPin used to live ONLY in per-process in-memory Maps
// (lost on restart). They are now persisted/loaded via PARAMETERIZED SQL through
// a Postgres handle into the RLS-isolated `tenant_encryption_configs` /
// `tenant_geo_pins` tables (migration 025). We deliberately do NOT touch
// db/schema.ts (concurrent edits collide) and instead run raw, parameterized
// `db.execute(sql\`...\`)` — the same pattern sibling persistent services use.
import { sql } from "drizzle-orm";
import type { Db } from "../db/connection.js";
// REAL IMPL (BLACKFYRE 2026-06): Azure Key Vault BYOK — wrap/unwrap the per-field
// data key with a customer-held RSA key via CryptographyClient (RSA-OAEP-256),
// authenticated by the tenant's service principal or a managed/workload identity.
import {
  ClientSecretCredential,
  DefaultAzureCredential,
  type TokenCredential,
} from "@azure/identity";
import { CryptographyClient, type KeyWrapAlgorithm } from "@azure/keyvault-keys";

// --- Types ---

export type EncryptionMode = "blackfyre-managed" | "client-byok-aws" | "client-byok-azure";

/**
 * Minimal pino/Fastify-logger structural type. Lets callers (route handlers,
 * services holding request.log / app.log) opt into structured security/audit
 * logging for BYOK key operations without this module taking a hard dependency
 * on Fastify's types. Mirrors the shape used by the AWS credential resolver and
 * AiAnalysisService so a real pino logger drops in unchanged.
 */
export interface EncryptionAuditLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
}

export interface EncryptionConfig {
  mode: EncryptionMode;
  awsKmsKeyArn?: string;
  azureKeyVaultUrl?: string;
  azureKeyName?: string;
  /**
   * REAL IMPL (BLACKFYRE 2026-06): optional service-principal credentials for the
   * tenant's Azure Key Vault. When all three are present we authenticate with a
   * ClientSecretCredential; when omitted we fall back to DefaultAzureCredential
   * (managed identity / workload identity / env). These are secrets — they are
   * NEVER logged.
   */
  azureTenantId?: string;
  azureClientId?: string;
  azureClientSecret?: string;
  /**
   * Optional explicit key version (the GUID after the key name in a Key Vault
   * key id). When omitted, Key Vault uses the current version of the key. The
   * envelope's keyId pins the exact key id used at wrap time so unwrap always
   * targets the same key version even after rotation of the current version.
   */
  azureKeyVersion?: string;
  region?: string;
}

export interface EncryptedField {
  ciphertext: string;   // base64
  iv: string;           // base64
  authTag: string;      // base64
  keyId: string;        // identifies which key encrypted this
  algorithm: "aes-256-gcm";
  mode: EncryptionMode;
}

/**
 * Compact envelope produced by encryptSecret(). Carries everything needed to decrypt
 * (including which key version was used) so secrets stay decryptable across key rotation.
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): no key rotation — the legacy EncryptedField
 * derived a per-tenant key from a single static master key with no version marker. This
 * envelope pins an explicit keyId so future rotation can decrypt old data with old keys.
 */
export interface SecretEnvelope {
  ciphertext: string;        // base64 (AES-256-GCM ciphertext, no auth tag appended)
  nonce: string;             // base64 (12-byte GCM nonce / IV)
  authTag: string;           // base64 (GCM authentication tag)
  keyId: string;             // which master-key version encrypted this (for rotation)
  alg: "aes-256-gcm";
}

export interface GeoPin {
  tenantId: string;
  allowedRegions: string[];   // e.g., ["me-central-1", "me-south-1"]
  primaryRegion: string;
  dataResidencyLaw: string;   // e.g., "PDPL", "GDPR", "DPDPA"
  enforced: boolean;
}

export interface SovereigntyStatus {
  encryptionMode: EncryptionMode;
  byokEnabled: boolean;
  keyId: string | null;
  geoPin: GeoPin | undefined;
  currentRegion: string;
  compliant: boolean;
  issues: string[];
}

export interface GeoPinCheckResult {
  allowed: boolean;
  currentRegion: string;
  pin?: GeoPin;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): row shapes for the durable sovereignty tables
 * (snake_case as Postgres returns them via raw `db.execute(sql\`...\`)`). These
 * are read-only DTOs for the parameterized SELECTs — they are NOT a Drizzle
 * schema definition (db/schema.ts is intentionally untouched).
 */
interface TenantEncryptionConfigRow {
  mode: string;
  aws_kms_key_arn: string | null;
  azure_key_vault_url: string | null;
  azure_key_name: string | null;
  azure_key_version: string | null;
  azure_tenant_id: string | null;
  azure_client_id: string | null;
  // jsonb column — postgres-js returns parsed JSON (object); kept string-tolerant.
  azure_client_secret_enc: Record<string, unknown> | string | null;
  region: string | null;
}

interface TenantGeoPinRow {
  allowed_regions: string[] | null;
  primary_region: string;
  data_residency_law: string;
  enforced: boolean;
}

// --- Service ---

/**
 * Resolve the master-key keyring from the environment.
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): hardcoded fallback master key + single,
 * unversioned env key — there was a literal `blackfyre-default-dev-key-do-not-use-in-prod`
 * fallback that silently produced a real (predictable) encryption key whenever
 * ENCRYPTION_MASTER_KEY was unset outside production. That meant secrets could be
 * "encrypted" under an attacker-known key. We now:
 *   - FAIL CLOSED: throw at construction time if NO key material is configured (any env).
 *   - Support multiple versioned keys for rotation via ENCRYPTION_KEYS (JSON map of
 *     keyId -> base64/hex/utf8 key) plus a primary ENCRYPTION_KEY_ID; the legacy single
 *     ENCRYPTION_MASTER_KEY is still honoured as keyId "v1" for back-compat.
 *
 * Accepted env layouts (first match wins):
 *   1. ENCRYPTION_KEYS='{"k2":"<base64-32B>","k1":"<base64-32B>"}' + ENCRYPTION_KEY_ID=k2
 *   2. ENCRYPTION_MASTER_KEY='<secret>'  (treated as keyId "v1")
 *
 * Each key value is normalised to exactly 32 bytes via SHA-256 (so any sufficiently
 * random secret of any encoding yields a valid AES-256 key) — but an empty/missing
 * keyring is rejected rather than defaulted.
 */
interface MasterKeyring {
  keys: Map<string, Buffer>;
  primaryKeyId: string;
}

function loadMasterKeyring(): MasterKeyring {
  const keys = new Map<string, Buffer>();
  let primaryKeyId: string | undefined;

  const rawKeys = process.env.ENCRYPTION_KEYS;
  if (rawKeys) {
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(rawKeys);
    } catch {
      throw new Error("ENCRYPTION_KEYS must be a JSON object mapping keyId -> key material");
    }
    for (const [keyId, material] of Object.entries(parsed)) {
      if (typeof material === "string" && material.length > 0) {
        keys.set(keyId, createHash("sha256").update(material).digest());
      }
    }
    primaryKeyId = process.env.ENCRYPTION_KEY_ID;
    if (primaryKeyId && !keys.has(primaryKeyId)) {
      throw new Error(`ENCRYPTION_KEY_ID "${primaryKeyId}" is not present in ENCRYPTION_KEYS`);
    }
    // Default the primary to the first declared key when not explicitly set.
    if (!primaryKeyId) primaryKeyId = keys.keys().next().value;
  }

  // Legacy single key — register under stable id "v1" for back-compat decrypts.
  const legacy = process.env.ENCRYPTION_MASTER_KEY;
  if (legacy && legacy.length > 0 && !keys.has("v1")) {
    keys.set("v1", createHash("sha256").update(legacy).digest());
    if (!primaryKeyId) primaryKeyId = "v1";
  }

  // FAIL CLOSED — no usable key material in ANY environment.
  if (keys.size === 0 || !primaryKeyId) {
    throw new Error(
      "No encryption key material configured. Set ENCRYPTION_KEYS (+ ENCRYPTION_KEY_ID) " +
        "or ENCRYPTION_MASTER_KEY. There is intentionally no insecure default — the service fails closed.",
    );
  }

  return { keys, primaryKeyId };
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): RSA key-wrap algorithm used to wrap/unwrap the
 * per-field AES-256 data key with the customer's Key Vault RSA key. RSA-OAEP-256
 * (OAEP padding with SHA-256) is the modern, non-deprecated choice and is what
 * Azure recommends over RSA-OAEP (SHA-1) / RSA1_5.
 */
const AZURE_KEY_WRAP_ALG: KeyWrapAlgorithm = "RSA-OAEP-256";

export class EncryptionProviderService {
  // REAL IMPL (BLACKFYRE 2026-06): these Maps are now a WRITE-THROUGH in-process
  // CACHE, not the source of truth. The durable store is Postgres
  // (tenant_encryption_configs / tenant_geo_pins). Sync setters update the cache
  // AND best-effort write-through to the DB; async persist*/load* methods give
  // callers an awaitable, guaranteed-durable path. With no db handle the service
  // degrades to cache-only (back-compat for existing callers / unit tests).
  private configs: Map<string, EncryptionConfig> = new Map();
  private geoPins: Map<string, GeoPin> = new Map();
  private readonly managedKey: Buffer;
  private readonly keyring: MasterKeyring;
  private readonly log?: EncryptionAuditLogger;
  // REAL IMPL (BLACKFYRE 2026-06): optional Postgres handle for durable
  // sovereignty config. Optional + defaulted so every existing call site
  // (`new EncryptionProviderService()` / `new EncryptionProviderService(logger)`)
  // keeps compiling unchanged. When present, pass a tenant-scoped `request.db`
  // so RLS isolates rows; a `superDb` handle requires the caller to scope by
  // tenant_id (which we always do in the parameterized SQL below).
  private readonly db?: Db;

  constructor(logger?: EncryptionAuditLogger, db?: Db) {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): hardcoded fallback master key —
    // load the keyring up-front and fail closed if nothing is configured. The previous
    // `?? "blackfyre-default-dev-key-do-not-use-in-prod"` fallback is removed entirely.
    this.keyring = loadMasterKeyring();
    // Back-compat: the legacy managedKey is now the PRIMARY key from the keyring so all
    // existing encryptField/decryptField paths keep working without an insecure default.
    this.managedKey = this.keyring.keys.get(this.keyring.primaryKeyId)!;
    // REAL IMPL (BLACKFYRE 2026-06): optional structured logger for BYOK key
    // operations (Azure wrap/unwrap, connectivity probes). Never receives secrets.
    this.log = logger;
    // REAL IMPL (BLACKFYRE 2026-06): optional durable store handle.
    this.db = db;
  }

  /**
   * Encrypt a secret with AES-256-GCM under the current PRIMARY master key.
   * Returns a self-describing envelope carrying the keyId so the value remains
   * decryptable after the primary key is rotated.
   *
   * SECURITY FIX (BLACKFYRE audit 2026-06-05): key rotation + no static fallback —
   * tags every ciphertext with the key version that produced it.
   */
  encryptSecret(plaintext: string): SecretEnvelope {
    const keyId = this.keyring.primaryKeyId;
    const key = this.keyring.keys.get(keyId)!;
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return {
      ciphertext: ciphertext.toString("base64"),
      nonce: nonce.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      keyId,
      alg: "aes-256-gcm",
    };
  }

  /**
   * Decrypt a SecretEnvelope produced by encryptSecret(). Selects the key by the
   * envelope's keyId so envelopes written under an OLD key still decrypt after rotation.
   * Throws if the referenced key version is not in the configured keyring (fail closed).
   */
  decryptSecret(envelope: SecretEnvelope): string {
    const key = this.keyring.keys.get(envelope.keyId);
    if (!key) {
      throw new Error(`Unknown encryption keyId "${envelope.keyId}" — key not present in keyring`);
    }
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.nonce, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }

  /** Ids of all configured master-key versions (for rotation tooling / health checks). */
  listKeyIds(): string[] {
    return [...this.keyring.keys.keys()];
  }

  /** The keyId new ciphertext is currently produced under. */
  get primaryKeyId(): string {
    return this.keyring.primaryKeyId;
  }

  // --- Tenant Config (durable: tenant_encryption_configs) ---

  /**
   * Set the tenant's encryption config.
   *
   * REAL IMPL (BLACKFYRE 2026-06): updates the in-process cache synchronously
   * (signature kept stable — still returns void) AND best-effort write-through to
   * the durable Postgres store so the config survives restart. For a GUARANTEED
   * durable write, callers with a db handle should `await persistTenantConfig()`
   * instead (this method's write-through is fire-and-forget so it cannot change
   * the sync signature; failures are logged, never swallowed silently).
   */
  setTenantConfig(tenantId: string, config: EncryptionConfig): void {
    this.configs.set(tenantId, config);
    if (this.db) {
      // Fire-and-forget durable write-through. Errors are surfaced to the audit
      // log (no secrets) rather than thrown, to preserve the void signature.
      void this.persistTenantConfig(tenantId, config).catch((err) => {
        this.log?.warn(
          {
            event: "sovereignty.config.persist.failed",
            tenantId,
            mode: config.mode,
            error: err instanceof Error ? err.message : String(err),
          },
          "Failed to durably persist tenant encryption config (cache updated, DB write-through failed)",
        );
      });
    }
  }

  /**
   * Get the tenant's encryption config from the in-process cache, defaulting to
   * vendor-managed when absent. Signature kept stable (synchronous). For a
   * durable read that survives restart (cache miss after a cold start), use
   * `await loadTenantConfig()`, which reads Postgres and repopulates the cache.
   */
  getTenantConfig(tenantId: string): EncryptionConfig {
    return this.configs.get(tenantId) ?? { mode: "blackfyre-managed" };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): durably persist the tenant's encryption config
   * to `tenant_encryption_configs` via PARAMETERIZED SQL (idempotent upsert on the
   * tenant_id PK). Only NON-secret key references are stored in the clear; the
   * Azure service-principal client secret is AES-256-GCM envelope-encrypted via
   * encryptSecret() before storage and is NEVER written or logged in plaintext.
   * Also refreshes the in-process cache. No-op (cache-only) when no db handle.
   */
  async persistTenantConfig(tenantId: string, config: EncryptionConfig): Promise<void> {
    this.configs.set(tenantId, config);
    if (!this.db) return;

    // SECURITY (BLACKFYRE 2026-06): never persist the Azure client secret in the
    // clear. Wrap it in a SecretEnvelope so the at-rest value is ciphertext.
    const secretEnvelope =
      config.azureClientSecret && config.azureClientSecret.length > 0
        ? this.encryptSecret(config.azureClientSecret)
        : null;
    const secretEncJson = secretEnvelope ? JSON.stringify(secretEnvelope) : null;

    await this.db.execute(sql`
      INSERT INTO tenant_encryption_configs (
        tenant_id, mode, aws_kms_key_arn, azure_key_vault_url, azure_key_name,
        azure_key_version, azure_tenant_id, azure_client_id,
        azure_client_secret_enc, region, updated_at
      ) VALUES (
        ${tenantId}, ${config.mode}, ${config.awsKmsKeyArn ?? null},
        ${config.azureKeyVaultUrl ?? null}, ${config.azureKeyName ?? null},
        ${config.azureKeyVersion ?? null}, ${config.azureTenantId ?? null},
        ${config.azureClientId ?? null}, ${secretEncJson}::jsonb,
        ${config.region ?? null}, now()
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        mode = EXCLUDED.mode,
        aws_kms_key_arn = EXCLUDED.aws_kms_key_arn,
        azure_key_vault_url = EXCLUDED.azure_key_vault_url,
        azure_key_name = EXCLUDED.azure_key_name,
        azure_key_version = EXCLUDED.azure_key_version,
        azure_tenant_id = EXCLUDED.azure_tenant_id,
        azure_client_id = EXCLUDED.azure_client_id,
        azure_client_secret_enc = EXCLUDED.azure_client_secret_enc,
        region = EXCLUDED.region,
        updated_at = now()
    `);

    // AUDIT (BLACKFYRE 2026-06): non-secret record that sovereignty config was
    // durably written. Logs the mode + whether a (secret) credential is present,
    // never the secret itself.
    this.log?.info(
      {
        event: "sovereignty.config.persisted",
        tenantId,
        mode: config.mode,
        byok: config.mode !== "blackfyre-managed",
        azureServicePrincipal: secretEnvelope !== null,
      },
      "Durably persisted tenant encryption config",
    );
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): durably load the tenant's encryption config
   * from `tenant_encryption_configs` via PARAMETERIZED SQL, decrypt the Azure
   * client secret envelope back into memory, repopulate the in-process cache, and
   * return it. Returns the vendor-managed default when no row exists. Cache-only
   * fallback (returns the cached/default config) when no db handle is wired.
   */
  async loadTenantConfig(tenantId: string): Promise<EncryptionConfig> {
    if (!this.db) return this.getTenantConfig(tenantId);

    const rows = (await this.db.execute(sql`
      SELECT mode, aws_kms_key_arn, azure_key_vault_url, azure_key_name,
             azure_key_version, azure_tenant_id, azure_client_id,
             azure_client_secret_enc, region
      FROM tenant_encryption_configs
      WHERE tenant_id = ${tenantId}
      LIMIT 1
    `)) as unknown as TenantEncryptionConfigRow[];

    const row = rows[0];
    if (!row) return { mode: "blackfyre-managed" };

    let azureClientSecret: string | undefined;
    if (row.azure_client_secret_enc) {
      try {
        const envelope =
          typeof row.azure_client_secret_enc === "string"
            ? (JSON.parse(row.azure_client_secret_enc) as SecretEnvelope)
            : (row.azure_client_secret_enc as unknown as SecretEnvelope);
        azureClientSecret = this.decryptSecret(envelope);
      } catch (err) {
        // SECURITY/AUDIT (BLACKFYRE 2026-06): a stored secret we can no longer
        // decrypt (e.g. key rotated away) is recorded WITHOUT the ciphertext or
        // any plaintext. We fail closed on the credential (leave it undefined) so
        // BYOK falls back to managed/identity auth rather than crashing.
        this.log?.warn(
          {
            event: "sovereignty.config.secret.decrypt_failed",
            tenantId,
            error: err instanceof Error ? err.message : String(err),
          },
          "Could not decrypt stored Azure client secret — leaving credential unset",
        );
      }
    }

    const config: EncryptionConfig = {
      mode: row.mode as EncryptionMode,
      awsKmsKeyArn: row.aws_kms_key_arn ?? undefined,
      azureKeyVaultUrl: row.azure_key_vault_url ?? undefined,
      azureKeyName: row.azure_key_name ?? undefined,
      azureKeyVersion: row.azure_key_version ?? undefined,
      azureTenantId: row.azure_tenant_id ?? undefined,
      azureClientId: row.azure_client_id ?? undefined,
      azureClientSecret,
      region: row.region ?? undefined,
    };
    this.configs.set(tenantId, config);
    return config;
  }

  // --- Encrypt / Decrypt ---

  async encryptField(tenantId: string, plaintext: string): Promise<EncryptedField> {
    const config = this.getTenantConfig(tenantId);

    switch (config.mode) {
      case "client-byok-aws":
        return this.encryptWithAwsKms(tenantId, plaintext, config);
      case "client-byok-azure":
        return this.encryptWithAzureKeyVault(tenantId, plaintext, config);
      default:
        return this.encryptWithManagedKey(tenantId, plaintext);
    }
  }

  async decryptField(tenantId: string, encrypted: EncryptedField): Promise<string> {
    switch (encrypted.mode) {
      case "client-byok-aws":
        return this.decryptWithAwsKms(tenantId, encrypted);
      case "client-byok-azure":
        return this.decryptWithAzureKeyVault(tenantId, encrypted);
      default:
        return this.decryptWithManagedKey(tenantId, encrypted);
    }
  }

  // --- Blackfyre-Managed Encryption ---

  private encryptWithManagedKey(tenantId: string, plaintext: string): EncryptedField {
    const tenantKey = createHash("sha256")
      .update(`${this.managedKey.toString("hex")}:${tenantId}`)
      .digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", tenantKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

    return {
      ciphertext: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      keyId: `bf-managed:${createHash("sha256").update(tenantId).digest("hex").slice(0, 12)}`,
      algorithm: "aes-256-gcm",
      mode: "blackfyre-managed",
    };
  }

  private decryptWithManagedKey(tenantId: string, encrypted: EncryptedField): string {
    const tenantKey = createHash("sha256")
      .update(`${this.managedKey.toString("hex")}:${tenantId}`)
      .digest();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      tenantKey,
      Buffer.from(encrypted.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }

  // --- AWS KMS BYOK ---

  private async encryptWithAwsKms(
    _tenantId: string,
    plaintext: string,
    config: EncryptionConfig,
  ): Promise<EncryptedField> {
    if (!config.awsKmsKeyArn) {
      throw new Error("AWS KMS key ARN required for BYOK mode");
    }

    const kms = new KMSClient({ region: config.region ?? "us-east-1" });

    const { Plaintext: dekPlain, CiphertextBlob: dekWrapped } = await kms.send(
      new GenerateDataKeyCommand({ KeyId: config.awsKmsKeyArn, KeySpec: "AES_256" }),
    );

    if (!dekPlain || !dekWrapped) {
      throw new Error("KMS data key generation failed");
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(dekPlain), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Envelope: 2-byte LE length of wrapped DEK, wrapped DEK, ciphertext
    const envelope = Buffer.concat([
      Buffer.from([dekWrapped.length & 0xff, (dekWrapped.length >> 8) & 0xff]),
      Buffer.from(dekWrapped),
      encrypted,
    ]);

    return {
      ciphertext: envelope.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      keyId: config.awsKmsKeyArn,
      algorithm: "aes-256-gcm",
      mode: "client-byok-aws",
    };
  }

  private async decryptWithAwsKms(tenantId: string, encrypted: EncryptedField): Promise<string> {
    const config = this.getTenantConfig(tenantId);
    const kms = new KMSClient({ region: config.region ?? "us-east-1" });

    const envelope = Buffer.from(encrypted.ciphertext, "base64");
    const dekLen = envelope[0] | (envelope[1] << 8);
    const wrappedDek = envelope.subarray(2, 2 + dekLen);
    const ciphertext = envelope.subarray(2 + dekLen);

    const { Plaintext: dek } = await kms.send(
      new DecryptCommand({ CiphertextBlob: wrappedDek, KeyId: encrypted.keyId }),
    );

    if (!dek) {
      throw new Error("KMS decryption failed - client may have revoked key");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(dek),
      Buffer.from(encrypted.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }

  // --- Azure Key Vault BYOK ---

  /**
   * REAL IMPL (BLACKFYRE 2026-06): resolve a TokenCredential for the tenant's
   * Key Vault. Prefers an explicit service principal from the BYOK config
   * (ClientSecretCredential); otherwise uses DefaultAzureCredential so the
   * service can authenticate via managed identity / workload identity / az CLI /
   * env vars in production. The clientSecret is treated as a secret and is never
   * logged or echoed back.
   */
  private resolveAzureCredential(config: EncryptionConfig): TokenCredential {
    if (config.azureTenantId && config.azureClientId && config.azureClientSecret) {
      return new ClientSecretCredential(
        config.azureTenantId,
        config.azureClientId,
        config.azureClientSecret,
      );
    }
    return new DefaultAzureCredential();
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): build the full Key Vault key identifier and a
   * CryptographyClient bound to it. The returned keyId is what we persist in the
   * envelope so unwrap targets the exact same key (and version, when pinned).
   *
   * keyId form: {vaultUrl}/keys/{keyName}[/{version}]
   */
  private buildAzureCrypto(
    config: EncryptionConfig,
  ): { client: CryptographyClient; keyId: string } {
    if (!config.azureKeyVaultUrl || !config.azureKeyName) {
      throw new Error("Azure Key Vault URL and key name required for BYOK mode");
    }
    const base = config.azureKeyVaultUrl.replace(/\/+$/, "");
    const keyId = config.azureKeyVersion
      ? `${base}/keys/${config.azureKeyName}/${config.azureKeyVersion}`
      : `${base}/keys/${config.azureKeyName}`;
    const credential = this.resolveAzureCredential(config);
    // CryptographyClient(keyId, credential): all crypto runs server-side in the
    // customer's HSM/vault — the customer's RSA private key never leaves Azure.
    const client = new CryptographyClient(keyId, credential);
    return { client, keyId };
  }

  /**
   * Parse a Key Vault keyId of the form {vaultUrl}/keys/{name}[/{version}] back
   * into an EncryptionConfig-shaped fragment so decrypt can rebuild the client
   * even if the in-memory tenant config has changed since encrypt time.
   */
  private parseAzureKeyId(keyId: string): {
    azureKeyVaultUrl?: string;
    azureKeyName?: string;
    azureKeyVersion?: string;
  } {
    const m = keyId.match(/^(https?:\/\/[^/]+)\/keys\/([^/]+)(?:\/([^/]+))?$/);
    if (!m) return {};
    return { azureKeyVaultUrl: m[1], azureKeyName: m[2], azureKeyVersion: m[3] };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): envelope-encrypt under Azure BYOK.
   *   1. Generate a random per-field AES-256 data key (DEK).
   *   2. AES-256-GCM encrypt the plaintext with the DEK.
   *   3. Wrap (encrypt) the DEK with the customer's RSA key in Key Vault via
   *      CryptographyClient.wrapKey(RSA-OAEP-256) — server-side, the customer
   *      private key never leaves the vault/HSM.
   * Envelope layout matches the AWS KMS path exactly so the EncryptedField shape
   * stays stable: 2-byte LE wrapped-DEK length, wrapped DEK, GCM ciphertext.
   */
  private async encryptWithAzureKeyVault(
    tenantId: string,
    plaintext: string,
    config: EncryptionConfig,
  ): Promise<EncryptedField> {
    const { client, keyId } = this.buildAzureCrypto(config);

    const dek = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", dek, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    let wrappedDek: Uint8Array;
    try {
      const wrap = await client.wrapKey(AZURE_KEY_WRAP_ALG, dek);
      wrappedDek = wrap.result;
    } catch (err) {
      // SECURITY/AUDIT (BLACKFYRE 2026-06): record wrap failures (vault
      // unreachable / key disabled / access revoked) without leaking the DEK,
      // plaintext, or credentials.
      this.log?.warn(
        {
          event: "azure.keyvault.wrap.failed",
          tenantId,
          keyId,
          algorithm: AZURE_KEY_WRAP_ALG,
          error: err instanceof Error ? err.message : String(err),
        },
        "Azure Key Vault wrapKey failed",
      );
      throw new Error(
        `Azure Key Vault wrapKey failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      // Best-effort: zero the plaintext DEK so it does not linger in the heap.
      dek.fill(0);
    }

    if (wrappedDek.length > 0xffff) {
      throw new Error("Azure Key Vault returned an oversized wrapped data key");
    }

    // Envelope: 2-byte LE length of wrapped DEK, wrapped DEK, ciphertext
    const envelope = Buffer.concat([
      Buffer.from([wrappedDek.length & 0xff, (wrappedDek.length >> 8) & 0xff]),
      Buffer.from(wrappedDek),
      encrypted,
    ]);

    // AUDIT (BLACKFYRE 2026-06): non-secret record of a successful BYOK wrap.
    this.log?.info(
      {
        event: "azure.keyvault.wrap.ok",
        tenantId,
        keyId,
        algorithm: AZURE_KEY_WRAP_ALG,
        wrappedDekBytes: wrappedDek.length,
      },
      "Wrapped per-field data key with customer Azure Key Vault key",
    );

    return {
      ciphertext: envelope.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      keyId,
      algorithm: "aes-256-gcm",
      mode: "client-byok-azure",
    };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): envelope-decrypt under Azure BYOK.
   *   1. Split the envelope into wrapped DEK + GCM ciphertext.
   *   2. Unwrap (decrypt) the DEK with the customer's RSA key in Key Vault via
   *      CryptographyClient.unwrapKey(RSA-OAEP-256).
   *   3. AES-256-GCM decrypt the ciphertext with the recovered DEK.
   * The CryptographyClient is built from the envelope's own keyId so data stays
   * decryptable across tenant-config changes and key rotation (version pinned in
   * the keyId at encrypt time). NO throw-stub — this is a real round-trip.
   */
  private async decryptWithAzureKeyVault(
    tenantId: string,
    encrypted: EncryptedField,
  ): Promise<string> {
    const config = this.getTenantConfig(tenantId);
    // Rebuild the exact key (and version) recorded in the envelope; fall back to
    // the tenant config's credentials/vault for auth material.
    const fromKeyId = this.parseAzureKeyId(encrypted.keyId);
    const effective: EncryptionConfig = {
      ...config,
      azureKeyVaultUrl: fromKeyId.azureKeyVaultUrl ?? config.azureKeyVaultUrl,
      azureKeyName: fromKeyId.azureKeyName ?? config.azureKeyName,
      azureKeyVersion: fromKeyId.azureKeyVersion ?? config.azureKeyVersion,
    };
    const { client, keyId } = this.buildAzureCrypto(effective);

    const envelope = Buffer.from(encrypted.ciphertext, "base64");
    if (envelope.length < 2) {
      throw new Error("Malformed Azure BYOK envelope: missing wrapped-key length");
    }
    const dekLen = envelope[0] | (envelope[1] << 8);
    if (envelope.length < 2 + dekLen) {
      throw new Error("Malformed Azure BYOK envelope: truncated wrapped key");
    }
    const wrappedDek = envelope.subarray(2, 2 + dekLen);
    const ciphertext = envelope.subarray(2 + dekLen);

    let dek: Buffer;
    try {
      const unwrap = await client.unwrapKey(AZURE_KEY_WRAP_ALG, wrappedDek);
      dek = Buffer.from(unwrap.result);
    } catch (err) {
      // SECURITY/AUDIT (BLACKFYRE 2026-06): unwrap failure most often means the
      // customer revoked/disabled the key — i.e. a sovereign "kill switch".
      // Record it (no secrets) so it is visible in the audit trail.
      this.log?.warn(
        {
          event: "azure.keyvault.unwrap.failed",
          tenantId,
          keyId,
          algorithm: AZURE_KEY_WRAP_ALG,
          error: err instanceof Error ? err.message : String(err),
        },
        "Azure Key Vault unwrapKey failed — customer may have revoked the key",
      );
      throw new Error(
        `Azure Key Vault unwrapKey failed (client may have revoked key): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    try {
      const decipher = createDecipheriv("aes-256-gcm", dek, Buffer.from(encrypted.iv, "base64"));
      decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
      const out = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
      this.log?.info(
        { event: "azure.keyvault.unwrap.ok", tenantId, keyId, algorithm: AZURE_KEY_WRAP_ALG },
        "Unwrapped per-field data key with customer Azure Key Vault key",
      );
      return out;
    } finally {
      // Best-effort: zero the recovered plaintext DEK.
      dek.fill(0);
    }
  }

  // --- Geographic Pinning (durable: tenant_geo_pins) ---

  /**
   * Set the tenant's geo pin.
   *
   * REAL IMPL (BLACKFYRE 2026-06): updates the in-process cache synchronously
   * (signature kept stable — void) AND best-effort write-through to the durable
   * Postgres store so the pin survives restart. For a GUARANTEED durable write,
   * callers with a db handle should `await persistGeoPin()`.
   */
  setGeoPin(pin: GeoPin): void {
    this.geoPins.set(pin.tenantId, pin);
    if (this.db) {
      void this.persistGeoPin(pin).catch((err) => {
        this.log?.warn(
          {
            event: "sovereignty.geopin.persist.failed",
            tenantId: pin.tenantId,
            error: err instanceof Error ? err.message : String(err),
          },
          "Failed to durably persist tenant geo pin (cache updated, DB write-through failed)",
        );
      });
    }
  }

  /**
   * Get the tenant's geo pin from the in-process cache. Signature kept stable
   * (synchronous). For a durable read that survives restart, use
   * `await loadGeoPin()`, which reads Postgres and repopulates the cache.
   */
  getGeoPin(tenantId: string): GeoPin | undefined {
    return this.geoPins.get(tenantId);
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): durably persist the tenant's geo pin to
   * `tenant_geo_pins` via PARAMETERIZED SQL (idempotent upsert on the tenant_id
   * PK). Also refreshes the in-process cache. No-op (cache-only) when no db
   * handle. Geo-pin data is non-secret residency policy — safe to log at info.
   */
  async persistGeoPin(pin: GeoPin): Promise<void> {
    this.geoPins.set(pin.tenantId, pin);
    if (!this.db) return;

    await this.db.execute(sql`
      INSERT INTO tenant_geo_pins (
        tenant_id, allowed_regions, primary_region, data_residency_law,
        enforced, updated_at
      ) VALUES (
        ${pin.tenantId}, ${pin.allowedRegions},
        ${pin.primaryRegion}, ${pin.dataResidencyLaw}, ${pin.enforced}, now()
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        allowed_regions = EXCLUDED.allowed_regions,
        primary_region = EXCLUDED.primary_region,
        data_residency_law = EXCLUDED.data_residency_law,
        enforced = EXCLUDED.enforced,
        updated_at = now()
    `);

    this.log?.info(
      {
        event: "sovereignty.geopin.persisted",
        tenantId: pin.tenantId,
        primaryRegion: pin.primaryRegion,
        allowedRegions: pin.allowedRegions,
        dataResidencyLaw: pin.dataResidencyLaw,
        enforced: pin.enforced,
      },
      "Durably persisted tenant geo pin",
    );
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): durably load the tenant's geo pin from
   * `tenant_geo_pins` via PARAMETERIZED SQL, repopulate the in-process cache, and
   * return it (or undefined when no row exists). Cache-only fallback when no db
   * handle is wired.
   */
  async loadGeoPin(tenantId: string): Promise<GeoPin | undefined> {
    if (!this.db) return this.getGeoPin(tenantId);

    const rows = (await this.db.execute(sql`
      SELECT allowed_regions, primary_region, data_residency_law, enforced
      FROM tenant_geo_pins
      WHERE tenant_id = ${tenantId}
      LIMIT 1
    `)) as unknown as TenantGeoPinRow[];

    const row = rows[0];
    if (!row) return undefined;

    const pin: GeoPin = {
      tenantId,
      allowedRegions: Array.isArray(row.allowed_regions) ? row.allowed_regions : [],
      primaryRegion: row.primary_region,
      dataResidencyLaw: row.data_residency_law,
      enforced: row.enforced,
    };
    this.geoPins.set(tenantId, pin);
    return pin;
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): convenience hydrate — load BOTH the encryption
   * config and geo pin for a tenant from Postgres into the in-process cache so the
   * synchronous getters (getTenantConfig/getGeoPin/enforceGeoPin/getSovereigntyStatus)
   * return the durable values after a restart / cold start. Safe no-op when no db
   * handle is wired.
   */
  async hydrateTenant(tenantId: string): Promise<void> {
    if (!this.db) return;
    await Promise.all([this.loadTenantConfig(tenantId), this.loadGeoPin(tenantId)]);
  }

  /**
   * Verify that a request is being processed in an allowed region.
   * Returns allowed=false (does not throw) so the caller can decide how to handle violations.
   */
  enforceGeoPin(tenantId: string): GeoPinCheckResult {
    const pin = this.geoPins.get(tenantId);
    const currentRegion = process.env.AWS_REGION ?? process.env.BLACKFYRE_REGION ?? "us-east-1";

    if (!pin || !pin.enforced) {
      return { allowed: true, currentRegion };
    }

    if (!pin.allowedRegions.includes(currentRegion)) {
      return { allowed: false, currentRegion, pin };
    }

    return { allowed: true, currentRegion, pin };
  }

  /**
   * Full audit of encryption + residency config for a tenant.
   */
  getSovereigntyStatus(tenantId: string): SovereigntyStatus {
    const config = this.getTenantConfig(tenantId);
    const pin = this.getGeoPin(tenantId);
    const currentRegion = process.env.AWS_REGION ?? process.env.BLACKFYRE_REGION ?? "us-east-1";
    const issues: string[] = [];

    if (config.mode === "blackfyre-managed") {
      issues.push("Using vendor-managed encryption — switch to BYOK for sovereign compliance");
    }
    if (pin && pin.enforced && !pin.allowedRegions.includes(currentRegion)) {
      issues.push(
        `Data residency violation: processing in ${currentRegion}, allowed: ${pin.allowedRegions.join(", ")}`,
      );
    }
    if (!pin) {
      issues.push("No geographic pinning configured — data may be processed in any region");
    }

    return {
      encryptionMode: config.mode,
      byokEnabled: config.mode !== "blackfyre-managed",
      keyId: config.awsKmsKeyArn
        ?? (config.azureKeyVaultUrl ? `${config.azureKeyVaultUrl}/${config.azureKeyName}` : null),
      geoPin: pin,
      currentRegion,
      compliant: issues.length === 0,
      issues,
    };
  }

  /**
   * Validate BYOK key connectivity without encrypting real data.
   * Returns { reachable, latencyMs, error? }.
   */
  async testKeyConnectivity(
    tenantId: string,
  ): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
    const config = this.getTenantConfig(tenantId);
    const start = Date.now();

    if (config.mode === "blackfyre-managed") {
      return { reachable: true, latencyMs: 0 };
    }

    if (config.mode === "client-byok-aws") {
      if (!config.awsKmsKeyArn) {
        return { reachable: false, latencyMs: 0, error: "No KMS key ARN configured" };
      }
      try {
        // Encrypt a tiny test payload to confirm KMS reachability
        await this.encryptWithAwsKms(tenantId, "connectivity-test", config);
        return { reachable: true, latencyMs: Date.now() - start };
      } catch (err) {
        return {
          reachable: false,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    if (config.mode === "client-byok-azure") {
      if (!config.azureKeyVaultUrl || !config.azureKeyName) {
        return { reachable: false, latencyMs: 0, error: "Azure Key Vault URL or key name not configured" };
      }
      // REAL IMPL (BLACKFYRE 2026-06): probe the vault with an actual wrapKey on a
      // throwaway 32-byte buffer. Success proves auth + key access + RSA-OAEP-256
      // support without ever persisting customer ciphertext.
      try {
        const { client, keyId } = this.buildAzureCrypto(config);
        const probe = randomBytes(32);
        try {
          await client.wrapKey(AZURE_KEY_WRAP_ALG, probe);
        } finally {
          probe.fill(0);
        }
        this.log?.info(
          { event: "azure.keyvault.connectivity.ok", tenantId, keyId },
          "Azure Key Vault BYOK connectivity probe succeeded",
        );
        return { reachable: true, latencyMs: Date.now() - start };
      } catch (err) {
        this.log?.warn(
          {
            event: "azure.keyvault.connectivity.failed",
            tenantId,
            error: err instanceof Error ? err.message : String(err),
          },
          "Azure Key Vault BYOK connectivity probe failed",
        );
        return {
          reachable: false,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return { reachable: false, latencyMs: 0, error: "Unknown encryption mode" };
  }
}
