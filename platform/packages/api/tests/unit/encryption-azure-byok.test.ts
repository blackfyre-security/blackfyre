// REAL IMPL (BLACKFYRE 2026-06): unit tests for Azure Key Vault BYOK wrap/unwrap.
// Verifies the EncryptionProviderService envelope-encrypts under a *mocked*
// CryptographyClient (RSA-OAEP-256 wrap/unwrap) and that the data is recoverable
// — i.e. the old throw-stub is gone. A live Azure Key Vault is required to verify
// against the real service (see needsLiveEnv); here we assert the integration
// contract (algorithm, key id, envelope shape, round-trip, revocation surfacing).
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Shared mock state. Declared via vi.hoisted so it is initialised BEFORE the
// hoisted vi.mock factories run (factories may not close over normal top-level
// consts). `state.revoked` lets a test simulate the customer disabling the key.
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => {
  const wrapCalls: Array<{ keyId: string; algorithm: string; keyBytes: Uint8Array }> = [];
  const unwrapCalls: Array<{ keyId: string; algorithm: string }> = [];
  const clientSecretCtor = vi.fn();
  const defaultCredCtor = vi.fn();
  const state = { revoked: false };
  return { wrapCalls, unwrapCalls, clientSecretCtor, defaultCredCtor, state };
});
const { wrapCalls, unwrapCalls, clientSecretCtor, defaultCredCtor } = h;

// ---------------------------------------------------------------------------
// Mock @azure/identity — capture which credential type is constructed, and with
// what args, WITHOUT ever asserting on the secret beyond "it was passed".
// ---------------------------------------------------------------------------
vi.mock("@azure/identity", () => {
  class ClientSecretCredential {
    constructor(tenantId: string, clientId: string, clientSecret: string) {
      h.clientSecretCtor(tenantId, clientId, clientSecret);
    }
  }
  class DefaultAzureCredential {
    constructor() {
      h.defaultCredCtor();
    }
  }
  return { ClientSecretCredential, DefaultAzureCredential };
});

// ---------------------------------------------------------------------------
// Mock @azure/keyvault-keys CryptographyClient. The mock simulates a real RSA
// key-wrap: wrapKey returns an opaque blob; unwrapKey reverses it back to the
// exact DEK bytes. It records the keyId + algorithm so tests can assert the
// service used RSA-OAEP-256 against the correct key version.
// ---------------------------------------------------------------------------
vi.mock("@azure/keyvault-keys", () => {
  class CryptographyClient {
    keyId: string;
    revoked: boolean;
    constructor(keyId: string, _credential: unknown) {
      this.keyId = keyId;
      this.revoked = h.state.revoked;
    }
    async wrapKey(algorithm: string, key: Uint8Array) {
      if (this.revoked) throw new Error("KeyDisabledError: operation not permitted");
      h.wrapCalls.push({ keyId: this.keyId, algorithm, keyBytes: Uint8Array.from(key) });
      // "Wrap": prefix the raw key with a marker so we know unwrap actually ran.
      const wrapped = new Uint8Array(key.length + 4);
      wrapped.set([0xab, 0xcd, 0xef, 0x01], 0);
      wrapped.set(key, 4);
      return { result: wrapped, keyID: this.keyId, algorithm };
    }
    async unwrapKey(algorithm: string, encryptedKey: Uint8Array) {
      if (this.revoked) throw new Error("KeyDisabledError: operation not permitted");
      h.unwrapCalls.push({ keyId: this.keyId, algorithm });
      // "Unwrap": strip the 4-byte marker to recover the original key.
      const marker = encryptedKey.subarray(0, 4);
      if (marker[0] !== 0xab || marker[1] !== 0xcd || marker[2] !== 0xef || marker[3] !== 0x01) {
        throw new Error("DecryptError: wrapped key is not valid");
      }
      return { result: Uint8Array.from(encryptedKey.subarray(4)), keyID: this.keyId, algorithm };
    }
  }
  return { CryptographyClient };
});

// Import AFTER mocks are registered.
import { EncryptionProviderService } from "../../src/services/encryption-provider-service.js";
import type { EncryptionConfig } from "../../src/services/encryption-provider-service.js";

const TENANT = "tenant-byok-az";
const VAULT = "https://contoso-vault.vault.azure.net";
const KEY_NAME = "tenant-kek";

