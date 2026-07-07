import { createHash, createHmac, timingSafeEqual } from "crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { evidenceChain } from "../../db/schema.js";
import type { Db } from "../../db/connection.js";

/*
 * REAL IMPL (BLACKFYRE 2026-06): durable, append-only, tamper-evident evidence
 * ledger — replaces the volatile in-memory Map.
 *
 * This service used to keep the "tamper-evident audit ledger" in a per-process
 * in-memory Map that was LOST on every restart / Lambda cold start — a fake
 * durability claim for a compliance product, and the DEFERRED FOLLOW-UP the
 * 2026-06-05 audit explicitly required. It is now backed by the append-only,
 * RLS-isolated `evidence_chain` Postgres table (migration 022_evidence_chain.sql):
 *
 *   - Every entry is hash-chained: entry_hash = sha256(prev_hash + sha256 + ...)
 *     over a canonical payload, with prev_hash = the previous entry's entry_hash
 *     ("GENESIS" for seq 1). The DB UNIQUE (tenant_id, seq) index makes the chain
 *     genuinely append-only: a replay / out-of-band insert at an existing seq is
 *     rejected by the database, not silently accepted.
 *   - When a server-side ledger key is configured, each entry is additionally
 *     HMAC-SHA-256 signed (entry_hmac) and verification checks the MACs in
 *     constant time — tamper-EVIDENT against anyone without the key. The key is
 *     derived from the encryption keyring (ENCRYPTION_KEYS / ENCRYPTION_MASTER_KEY,
 *     the same material EncryptionProviderService fails closed on) via a
 *     domain-separated HMAC, or taken from an explicit BLACKFYRE_LEDGER_HMAC_KEY.
 *
 * We remain HONEST about assurance level. Every result carries an explicit
 * `status`:
 *   "unverified"    — NO signing key configured: hash-chain self-consistency only
 *                     (detects accidental corruption + reordering/replay via the
 *                     DB seq, but NOT a malicious actor who can recompute hashes).
 *   "hmac-verified" — a server ledger key IS configured and the entry/chain MACs
 *                     validate (tamper-evident vs. anyone without the key).
 * Callers MUST surface `status` and MUST NOT claim cryptographic tamper-proofing
 * when status is "unverified".
 *
 * REAL IMPL (BLACKFYRE 2026-06): INTEGRATION STATUS — wiring is intentionally
 * DEFERRED (not forgotten).
 *   This service is feature-complete and unit-tested (tests/unit/evidence-chain.
 *   test.ts), but no production code path calls appendToChain() yet. The natural
 *   wiring point is EvidenceService.create() (services/evidence-service.ts): once
 *   an evidence row's content/reference digest (sha256Hash) is computed there, the
 *   same digest should be appended to this durable ledger so every evidence
 *   creation also produces a tamper-evident chain entry, e.g.:
 *
 *     const created = await evidenceService.create(tenantId, input);
 *     await new EvidenceChainService(db, log)
 *       .appendToChain(tenantId, created.id, created.sha256Hash, created.collectedBy);
 *
 *   That integration is held back from THIS change for two deliberate reasons:
 *     1. Architectural decision — whether *every* evidence create triggers a chain
 *        append (and whether metadata-only digests, which are NOT content-tamper-
 *        evident per migration 023, belong in the ledger at all) is a product/audit
 *        call, not a mechanical edit. Appending a metadata-only digest would put a
 *        non-tamper-evident value into a ledger that callers may present as
 *        "tamper-evident", so the honesty contract (hash_source) must be carried
 *        through before wiring — see EvidenceHashSource in evidence-service.ts.
 *     2. Scope — evidence-service.ts is owned by a different work item; this change
 *        owns only the ledger service + migrations. Wiring will land alongside the
 *        evidence-service integration so the two stay consistent (and so the chain
 *        append participates in the same transaction as the evidence insert).
 *   Until then this service is exercised only by its unit tests; the chain is real
 *   and durable the moment a caller invokes appendToChain().
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * Integrity assurance level actually backing a chain/entry result.
 * - "unverified": hash-chain self-consistency only (no signing key). Detects
 *   accidental corruption, NOT deliberate tampering.
 * - "hmac-verified": a server HMAC key is configured and the MACs validated.
 */
export type ChainIntegrityStatus = "unverified" | "hmac-verified";

