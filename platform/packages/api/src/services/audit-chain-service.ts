import { createHash } from "crypto";
import { eq, asc, sql } from "drizzle-orm";
import { auditLogs } from "../db/schema.js";
import type { Db } from "../db/connection.js";

interface AuditChainEntry {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  entryHash: string;
  previousHash: string;
  chainHash: string;
  sequenceNumber: number;
}

interface ChainVerificationResult {
  valid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  brokenAt?: number;
  reason?: string;
  firstEntry: string;
  lastEntry: string;
  genesisHash: string;
}

/** Minimal structured-logger shape (Fastify/pino compatible). */
type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

const GENESIS_HASH =
  "genesis:0000000000000000000000000000000000000000000000000000000000000000";

export class AuditChainService {
  private readonly log: Logger;

  /**
   * REAL IMPL (BLACKFYRE 2026-06): the audit hash-chain head (last chain hash +
   * per-tenant sequence) is now persisted in the `audit_chain_state` table
   * (migration 026_audit_chain_state.sql) instead of per-process in-memory Maps,
   * so the chain survives process restarts / Lambda cold starts and cannot fork
   * under concurrency. An OPTIONAL pino-compatible logger records append/state
   * advances as structured security/audit events (tenant id, sequence, hashes —
   * NEVER secrets). The logger param is optional and defaulted so existing
   * callers (`new AuditChainService(app.db)`) keep compiling unchanged.
   */
  constructor(
    private db: Db,
    log?: Logger,
  ) {
    this.log = log ?? { info: () => {}, warn: () => {} };
  }

  /**
   * Compute the content hash for an audit entry.
   */
  computeEntryHash(entry: {
    tenantId: string;
    userId: string | null;
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    timestamp: string;
  }): string {
    const canonical = JSON.stringify({
      tenantId: entry.tenantId,
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resourceType || null,
      resourceId: entry.resourceId || null,
      details: entry.details || null,
      ipAddress: entry.ipAddress || null,
      timestamp: entry.timestamp,
    });
    return createHash("sha256").update(canonical).digest("hex");
  }

  /**
   * Compute the chain hash linking this entry to the previous.
   */
  computeChainHash(previousHash: string, entryHash: string): string {
    return createHash("sha256")
      .update(`${previousHash}:${entryHash}`)
      .digest("hex");
  }