function azureConfig(overrides: Partial<EncryptionConfig> = {}): EncryptionConfig {
  return {
    mode: "client-byok-azure",
    azureKeyVaultUrl: VAULT,
    azureKeyName: KEY_NAME,
    azureTenantId: "az-tenant",
    azureClientId: "az-client",
    azureClientSecret: "az-secret-not-logged",
    ...overrides,
  };
}

function captureLogger() {
  const records: Array<{ level: string; obj: Record<string, unknown>; msg?: string }> = [];
  return {
    records,
    info: (obj: Record<string, unknown>, msg?: string) => records.push({ level: "info", obj, msg }),
    warn: (obj: Record<string, unknown>, msg?: string) => records.push({ level: "warn", obj, msg }),
  };
}

describe("Azure Key Vault BYOK (mocked CryptographyClient)", () => {
  beforeEach(() => {
    wrapCalls.length = 0;
    unwrapCalls.length = 0;
    clientSecretCtor.mockClear();
    defaultCredCtor.mockClear();
    h.state.revoked = false;
  });

  it("round-trips: encryptField then decryptField recovers the plaintext", async () => {
    const svc = new EncryptionProviderService();
    svc.setTenantConfig(TENANT, azureConfig());

    const plaintext = "sovereign-secret-éñ你好-payload";
    const field = await svc.encryptField(TENANT, plaintext);

    expect(field.mode).toBe("client-byok-azure");
    expect(field.algorithm).toBe("aes-256-gcm");
    expect(field.keyId).toBe(`${VAULT}/keys/${KEY_NAME}`);

    const recovered = await svc.decryptField(TENANT, field);
    expect(recovered).toBe(plaintext);
  });

  it("wraps and unwraps the DEK with RSA-OAEP-256 against the configured key id", async () => {
    const svc = new EncryptionProviderService();
    svc.setTenantConfig(TENANT, azureConfig());

    const field = await svc.encryptField(TENANT, "hello");
    await svc.decryptField(TENANT, field);

    expect(wrapCalls).toHaveLength(1);
    expect(wrapCalls[0].algorithm).toBe("RSA-OAEP-256");
    expect(wrapCalls[0].keyId).toBe(`${VAULT}/keys/${KEY_NAME}`);
    expect(wrapCalls[0].keyBytes.length).toBe(32); // AES-256 DEK

    expect(unwrapCalls).toHaveLength(1);
    expect(unwrapCalls[0].algorithm).toBe("RSA-OAEP-256");
    expect(unwrapCalls[0].keyId).toBe(`${VAULT}/keys/${KEY_NAME}`);
  });

  it("uses ClientSecretCredential when SP creds are present", async () => {
    const svc = new EncryptionProviderService();
    svc.setTenantConfig(TENANT, azureConfig());
    await svc.encryptField(TENANT, "x");
    expect(clientSecretCtor).toHaveBeenCalledWith("az-tenant", "az-client", "az-secret-not-logged");
    expect(defaultCredCtor).not.toHaveBeenCalled();
  });

  it("falls back to DefaultAzureCredential when SP creds are absent", async () => {
    const svc = new EncryptionProviderService();
    svc.setTenantConfig(
      TENANT,
      azureConfig({ azureTenantId: undefined, azureClientId: undefined, azureClientSecret: undefined }),
    );
    await svc.encryptField(TENANT, "x");
    expect(defaultCredCtor).toHaveBeenCalledTimes(1);
    expect(clientSecretCtor).not.toHaveBeenCalled();
  });

  it("pins the key version in the envelope keyId and unwraps against that version", async () => {
    const svc = new EncryptionProviderService();
    svc.setTenantConfig(TENANT, azureConfig({ azureKeyVersion: "v-2024-01" }));

    const field = await svc.encryptField(TENANT, "rotate-me");
    expect(field.keyId).toBe(`${VAULT}/keys/${KEY_NAME}/v-2024-01`);

    const recovered = await svc.decryptField(TENANT, field);
    expect(recovered).toBe("rotate-me");
    expect(unwrapCalls[0].keyId).toBe(`${VAULT}/keys/${KEY_NAME}/v-2024-01`);
  });

  it("decrypts using the envelope's keyId even if tenant config later loses vault details", async () => {
    const svc = new EncryptionProviderService();
    svc.setTenantConfig(TENANT, azureConfig({ azureKeyVersion: "v9" }));
    const field = await svc.encryptField(TENANT, "durable");

    // Simulate config drift: vault url/name/version removed, creds retained for auth.
    svc.setTenantConfig(TENANT, {
      mode: "client-byok-azure",
      azureTenantId: "az-tenant",
      azureClientId: "az-client",
      azureClientSecret: "az-secret-not-logged",
    });

    const recovered = await svc.decryptField(TENANT, field);
    expect(recovered).toBe("durable");
    expect(unwrapCalls[0].keyId).toBe(`${VAULT}/keys/${KEY_NAME}/v9`);
  });

  it("surfaces key revocation as a thrown error on decrypt (no silent stub)", async () => {
    const svc = new EncryptionProviderService();
    svc.setTenantConfig(TENANT, azureConfig());
    const field = await svc.encryptField(TENANT, "guarded");

    // Customer revokes/disables the key before decrypt.
    h.state.revoked = true;
    await expect(svc.decryptField(TENANT, field)).rejects.toThrow(/unwrapKey failed/i);
  });

  it("fails wrap when the wrong auth tag is detected on decrypt (GCM integrity)", async () => {
    const svc = new EncryptionProviderService();
    svc.setTenantConfig(TENANT, azureConfig());
    const field = await svc.encryptField(TENANT, "tamper-target");

    // Flip the auth tag — GCM must reject.
    const badTag = Buffer.from(field.authTag, "base64");
    badTag[0] ^= 0xff;
    const tampered = { ...field, authTag: badTag.toString("base64") };

    await expect(svc.decryptField(TENANT, tampered)).rejects.toThrow();
  });

  it("emits structured wrap/unwrap audit logs without leaking secrets", async () => {
    const logger = captureLogger();
    const svc = new EncryptionProviderService(logger);
    svc.setTenantConfig(TENANT, azureConfig());

    const field = await svc.encryptField(TENANT, "audited");
    await svc.decryptField(TENANT, field);

    const events = logger.records.map((r) => r.obj.event);
    expect(events).toContain("azure.keyvault.wrap.ok");
    expect(events).toContain("azure.keyvault.unwrap.ok");

    // No record may carry the client secret or plaintext DEK material.
    const serialized = JSON.stringify(logger.records);
    expect(serialized).not.toContain("az-secret-not-logged");
    expect(serialized).not.toContain("audited");
  });

  it("logs a warn audit event when wrap fails (revoked key)", async () => {
    const logger = captureLogger();
    const svc = new EncryptionProviderService(logger);
    svc.setTenantConfig(TENANT, azureConfig());

    h.state.revoked = true;
    await expect(svc.encryptField(TENANT, "blocked")).rejects.toThrow(/wrapKey failed/i);

    const warn = logger.records.find((r) => r.level === "warn");
    expect(warn?.obj.event).toBe("azure.keyvault.wrap.failed");
    expect(JSON.stringify(logger.records)).not.toContain("az-secret-not-logged");
  });

  it("testKeyConnectivity performs a real wrap probe and reports reachable", async () => {
    const svc = new EncryptionProviderService();
    svc.setTenantConfig(TENANT, azureConfig());

    const result = await svc.testKeyConnectivity(TENANT);
    expect(result.reachable).toBe(true);
    expect(result.error).toBeUndefined();
    // Probe must use a real wrap call (RSA-OAEP-256) — not a stubbed "requires
    // production connection" message.
    expect(wrapCalls).toHaveLength(1);
    expect(wrapCalls[0].algorithm).toBe("RSA-OAEP-256");
  });

  it("testKeyConnectivity reports unreachable when the key is revoked", async () => {
    const svc = new EncryptionProviderService();
    svc.setTenantConfig(TENANT, azureConfig());

    h.state.revoked = true;
    const result = await svc.testKeyConnectivity(TENANT);
    expect(result.reachable).toBe(false);
    expect(result.error).toMatch(/not permitted|KeyDisabled/i);
  });

  it("rejects a malformed envelope (truncated wrapped key)", async () => {
    const svc = new EncryptionProviderService();
    svc.setTenantConfig(TENANT, azureConfig());
    const field = await svc.encryptField(TENANT, "x");

    // Corrupt the length prefix to claim a longer wrapped key than present.
    const env = Buffer.from(field.ciphertext, "base64");
    env[0] = 0xff;
    env[1] = 0xff;
    const broken = { ...field, ciphertext: env.toString("base64") };

    await expect(svc.decryptField(TENANT, broken)).rejects.toThrow(/Malformed Azure BYOK envelope/);
  });
});