export interface ChainEntry {
  id: string;
  tenantId: string;
  evidenceId: string;
  sha256Hash: string;
  previousEntryHash: string;
  entryHash: string;
  chainSequence: number;
  collectedAt: Date;
  collectedBy: string;
  createdAt: Date;
  /**
   * HMAC-SHA-256 over the canonical entry payload, present only when a server
   * signing key is configured. Absent => this entry is hash-chained but not
   * cryptographically signed (best-effort / "unverified").
   */
  entryHmac?: string;
}

export interface ChainVerificationResult {
  chainValid: boolean;
  entriesVerified: number;
  breaks: Array<{
    sequence: number;
    expectedHash: string;
    actualHash: string;
    evidenceId: string;
  }>;
  verifiedAt: Date;
  /**
   * Honest assurance level of THIS verification. Callers MUST surface this and
   * MUST NOT claim tamper-proofing when it is "unverified".
   */
  status: ChainIntegrityStatus;
  /**
   * Human-readable caveat describing exactly what was (and was not) checked.
   */
  assurance: string;
}

export interface ChainCertificate {
  tenantId: string;
  framework: string;
  chainLength: number;
  firstEntry: Date;
  lastEntry: Date;
  isValid: boolean;
  certificateHash: string;
  issuedAt: Date;
  /** Honest assurance level backing this certificate. */
  status: ChainIntegrityStatus;
  /**
   * HMAC-SHA-256 over the certificate payload when a signing key is configured;
   * otherwise undefined (the certificateHash alone is NOT a signature).
   */
  certificateHmac?: string;
  /** Human-readable caveat describing what this certificate does and does not prove. */
  assurance: string;
}

/** Minimal structured-logger shape (Fastify/pino compatible). */
type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

/* ------------------------------------------------------------------ */
/*  Server-side signing key (optional)                                 */
/* ------------------------------------------------------------------ */

const GENESIS_HASH = "GENESIS";

/** Domain-separation label so the ledger key is not the raw encryption key. */
const LEDGER_HMAC_INFO = "blackfyre-evidence-ledger-hmac-v1";

/**
 * Resolve the optional server-side HMAC key for ledger signing.
 *
 * REAL IMPL (BLACKFYRE 2026-06): a real ledger needs a real, configured key.
 * Resolution order (first match wins):
 *   1. BLACKFYRE_LEDGER_HMAC_KEY — an explicit, dedicated ledger key.
 *   2. The encryption keyring material the platform already requires to boot
 *      (ENCRYPTION_KEYS' primary value, else ENCRYPTION_MASTER_KEY), run through
 *      a domain-separated HMAC so the ledger key is cryptographically distinct
 *      from the data-encryption key (never sign with the same key you encrypt
 *      with).
 * Returns null only when NO key material is configured anywhere, in which case
 * the service degrades to an HONEST "unverified" status rather than pretending a
 * plain SHA-256 is a signature. There is intentionally NO default/dev key.
 */
function resolveLedgerHmacKey(): Buffer | null {
  const explicit = process.env.BLACKFYRE_LEDGER_HMAC_KEY;
  if (explicit && explicit.length > 0) {
    // Normalise any sufficiently-random secret to a stable 32-byte key.
    return createHash("sha256").update(explicit).digest();
  }

  // Derive from the encryption provider's configured key material. We do NOT
  // import the keyring loader (which fails closed / throws) — ledger signing is
  // best-effort and must degrade to "unverified" rather than crash the service.
  let base: string | undefined;
  const rawKeys = process.env.ENCRYPTION_KEYS;
  if (rawKeys) {
    try {
      const parsed = JSON.parse(rawKeys) as Record<string, string>;
      const preferredId = process.env.ENCRYPTION_KEY_ID;
      if (preferredId && typeof parsed[preferredId] === "string") {
        base = parsed[preferredId];
      } else {
        for (const v of Object.values(parsed)) {
          if (typeof v === "string" && v.length > 0) {
            base = v;
            break;
          }
        }
      }
    } catch {
      // Malformed ENCRYPTION_KEYS — ignore here and fall through to legacy / null.
    }
  }
  if (!base) {
    const legacy = process.env.ENCRYPTION_MASTER_KEY;
    if (legacy && legacy.length > 0) base = legacy;
  }
  if (!base) return null;

  // Domain-separated derivation: HMAC(masterKeyMaterial, info-label). Distinct
  // from EncryptionProviderService's data key (which is sha256(material)).
  const masterKey = createHash("sha256").update(base).digest();
  return createHmac("sha256", masterKey).update(LEDGER_HMAC_INFO).digest();
}

/* ------------------------------------------------------------------ */
/*  Evidence Chain Service (durable, hash-chained, optionally signed)  */
/* ------------------------------------------------------------------ */

