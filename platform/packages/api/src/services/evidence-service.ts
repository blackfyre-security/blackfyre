import { eq, and, count } from "drizzle-orm";
import { evidence } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { notFound } from "../utils/errors.js";
import { createHash, randomUUID } from "node:crypto";
import type { EvidenceS3Service } from "./evidence-s3.js";
import { safeFetch, SsrfBlockedError } from "../lib/safe-fetch.js";

/** Minimal structured-logger shape (Fastify/pino compatible). */
type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

/**
 * REAL IMPL (BLACKFYRE 2026-06): what `sha256_hash` was actually computed over.
 * This is the single source of truth for whether a record is content-tamper-evident.
 *   - "content"         the caller supplied the evidence bytes and we hashed them.
 *   - "reference-fetch" the caller supplied a URL; we fetched the real bytes (safeFetch)
 *                       and hashed those.
 *   - "metadata-only"   NO content was available; the hash covers collection metadata
 *                       only and MUST NEVER be presented as content-tamper-evident.
 */
export type EvidenceHashSource = "content" | "reference-fetch" | "metadata-only";

/** Cap on bytes we will fetch+hash for a reference, to avoid unbounded memory use. */
const MAX_REFERENCE_BYTES = 25 * 1024 * 1024; // 25 MiB

export interface CreateEvidenceInput {
  findingId: string;
  type: string;
  collectedBy: string;
  /** Inline evidence bytes/text. When present, this is hashed directly. */
  content?: string | Buffer;
  /** URL to fetch the real evidence bytes from (hashed via reference-fetch). */
  contentUrl?: string;
  framework?: string;
}

export class EvidenceService {
  // REAL IMPL (BLACKFYRE 2026-06): optional structured logger so evidence-integrity
  // decisions (content hashed / reference fetched / metadata-only fallback) are
  // recorded as audit events. Defaulted to a no-op so every existing
  // `new EvidenceService(db)` call site builds unchanged. NEVER logs evidence bytes.
  private readonly log: Logger;

