import { Queue, type JobsOptions } from "bullmq";
import type { Redis } from "ioredis";
import type { SecretEnvelope } from "../services/encryption-provider-service.js";

// SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext cloud credentials on the scan
// job queue — `credentialRef` could carry raw inline secret material (the agent
// resolver accepts raw JSON creds), and BullMQ retains failed jobs for 30 days
// (removeOnFail.age below), so any failed scan left tenant secrets sitting in Redis in
// the clear. The job payload now carries ONLY a non-secret credential reference (the
// integration id) plus, when the integration stored inline secret material, an
// AES-256-GCM `SecretEnvelope` (ciphertext + nonce + authTag + keyId) produced by
// EncryptionProviderService.encryptSecret(). The worker resolves the reference and
// decrypts the envelope (via EncryptionProviderService.decryptSecret) at run time, so
// no plaintext credential is ever persisted on the queue. `credentialRef` is retained
// on the type for back-compat with already-safe pointer refs (vault:// / arn:aws:iam::)
// and downstream consumers, but MUST NOT be populated with raw secret material.
export interface ScanJobData {
  scanId: string;
  tenantId: string;
  frameworks: string[];
  targets: string[];
  scanTypes?: string[];
  triggeredBy: string;
  integrations: Array<{
    id: string;
    type: string;
    /**
     * Non-secret credential reference. Holds an integration id or an already-safe
     * pointer (vault:// path, arn:aws:iam:: role ARN). NEVER raw secret material —
     * inline secrets are carried encrypted in `credentialEnvelope` instead.
     */
    credentialRef: string;
    /**
     * AES-256-GCM envelope of inline secret material, present only when the source
     * `credentialRef` was raw secret material rather than a safe pointer. The worker
     * MUST decrypt this via EncryptionProviderService.decryptSecret() at run time and
     * resolve credentials from the plaintext. Never log this value.
     */
    credentialEnvelope?: SecretEnvelope;
  }>;
  /**
   * Repository / on-prem source descriptor. Like `integrations`, this MUST NOT carry raw
   * secret material on the queue or in the persisted scans.repoSource JSONB column.
   *
   * SECURITY FIX (BLACKFYRE audit 2026-06-05) fix-up: repoSource encryption path —
   * ScanService.create() routes inline `credentialRef` material (e.g. AD bindCredential,
   * SNMP community/auth keys, git PAT) through isSafeCredentialRef() + encryptSecret(),
   * stripping the plaintext `credentialRef` and storing an AES-256-GCM `credentialEnvelope`
   * instead. The worker decrypts the envelope at run time; API responses redact both fields
   * via redactCredentials(). `credentialRef` is retained ONLY for already-safe pointer refs
   * (vault:// / arn:aws:iam::) — never raw secret material.
   */
  repoSource?: {
    provider: string;
    repoUrl: string;
    branch?: string;
    /**
     * Non-secret pointer only (vault:// / arn:aws:iam::). Inline secrets are carried
     * encrypted in `credentialEnvelope` instead. Never raw secret material; never logged.
     */
    credentialRef?: string;
    /**
     * AES-256-GCM envelope of inline repoSource secret material, present only when the
     * source `credentialRef` was raw secret material rather than a safe pointer. The worker
     * MUST decrypt this via EncryptionProviderService.decryptSecret() at run time. Never
     * log this value.
     */
    credentialEnvelope?: SecretEnvelope;
  } | null;
}

export interface ScanJobResult {
  scanId: string;
  findingsCount: number;
  agentResults: Array<{
    agentType: string;
    status: string;
    findingsCount: number;
    error: string | null;
  }>;
  completedAt: string;
}

const SCAN_QUEUE_NAME = "scan-jobs";

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  // GAP-023: Retry with exponential backoff (spec Section 10)
  // Scans get 3 attempts with exponential backoff (1min, 2min, 4min)
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 60_000, // 1 minute initial delay
  },
  removeOnComplete: {
    age: 7 * 24 * 60 * 60,  // Keep completed jobs for 7 days
    count: 1000,
  },
  removeOnFail: {
    age: 30 * 24 * 60 * 60,  // Keep failed jobs for 30 days
    count: 500,
  },
};

export function createScanQueue(connection: Redis): Queue<ScanJobData, ScanJobResult> {
  return new Queue<ScanJobData, ScanJobResult>(SCAN_QUEUE_NAME, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

export { SCAN_QUEUE_NAME };