export class EvidenceChainService {
  /** Optional server-side HMAC key; null => "unverified" assurance only. */
  private readonly hmacKey: Buffer | null = resolveLedgerHmacKey();

  private readonly log: Logger;

  /**
   * REAL IMPL (BLACKFYRE 2026-06): the ledger is now backed by Postgres
   * (`evidence_chain`). A `Db` handle is required. An optional pino-compatible
   * logger records append/verify as structured security/audit events (counts and
   * hashes only — never secrets, never raw key material).
   */
  constructor(private db: Db, log?: Logger) {
    this.log = log ?? { info: () => {}, warn: () => {} };
  }

  /** True when a server signing key is configured (enables "hmac-verified"). */
  get signingEnabled(): boolean {
    return this.hmacKey !== null;
  }

  /** Canonical, stable serialization of an entry's signed fields. */
  private canonicalEntryData(fields: {
    evidenceId: string;
    sha256Hash: string;
    previousEntryHash: string;
    chainSequence: number;
    collectedBy: string;
    timestamp: string;
  }): string {
    return JSON.stringify(fields);
  }

  /** HMAC-SHA-256 of arbitrary canonical data when a key is configured. */
  private sign(canonical: string): string | undefined {
    if (!this.hmacKey) return undefined;
    return createHmac("sha256", this.hmacKey).update(canonical).digest("hex");
  }