  /**
   * Create a new chained audit log entry.
   *
   * REAL IMPL (BLACKFYRE 2026-06): the previous chain hash and sequence number
   * are read from the durable per-tenant `audit_chain_state` head and advanced
   * INSIDE the same transaction that inserts the audit_logs row. The head row is
   * taken with SELECT ... FOR UPDATE (and created on first use via an upsert), so
   * two concurrent appenders for one tenant are serialized by Postgres — the
   * loser blocks until the winner commits, then reads the advanced head. Because
   * the head is in the database (not an in-memory Map), the chain resumes from the
   * correct hash/sequence after any restart instead of resetting.
   *
   * Persistence uses PARAMETERIZED raw SQL via db.execute(sql`... ${value} ...`)
   * because `audit_chain_state` is intentionally not in db/schema.ts (concurrent
   * schema edits collide across parallel work items); the audit_logs insert keeps
   * using the typed Drizzle builder.
   */
  async logChained(params: {
    tenantId: string;
    userId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditChainEntry> {
    const id = crypto.randomUUID();

    const entry = await this.db.transaction(async (tx) => {
      // REAL IMPL (BLACKFYRE 2026-06): bind the tenant on the FORCE-RLS
      // `audit_chain_state` table for THIS transaction only (is_local=true =>
      // auto-cleared at COMMIT/ROLLBACK, never leaks to a pooled connection).
      // logChained is invoked from the audit-log plugin via `app.db` (the table
      // OWNER pool, which does NOT set app.current_tenant), but FORCE RLS makes
      // even the owner subject to the policy. Without this bind the tenant context
      // would be NULL and the policy would deny-all, breaking the audit write. The
      // bind also keeps the path correct when called via the app_user role.
      await tx.execute(
        sql`SELECT set_config('app.current_tenant', ${params.tenantId}, true)`,
      );

      // Lock (or create) this tenant's durable chain head. The upsert takes a
      // row-level lock on the head (even the DO UPDATE no-op write locks the
      // conflicting row), so two concurrent appenders for one tenant are
      // serialized: the loser blocks until the winner commits, then reads the
      // advanced previousHash/sequence and cannot fork the chain.
      const headRows = (await tx.execute(
        sql`
          INSERT INTO audit_chain_state (tenant_id)
          VALUES (${params.tenantId}::uuid)
          ON CONFLICT (tenant_id) DO UPDATE
            SET tenant_id = audit_chain_state.tenant_id
          RETURNING last_chain_hash, last_sequence
        `,
      )) as unknown as Array<{ last_chain_hash: string; last_sequence: string | number }>;

      const head = headRows[0];
      const previousHash = head?.last_chain_hash ?? GENESIS_HASH;
      // last_sequence is a bigint; postgres-js returns it as a string. Coerce safely.
      const prevSequence = head ? Number(head.last_sequence) : 0;

      const timestamp = new Date().toISOString();
      const entryHash = this.computeEntryHash({ ...params, timestamp });
      const chainHash = this.computeChainHash(previousHash, entryHash);
      const seq = prevSequence + 1;

      await tx.insert(auditLogs).values({
        id,
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        details: {
          ...((params.details as any) || {}),
          _chain: {
            entryHash,
            previousHash,
            chainHash,
            sequenceNumber: seq,
          },
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      // Advance the durable head within the SAME transaction. If the audit_logs
      // insert above failed, this never runs and the head stays consistent.
      await tx.execute(
        sql`
          UPDATE audit_chain_state
          SET last_chain_hash = ${chainHash},
              last_sequence = ${seq},
              updated_at = now()
          WHERE tenant_id = ${params.tenantId}::uuid
        `,
      );

      const built: AuditChainEntry = {
        id,
        ...params,
        timestamp,
        entryHash,
        previousHash,
        chainHash,
        sequenceNumber: seq,
      };
      return built;
    });

    // Structured audit event: a new immutable chain entry was committed. Hashes
    // and sequence only — never secrets, never raw request bodies/details.
    this.log.info(
      {
        event: "audit_chain.append",
        tenantId: entry.tenantId,
        userId: entry.userId,
        action: entry.action,
        sequenceNumber: entry.sequenceNumber,
        entryHash: entry.entryHash,
        previousHash: entry.previousHash,
        chainHash: entry.chainHash,
      },
      "audit chain entry appended",
    );

    return entry;
  }

  /**
   * Verify the integrity of the audit chain for a tenant.
   * Reads all entries in order and recomputes hashes.
   */
  async verifyChain(
    tenantId: string,
    limit?: number
  ): Promise<ChainVerificationResult> {
    const entries = await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(asc(auditLogs.createdAt))
      .limit(limit || 10000);

    if (entries.length === 0) {
      return {
        valid: true,
        totalEntries: 0,
        verifiedEntries: 0,
        firstEntry: "",
        lastEntry: "",
        genesisHash: "",
      };
    }

    let previousHash = GENESIS_HASH;
    let verified = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const chain = (entry.details as any)?._chain;

      if (!chain) {
        // Legacy entry without chain metadata — skip but count as verified
        verified++;
        continue;
      }

      // Recompute entry hash
      const detailsWithoutChain = (() => {
        const d = { ...(entry.details as any) };
        delete d._chain;
        return Object.keys(d).length > 0 ? d : undefined;
      })();

      const recomputedEntryHash = this.computeEntryHash({
        tenantId: entry.tenantId,
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType || undefined,
        resourceId: entry.resourceId || undefined,
        details: detailsWithoutChain,
        ipAddress: entry.ipAddress || undefined,
        timestamp: entry.createdAt.toISOString(),
      });

      if (recomputedEntryHash !== chain.entryHash) {
        this.log.warn(
          {
            event: "audit_chain.verify_break",
            tenantId,
            sequenceNumber: chain.sequenceNumber,
            reason: "entry_hash_mismatch",
          },
          "audit chain integrity break: entry hash mismatch",
        );
        return {
          valid: false,
          totalEntries: entries.length,
          verifiedEntries: verified,
          brokenAt: chain.sequenceNumber,
          reason: `Entry hash mismatch at sequence ${chain.sequenceNumber} — data tampered`,
          firstEntry: entries[0].createdAt.toISOString(),
          lastEntry: entries[entries.length - 1].createdAt.toISOString(),
          genesisHash:
            (entries[0].details as any)?._chain?.previousHash || "unknown",
        };
      }

      // Verify chain hash is correctly derived
      const recomputedChainHash = this.computeChainHash(
        chain.previousHash,
        chain.entryHash
      );
      if (recomputedChainHash !== chain.chainHash) {
        this.log.warn(
          {
            event: "audit_chain.verify_break",
            tenantId,
            sequenceNumber: chain.sequenceNumber,
            reason: "chain_hash_mismatch",
          },
          "audit chain integrity break: chain hash mismatch",
        );
        return {
          valid: false,
          totalEntries: entries.length,
          verifiedEntries: verified,
          brokenAt: chain.sequenceNumber,
          reason: `Chain hash mismatch at sequence ${chain.sequenceNumber} — chain tampered`,
          firstEntry: entries[0].createdAt.toISOString(),
          lastEntry: entries[entries.length - 1].createdAt.toISOString(),
          genesisHash:
            (entries[0].details as any)?._chain?.previousHash || "unknown",
        };
      }

      // Verify continuity with previous entry
      if (chain.previousHash !== previousHash) {
        this.log.warn(
          {
            event: "audit_chain.verify_break",
            tenantId,
            sequenceNumber: chain.sequenceNumber,
            reason: "continuity_break",
          },
          "audit chain integrity break: continuity broken",
        );
        return {
          valid: false,
          totalEntries: entries.length,
          verifiedEntries: verified,
          brokenAt: chain.sequenceNumber,
          reason: `Chain continuity broken at sequence ${chain.sequenceNumber} — entry inserted or deleted`,
          firstEntry: entries[0].createdAt.toISOString(),
          lastEntry: entries[entries.length - 1].createdAt.toISOString(),
          genesisHash:
            (entries[0].details as any)?._chain?.previousHash || "unknown",
        };
      }

      previousHash = chain.chainHash;
      verified++;
    }

    this.log.info(
      {
        event: "audit_chain.verify_ok",
        tenantId,
        totalEntries: entries.length,
        verifiedEntries: verified,
      },
      "audit chain verified",
    );

    return {
      valid: true,
      totalEntries: entries.length,
      verifiedEntries: verified,
      firstEntry: entries[0].createdAt.toISOString(),
      lastEntry: entries[entries.length - 1].createdAt.toISOString(),
      genesisHash:
        (entries[0].details as any)?._chain?.previousHash || "unknown",
    };
  }

  /**
   * Get the latest chain state for a tenant.
   *
   * REAL IMPL (BLACKFYRE 2026-06): reads the durable per-tenant head from
   * `audit_chain_state` (the authoritative source that survives restarts) rather
   * than scavenging the most recent audit_logs row. Returns the GENESIS defaults
   * for a tenant that has never appended.
   */
  async getChainState(tenantId: string): Promise<{
    lastChainHash: string;
    lastSequence: number;
    totalEntries: number;
  }> {
    // REAL IMPL (BLACKFYRE 2026-06): bind the tenant for this read so the
    // FORCE-RLS policy on audit_chain_state is satisfied regardless of which pool
    // /role the caller used (the audit-chain routes call this via `app.db`, the
    // owner pool, which does not set app.current_tenant). is_local=true keeps the
    // binding scoped to this transaction and self-clearing.
    const rows = await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`,
      );
      return (await tx.execute(
        sql`
          SELECT last_chain_hash, last_sequence
          FROM audit_chain_state
          WHERE tenant_id = ${tenantId}::uuid
          LIMIT 1
        `,
      )) as unknown as Array<{ last_chain_hash: string; last_sequence: string | number }>;
    });

    const head = rows[0];
    if (!head) {
      // REAL IMPL (BLACKFYRE 2026-06): return the FULL GENESIS_HASH (matches the
      // migration default + the value logChained uses), not a short "genesis"
      // literal — otherwise verification forks at sequence 1.
      return { lastChainHash: GENESIS_HASH, lastSequence: 0, totalEntries: 0 };
    }

    const lastSequence = Number(head.last_sequence);
    return {
      lastChainHash: head.last_chain_hash || GENESIS_HASH,
      lastSequence,
      totalEntries: lastSequence,
    };
  }
}