  constructor(private db: Db, log?: Logger) {
    this.log = log ?? { info: () => {}, warn: () => {} };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): tamper-evidence honesty.
   *
   * The SHA-256 stored in `sha256_hash` is computed over the ACTUAL evidence bytes:
   *   1. If `content` is provided, hash those bytes               → hash_source="content".
   *   2. Else if `contentUrl` is provided, fetch the real bytes via the SSRF-hardened
   *      safeFetch and hash them                                  → hash_source="reference-fetch".
   *   3. Otherwise we have nothing to hash. We DO NOT fabricate a content-tamper-evident
   *      record: we mark the row hash_source="metadata-only" and integrity_verified=false
   *      and compute a (non-tamper-evident) digest over collection metadata only so the
   *      column stays populated and unique. Vault/verify surfaces never claim integrity
   *      over such a record.
   *
   * We never claim tamper-evidence over data we did not hash.
   */
  async create(tenantId: string, data: CreateEvidenceInput) {
    const storagePath = `evidence/${tenantId}/${data.findingId}/${randomUUID()}`;

    let sha256Hash: string;
    let hashSource: EvidenceHashSource;
    let integrityVerified: boolean;

    if (data.content !== undefined) {
      // (1) Hash the actual content bytes the caller handed us.
      const buf = typeof data.content === "string" ? Buffer.from(data.content, "utf-8") : data.content;
      sha256Hash = createHash("sha256").update(buf).digest("hex");
      hashSource = "content";
      integrityVerified = true;
      this.log.info(
        { event: "evidence.hash", outcome: "content", tenantId, findingId: data.findingId, hashSource, bytes: buf.byteLength },
        "Evidence hashed from supplied content",
      );
    } else if (data.contentUrl) {
      // (2) Fetch the REAL bytes from the reference URL and hash them.
      const fetched = await this.hashReference(tenantId, data.findingId, data.contentUrl);
      if (fetched) {
        sha256Hash = fetched.sha256Hash;
        hashSource = "reference-fetch";
        integrityVerified = true;
        this.log.info(
          { event: "evidence.hash", outcome: "reference-fetch", tenantId, findingId: data.findingId, hashSource, bytes: fetched.bytes },
          "Evidence hashed from fetched reference bytes",
        );
      } else {
        // Fetch failed / blocked — fall back to an HONEST metadata-only record.
        ({ sha256Hash, hashSource, integrityVerified } = this.metadataOnlyHash(tenantId, data, "reference_fetch_failed"));
      }
    } else {
      // (3) No content and no reference → metadata-only, NOT tamper-evident.
      ({ sha256Hash, hashSource, integrityVerified } = this.metadataOnlyHash(tenantId, data, "no_content_provided"));
    }

    const [created] = await this.db
      .insert(evidence)
      .values({
        findingId: data.findingId,
        tenantId,
        type: data.type as any,
        storagePath,
        sha256Hash,
        hashSource,
        integrityVerified,
        framework: data.framework,
        collectedBy: data.collectedBy,
      })
      .returning();

    return created;
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): fetch the real bytes behind a reference URL through
   * the SSRF-hardened safeFetch and return their SHA-256. Returns null (caller falls
   * back to metadata-only) on any failure — we never substitute a metadata hash and
   * pretend it covers the referenced content.
   */
  private async hashReference(
    tenantId: string,
    findingId: string,
    url: string,
  ): Promise<{ sha256Hash: string; bytes: number } | null> {
    try {
      const res = await safeFetch(url, { method: "GET" }, { log: this.log as any });
      if (!res.ok) {
        this.log.warn(
          { event: "evidence.reference_fetch", outcome: "non_ok_status", tenantId, findingId, status: res.status },
          "Evidence reference fetch returned non-OK status; falling back to metadata-only",
        );
        return null;
      }

      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength > MAX_REFERENCE_BYTES) {
        this.log.warn(
          { event: "evidence.reference_fetch", outcome: "too_large", tenantId, findingId, bytes: arrayBuf.byteLength, max: MAX_REFERENCE_BYTES },
          "Evidence reference exceeds max size; falling back to metadata-only",
        );
        return null;
      }

      const buf = Buffer.from(arrayBuf);
      const sha256Hash = createHash("sha256").update(buf).digest("hex");
      return { sha256Hash, bytes: buf.byteLength };
    } catch (err) {
      const blocked = err instanceof SsrfBlockedError;
      this.log.warn(
        {
          event: "evidence.reference_fetch",
          outcome: blocked ? "ssrf_blocked" : "fetch_error",
          tenantId,
          findingId,
          // Do not log the URL host on SSRF (safeFetch already logged it); never log bytes.
          error: err instanceof Error ? err.name : "unknown",
        },
        "Evidence reference fetch failed; falling back to metadata-only",
      );
      return null;
    }
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): build an HONEST metadata-only record. The digest is
   * computed over collection metadata so the NOT-NULL column stays populated and unique,
   * but it is explicitly flagged hash_source="metadata-only" / integrity_verified=false
   * so it is NEVER presented as content-tamper-evident.
   */
  private metadataOnlyHash(
    tenantId: string,
    data: CreateEvidenceInput,
    reason: string,
  ): { sha256Hash: string; hashSource: EvidenceHashSource; integrityVerified: boolean } {
    const hashInput = JSON.stringify({
      kind: "metadata-only",
      findingId: data.findingId,
      collectedBy: data.collectedBy,
      type: data.type,
      collectedAt: new Date().toISOString(),
      nonce: randomUUID(),
    });
    const sha256Hash = createHash("sha256").update(hashInput, "utf-8").digest("hex");
    this.log.warn(
      { event: "evidence.hash", outcome: "metadata-only", reason, tenantId, findingId: data.findingId, hashSource: "metadata-only", integrityVerified: false },
      "Evidence stored without content hash; record is NOT content-tamper-evident",
    );
    return { sha256Hash, hashSource: "metadata-only", integrityVerified: false };
  }

  async listForFinding(
    tenantId: string,
    filters: { findingId?: string; type?: string; limit: number; offset: number },
  ) {
    const conditions = [eq(evidence.tenantId, tenantId)];

    if (filters.findingId) conditions.push(eq(evidence.findingId, filters.findingId));
    if (filters.type) conditions.push(eq(evidence.type, filters.type as any));

    const where = and(...conditions);

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(evidence)
        .where(where)
        .limit(filters.limit)
        .offset(filters.offset)
        .orderBy(evidence.collectedAt),
      this.db
        .select({ count: count() })
        .from(evidence)
        .where(where),
    ]);

    return { rows, total: total.count };
  }

  async getById(id: string) {
    const [row] = await this.db
      .select()
      .from(evidence)
      .where(eq(evidence.id, id))
      .limit(1);

    if (!row) throw notFound("Evidence");
    return row;
  }

  async getByIdForTenant(id: string, tenantId: string) {
    const [row] = await this.db
      .select()
      .from(evidence)
      .where(and(eq(evidence.id, id), eq(evidence.tenantId, tenantId)))
      .limit(1);

    if (!row) throw notFound("Evidence");
    return row;
  }

  async listVault(
    tenantId: string,
    filters: { framework?: string; limit: number; offset: number },
  ) {
    const conditions = [eq(evidence.tenantId, tenantId)];

    if (filters.framework) {
      conditions.push(eq(evidence.framework, filters.framework));
    }

    const where = and(...conditions);

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(evidence)
        .where(where)
        .limit(filters.limit)
        .offset(filters.offset)
        .orderBy(evidence.collectedAt),
      this.db
        .select({ count: count() })
        .from(evidence)
        .where(where),
    ]);

    return { rows, total: total.count };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): re-verify SHA-256 integrity against the S3 object.
   *
   * Honesty rules — we never claim tamper-evidence over data we did not hash:
   *   - A metadata-only record (hash_source="metadata-only") was never hashed over its
   *     content, so its integrity CANNOT be verified. We return valid=false with an
   *     explicit reason instead of comparing a meaningless digest.
   *   - With real evidence bytes in S3 we recompute and compare the hex digest.
   */
  async verifyIntegrity(
    evidenceId: string,
    s3Service: EvidenceS3Service,
  ): Promise<{ valid: boolean; expected: string; actual: string; hashSource: string; reason?: string }> {
    const record = await this.getById(evidenceId);
    const hashSource = (record as { hashSource?: string }).hashSource ?? "metadata-only";

    // REAL IMPL (BLACKFYRE 2026-06): refuse to assert integrity over a metadata-only hash.
    if (hashSource === "metadata-only") {
      this.log.warn(
        { event: "evidence.verify", outcome: "not_tamper_evident", evidenceId, tenantId: record.tenantId, hashSource },
        "Integrity verify requested for a metadata-only record; not content-tamper-evident",
      );
      return {
        valid: false,
        expected: record.sha256Hash,
        actual: "not-applicable",
        hashSource,
        reason: "metadata-only record: hash does not cover evidence content and is not tamper-evident",
      };
    }

    if (!record.s3ObjectKey) {
      this.log.warn(
        { event: "evidence.verify", outcome: "no_s3_key", evidenceId, tenantId: record.tenantId, hashSource },
        "Integrity verify requested but evidence has no S3 object",
      );
      return { valid: false, expected: record.sha256Hash, actual: "no-s3-key", hashSource, reason: "evidence not yet uploaded to S3" };
    }

    const valid = await s3Service.verifyEvidence(record.s3ObjectKey, record.sha256Hash);

    this.log.info(
      { event: "evidence.verify", outcome: valid ? "match" : "mismatch", evidenceId, tenantId: record.tenantId, hashSource },
      valid ? "Evidence integrity verified" : "Evidence integrity MISMATCH (possible tampering)",
    );

    // If valid=true, actual matches expected. If false, content was tampered (actual unknown).
    return {
      valid,
      expected: record.sha256Hash,
      actual: valid ? record.sha256Hash : "mismatch",
      hashSource,
    };
  }
}