  /** Constant-time compare of two hex MACs of equal length. */
  private macEquals(a: string | undefined, b: string | undefined): boolean {
    if (!a || !b) return false;
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ab.length !== bb.length || ab.length === 0) return false;
    return timingSafeEqual(ab, bb);
  }

  private statusLabel(): ChainIntegrityStatus {
    return this.signingEnabled ? "hmac-verified" : "unverified";
  }

  private assuranceLabel(): string {
    return this.signingEnabled
      ? "HMAC-SHA-256 verified against the server ledger key, over a durable append-only " +
          "Postgres ledger (RLS tenant-isolated, UNIQUE (tenant_id, seq))."
      : "Hash-chain self-consistency only — NO signing key configured. Detects accidental " +
          "corruption and seq reordering/replay (enforced by the DB), NOT a malicious actor " +
          "able to recompute hashes. Not a cryptographic tamper-evidence guarantee.";
  }

  /** Map a DB row to the public ChainEntry shape. */
  private rowToEntry(row: typeof evidenceChain.$inferSelect): ChainEntry {
    return {
      id: row.id,
      tenantId: row.tenantId,
      evidenceId: row.evidenceId,
      sha256Hash: row.sha256,
      previousEntryHash: row.prevHash,
      entryHash: row.entryHash,
      chainSequence: row.seq,
      collectedAt: row.collectedAt,
      collectedBy: row.collectedBy,
      createdAt: row.createdAt,
      entryHmac: row.entryHmac ?? undefined,
    };
  }

  /**
   * Append a new evidence item to the durable chain.
   *
   * REAL IMPL (BLACKFYRE 2026-06): persisted to `evidence_chain` inside a
   * transaction. seq and prev_hash are derived from the current chain tail read
   * under the same transaction; the DB UNIQUE (tenant_id, seq) constraint is the
   * authoritative arbiter of append-only ordering, so two concurrent appenders
   * cannot both claim the same position — the loser retries against the new tail.
   */
  async appendToChain(
    tenantId: string,
    evidenceId: string,
    sha256Hash: string,
    collectedBy: string,
  ): Promise<ChainEntry> {
    const MAX_ATTEMPTS = 5;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const inserted = await this.db.transaction(async (tx) => {
          // Read the current chain tail for this tenant (RLS scopes to tenant).
          const [tail] = await tx
            .select()
            .from(evidenceChain)
            .where(eq(evidenceChain.tenantId, tenantId))
            .orderBy(desc(evidenceChain.seq))
            .limit(1);

          const previousEntryHash = tail?.entryHash ?? GENESIS_HASH;
          const chainSequence = (tail?.seq ?? 0) + 1;
          // REAL IMPL (BLACKFYRE 2026-06): timestamp is created INSIDE the
          // transaction, so a 23505 seq-conflict retry (a fresh transaction
          // iteration of the enclosing for-loop) recomputes it AND re-derives
          // prev_hash/seq from the new tail. The timestamp is part of the
          // HMAC'd/hashed canonical payload below and is persisted as collectedAt
          // (the single source of truth) so verifyChain recomputes the exact
          // hash/MAC from the stored row. The persisted collectedAt therefore
          // always equals the timestamp the winning attempt actually signed — we
          // intentionally do NOT reuse a pre-transaction timestamp across retries,
          // which would otherwise record a collection time that predates the
          // committed entry under contention.
          const timestamp = new Date();

          // collectedAt is the signed timestamp source-of-truth so verifyChain
          // can recompute the entry hash/MAC exactly from the stored columns.
          const canonical = this.canonicalEntryData({
            evidenceId,
            sha256Hash,
            previousEntryHash,
            chainSequence,
            collectedBy,
            timestamp: timestamp.toISOString(),
          });

          const entryHash = createHash("sha256").update(canonical).digest("hex");
          const entryHmac = this.sign(canonical);

          const [row] = await tx
            .insert(evidenceChain)
            .values({
              tenantId,
              evidenceId,
              seq: chainSequence,
              sha256: sha256Hash,
              prevHash: previousEntryHash,
              entryHash,
              entryHmac: entryHmac ?? null,
              collectedAt: timestamp,
              // REAL IMPL (BLACKFYRE 2026-06): persist the collector identity. It is a
              // NOT NULL column AND part of the canonical signed payload, so it must be
              // stored or verifyChain could never recompute the hash/MAC from the row.
              collectedBy,
            })
            .returning();

          return row;
        });

        // REAL IMPL (BLACKFYRE 2026-06): record the assurance level on EVERY append
        // so the audit trail itself proves, post-hoc, whether each entry was
        // cryptographically signed — callers no longer have to re-instantiate the
        // service to learn this. `status` is the authoritative assurance label
        // ("hmac-verified" => an HMAC was produced and persisted; "unverified" =>
        // hash-chain only). `signedEntry` reflects this SPECIFIC row's persisted
        // entry_hmac presence (more precise than the service-level signingEnabled,
        // e.g. if the key were rotated mid-chain). We log only the boolean and the
        // status label — NEVER the HMAC value and NEVER any key material.
        this.log.info(
          {
            event: "evidence_chain.append",
            tenantId,
            evidenceId,
            seq: inserted.seq,
            entryHash: inserted.entryHash,
            previousEntryHash: inserted.prevHash,
            status: this.statusLabel(),
            signedEntry: inserted.entryHmac != null,
          },
          "evidence chain entry appended",
        );

        return this.rowToEntry(inserted);
      } catch (err) {
        lastErr = err;
        // Unique (tenant_id, seq) violation => a concurrent appender took our
        // position. Re-read the tail and retry. Postgres unique-violation SQLSTATE
        // is 23505; postgres-js surfaces it on err.code.
        const code = (err as { code?: string } | null)?.code;
        if (code === "23505" && attempt < MAX_ATTEMPTS) {
          this.log.warn(
            { event: "evidence_chain.append_retry", tenantId, evidenceId, attempt },
            "evidence chain append seq conflict, retrying against new tail",
          );
          continue;
        }
        throw err;
      }
    }

    // Exhausted retries (sustained contention) — surface honestly.
    this.log.warn(
      { event: "evidence_chain.append_failed", tenantId, evidenceId },
      "evidence chain append failed after max retries",
    );
    throw lastErr instanceof Error
      ? lastErr
      : new Error("evidence chain append failed after max retries");
  }

  /**
   * Verify the integrity of the durable evidence chain by reading it from the DB.
   *
   * REAL IMPL (BLACKFYRE 2026-06): walks the persisted chain in seq order,
   * recomputing each entry hash (always) and validating entry HMACs in constant
   * time when a signing key is configured. Continuity is checked by linking each
   * entry's prev_hash to the predecessor's entry_hash; the DB seq ordering means
   * a deleted/inserted row shows up as a continuity break. Always returns an
   * explicit `status`/`assurance` so callers cannot mistake hash-chain
   * self-consistency for cryptographic tamper-evidence.
   */
  async verifyChain(
    tenantId: string,
    dateRange?: { from: Date; to: Date },
  ): Promise<ChainVerificationResult> {
    const rows = await this.db
      .select()
      .from(evidenceChain)
      .where(eq(evidenceChain.tenantId, tenantId))
      .orderBy(asc(evidenceChain.seq));

    const entries = (
      dateRange
        ? rows.filter((r) => r.collectedAt >= dateRange.from && r.collectedAt <= dateRange.to)
        : rows
    ).map((r) => this.rowToEntry(r));

    const breaks: ChainVerificationResult["breaks"] = [];

    // Continuity: each entry's prev_hash must match the previous entry's hash.
    for (let i = 1; i < entries.length; i++) {
      const current = entries[i];
      const previous = entries[i - 1];
      if (current.previousEntryHash !== previous.entryHash) {
        breaks.push({
          sequence: current.chainSequence,
          expectedHash: previous.entryHash,
          actualHash: current.previousEntryHash,
          evidenceId: current.evidenceId,
        });
      }
    }

    // Per-entry integrity: hash recomputation always, plus HMAC when signing.
    for (const entry of entries) {
      const canonical = this.canonicalEntryData({
        evidenceId: entry.evidenceId,
        sha256Hash: entry.sha256Hash,
        previousEntryHash: entry.previousEntryHash,
        chainSequence: entry.chainSequence,
        collectedBy: entry.collectedBy,
        timestamp: entry.collectedAt.toISOString(),
      });
      const recomputedHash = createHash("sha256").update(canonical).digest("hex");

      if (recomputedHash !== entry.entryHash) {
        breaks.push({
          sequence: entry.chainSequence,
          expectedHash: recomputedHash,
          actualHash: entry.entryHash,
          evidenceId: entry.evidenceId,
        });
        continue;
      }

      if (this.signingEnabled) {
        const expectedMac = this.sign(canonical);
        if (!this.macEquals(expectedMac, entry.entryHmac)) {
          breaks.push({
            sequence: entry.chainSequence,
            expectedHash: expectedMac ?? "<unsigned>",
            actualHash: entry.entryHmac ?? "<unsigned>",
            evidenceId: entry.evidenceId,
          });
        }
      }
    }

    const result: ChainVerificationResult = {
      chainValid: breaks.length === 0,
      entriesVerified: entries.length,
      breaks,
      verifiedAt: new Date(),
      status: this.statusLabel(),
      assurance: this.assuranceLabel(),
    };

    // Audit event: a failed verification is security-relevant.
    const logFn = result.chainValid ? this.log.info : this.log.warn;
    logFn.call(
      this.log,
      {
        event: "evidence_chain.verify",
        tenantId,
        entriesVerified: result.entriesVerified,
        chainValid: result.chainValid,
        breakCount: breaks.length,
        status: result.status,
      },
      result.chainValid ? "evidence chain verified" : "evidence chain integrity break detected",
    );

    return result;
  }

  /**
   * Generate an integrity attestation for the durable chain.
   *
   * The certificateHash is NOT a signature; `certificateHmac` is populated (and
   * is a real MAC) ONLY when a server signing key is configured. `status`/
   * `assurance` state exactly what is proven.
   */
  async generateChainCertificate(tenantId: string, framework: string): Promise<ChainCertificate> {
    const chain = await this.getChain(tenantId);
    const verification = await this.verifyChain(tenantId);

    const certData = JSON.stringify({
      tenantId,
      framework,
      chainLength: chain.length,
      verified: verification.chainValid,
      verifiedAt: verification.verifiedAt.toISOString(),
      status: verification.status,
    });

    const certificateHash = createHash("sha256").update(certData).digest("hex");
    const certificateHmac = this.sign(certData);

    return {
      tenantId,
      framework,
      chainLength: chain.length,
      firstEntry: chain.length > 0 ? chain[0].collectedAt : new Date(),
      lastEntry: chain.length > 0 ? chain[chain.length - 1].collectedAt : new Date(),
      isValid: verification.chainValid,
      certificateHash,
      certificateHmac,
      issuedAt: new Date(),
      status: verification.status,
      assurance: verification.assurance,
    };
  }

  /**
   * Get chain entries for a tenant in seq order.
   */
  async getChain(tenantId: string): Promise<ChainEntry[]> {
    const rows = await this.db
      .select()
      .from(evidenceChain)
      .where(eq(evidenceChain.tenantId, tenantId))
      .orderBy(asc(evidenceChain.seq));
    return rows.map((r) => this.rowToEntry(r));
  }

  /**
   * Get the most recent chain entry for a given evidence ID (an evidence item may
   * be re-collected, producing multiple entries; the latest seq wins).
   */
  async getEntryByEvidenceId(tenantId: string, evidenceId: string): Promise<ChainEntry | undefined> {
    const [row] = await this.db
      .select()
      .from(evidenceChain)
      .where(and(eq(evidenceChain.tenantId, tenantId), eq(evidenceChain.evidenceId, evidenceId)))
      .orderBy(desc(evidenceChain.seq))
      .limit(1);
    return row ? this.rowToEntry(row) : undefined;
  }
}
