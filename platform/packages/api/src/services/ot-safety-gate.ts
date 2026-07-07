/**
 * OT Safety Gate Service
 *
 * SAFETY-CRITICAL: OT/SCADA monitoring is PASSIVE ONLY.
 * BLACKFYRE connects to a SPAN/TAP port and analyzes mirrored traffic.
 * No packets are ever sent to industrial control systems.
 *
 * Operators MUST acknowledge the safety disclaimer before any OT
 * feature is accessible. Acknowledgment is recorded per tenant and is
 * irreversible once given.
 *
 * REAL IMPL (BLACKFYRE 2026-06): acknowledgments are now DURABLE. They are
 * upserted into the tenant-scoped, RLS-enforced `ot_safety_acknowledgments`
 * table (migration 029) when a Db handle is wired, so the compliance audit
 * trail (who acknowledged, from which IP, against which disclaimer version,
 * and when) survives process restarts and deploys instead of being lost from
 * the previous in-memory-only Map. An in-process cache fronts the table so the
 * synchronous gate checks on the OT route hot path stay synchronous.
 */

import { sql } from "drizzle-orm";
import type { Db } from "../db/connection.js";

// REAL IMPL (BLACKFYRE 2026-06): minimal structured-logger surface so the gate can
// emit pino security/audit events when a Fastify logger is passed, falling back to
// console. Mirrors the SecurityLogger pattern in dlp-service.ts. Never log secrets;
// only the actor's user id, source IP, disclaimer version, and tenant id are emitted
// for the compliance audit trail.
interface SecurityLogger {
  warn(obj: Record<string, unknown>, msg?: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

export const DISCLAIMER_VERSION = "1.0";

export const OT_SAFETY_DISCLAIMER = `
BLACKFYRE OT/SCADA MONITORING — SAFETY ACKNOWLEDGMENT REQUIRED

This feature enables passive monitoring of industrial control system (ICS)
traffic. Before proceeding, you MUST read and acknowledge the following:

1. PASSIVE ONLY
   BLACKFYRE operates in read-only, passive mode exclusively. It analyzes
   traffic mirrored from a SPAN port or network TAP. BLACKFYRE will NEVER
   send any packets, commands, or data to industrial control systems, PLCs,
   RTUs, or any other OT/ICS device.

2. YOUR RESPONSIBILITY — SPAN/TAP CONFIGURATION
   You are solely responsible for the correct configuration of the SPAN or
   TAP port used to mirror traffic to BLACKFYRE. Incorrect configuration
   could result in network disruption. Consult your network team before
   enabling this feature.

3. ICS ENVIRONMENT EXPERTISE REQUIRED
   Enabling this feature requires a thorough understanding of your Industrial
   Control System (ICS) environment. You must understand the Purdue Model
   level boundaries in use, the protocols deployed (Modbus, DNP3, BACnet,
   etc.), and the potential impact of any changes to monitoring
   infrastructure.

4. NO ACTIVE SCANNING
   This is NOT an active vulnerability scanner. Do not attempt to configure
   BLACKFYRE to actively probe, interrogate, or communicate with OT devices.
   Active scanning of industrial devices can cause unexpected behavior,
   process disruptions, or safety incidents.

5. ASSUMPTION OF RESPONSIBILITY
   By acknowledging this disclaimer, you confirm that:
   - You have the authority to enable OT monitoring for this tenant
   - You understand the passive-only nature of this feature
   - You have correctly configured the SPAN/TAP infrastructure
   - Your organization assumes full responsibility for any consequences
     arising from enabling this feature

Disclaimer version: ${DISCLAIMER_VERSION}
`.trim();

export interface SafetyAcknowledgment {
  tenantId: string;
  acknowledgedBy: string;
  acknowledgedAt: Date;
  disclaimerVersion: string;
  ipAddress: string;
}

// REAL IMPL (BLACKFYRE 2026-06): in-process write-through cache for safety
// acknowledgments. Durability now lives in the `ot_safety_acknowledgments` Postgres
// table (migration 029); this Map is a per-process cache so the synchronous gate
// checks on the OT route hot path (checkAcknowledgment / getAcknowledgment) stay
// fast and stay synchronous. The cache is shared across OtSafetyGateService
// instances so an ack recorded through one request handler is visible to others in
// the same process without a DB round-trip. Populate it from the database on a cache
// miss / at startup via hydrateAcknowledgment() / checkAcknowledgmentPersistent().
const acknowledgments = new Map<string, SafetyAcknowledgment>();

interface AckRow {
  tenant_id: string;
  acknowledged_by: string;
  ip_address: string;
  disclaimer_version: string;
  acknowledged_at: string | Date;
}

export class OtSafetyGateService {
  // REAL IMPL (BLACKFYRE 2026-06): optional durable backing store + logger. Both are
  // OPTIONAL and defaulted so existing callers (`new OtSafetyGateService()`, e.g.
  // routes/ot-scada.ts) keep compiling and running unchanged. When a Db handle IS
  // supplied, acknowledgments survive process restarts and the compliance audit
  // trail is no longer lost on deploy.
  private readonly db?: Db;
  private readonly log: SecurityLogger;

  constructor(db?: Db, logger?: SecurityLogger) {
    this.db = db;
    this.log = logger ?? {
      warn: (obj, msg) => console.warn(msg ?? "", obj),
      info: (obj, msg) => console.info(msg ?? "", obj),
      error: (obj, msg) => console.error(msg ?? "", obj),
    };
  }

  /**
   * Returns whether the tenant has acknowledged the safety disclaimer.
   *
   * Synchronous and reads from the in-process cache only, so it stays safe on the
   * OT route hot path. Acknowledgments are durable in Postgres (migration 029); call
   * hydrateAcknowledgment() or checkAcknowledgmentPersistent() once after startup (or
   * on a cache miss) to populate the cache from the database. Signature unchanged.
   */
  checkAcknowledgment(tenantId: string): boolean {
    return acknowledgments.has(tenantId);
  }

  /**
   * Returns the full acknowledgment record for a tenant, or null. Reads the cache
   * only (see checkAcknowledgment for the durability contract). Signature unchanged.
   */
  getAcknowledgment(tenantId: string): SafetyAcknowledgment | null {
    return acknowledgments.get(tenantId) ?? null;
  }

  /**
   * Records an acknowledgment for a tenant. Irreversible — subsequent calls are
   * no-ops and return the existing record.
   *
   * REAL IMPL (BLACKFYRE 2026-06): write-through. Updates the in-process cache
   * synchronously (preserving this method's synchronous `SafetyAcknowledgment`
   * return type and the prior behaviour for callers that never wired a DB) AND, when
   * a Db handle is present, durably upserts the acknowledgment into the
   * `ot_safety_acknowledgments` table so the compliance audit trail survives
   * restarts. The durable write is fire-and-forget here to keep the signature
   * synchronous; failures are logged as a security/audit event, never thrown.
   * Callers that require a confirmed durable write should use persistAcknowledgment()
   * and await it.
   */
  acknowledge(
    tenantId: string,
    userId: string,
    ipAddress: string,
  ): SafetyAcknowledgment {
    const existing = acknowledgments.get(tenantId);
    if (existing) return existing;

    const ack: SafetyAcknowledgment = {
      tenantId,
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
      disclaimerVersion: DISCLAIMER_VERSION,
      ipAddress,
    };
    acknowledgments.set(tenantId, ack);

    if (this.db) {
      // Fire-and-forget durable upsert; errors are logged, never thrown, so the
      // synchronous in-memory contract is preserved.
      void this.upsertAckRow(ack).catch((err) => {
        this.log.error(
          {
            event: "ot.safety.ack.persist.failure",
            tenantId,
            acknowledgedBy: userId,
            disclaimerVersion: ack.disclaimerVersion,
            error: err instanceof Error ? err.message : String(err),
          },
          "OT safety gate: failed to persist acknowledgment durably; cached in-memory only",
        );
      });
    }

    return ack;
  }

  /**
   * Returns the current disclaimer text and version.
   */
  getDisclaimer(): { version: string; text: string } {
    return { version: DISCLAIMER_VERSION, text: OT_SAFETY_DISCLAIMER };
  }

  // ----------------------------------------------------------------------------
  // REAL IMPL (BLACKFYRE 2026-06): durable persistence for safety acknowledgments.
  // All of the following are ADDITIVE async methods; none change an existing public
  // signature. They run parameterized SQL through a Db (Drizzle/postgres-js) handle
  // and rely on RLS (tenant_isolation policy + bound app.current_tenant on
  // request.db) plus an explicit tenant_id predicate for defense in depth.
  // ----------------------------------------------------------------------------

  /**
   * Durably record an acknowledgment for a tenant AND refresh the cache. Awaitable
   * variant of acknowledge() for callers that need a confirmed write. Idempotent:
   * if the tenant already acknowledged, the cached record is returned and the
   * durable row is upserted (keyed on tenant_id) so the trail is retained.
   */
  async persistAcknowledgment(
    tenantId: string,
    userId: string,
    ipAddress: string,
  ): Promise<SafetyAcknowledgment> {
    const existing = acknowledgments.get(tenantId);
    const ack: SafetyAcknowledgment =
      existing ?? {
        tenantId,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        disclaimerVersion: DISCLAIMER_VERSION,
        ipAddress,
      };
    acknowledgments.set(tenantId, ack);

    if (this.db) {
      await this.upsertAckRow(ack);
      this.log.info(
        {
          event: "ot.safety.ack.persisted",
          tenantId,
          acknowledgedBy: ack.acknowledgedBy,
          disclaimerVersion: ack.disclaimerVersion,
          ipAddress: ack.ipAddress,
        },
        "OT safety gate: acknowledgment persisted",
      );
    }
    return ack;
  }

  /**
   * Load a tenant's acknowledgment from Postgres into the in-process cache, then
   * report whether the tenant has acknowledged. Use this on startup or on a cache
   * miss so subsequent synchronous checkAcknowledgment() calls see durable acks. If
   * no Db is wired this falls back to whatever is cached in-process.
   */
  async checkAcknowledgmentPersistent(tenantId: string): Promise<boolean> {
    await this.hydrateAcknowledgment(tenantId);
    return this.checkAcknowledgment(tenantId);
  }

  /**
   * Load a tenant's acknowledgment from Postgres into the in-process cache, then
   * return the full record (or null). Durable variant of getAcknowledgment().
   */
  async getAcknowledgmentPersistent(
    tenantId: string,
  ): Promise<SafetyAcknowledgment | null> {
    await this.hydrateAcknowledgment(tenantId);
    return this.getAcknowledgment(tenantId);
  }

  /**
   * Populate the in-process cache for a tenant from the
   * `ot_safety_acknowledgments` table. No-op when no Db handle is configured.
   */
  async hydrateAcknowledgment(tenantId: string): Promise<void> {
    if (!this.db) return;
    const rows = (await this.db.execute(
      sql`SELECT tenant_id, acknowledged_by, ip_address, disclaimer_version, acknowledged_at
          FROM ot_safety_acknowledgments
          WHERE tenant_id = ${tenantId}
          LIMIT 1`,
    )) as unknown as AckRow[];

    const row = rows[0];
    if (!row) return;

    acknowledgments.set(tenantId, {
      tenantId: row.tenant_id,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: new Date(row.acknowledged_at),
      disclaimerVersion: row.disclaimer_version,
      ipAddress: row.ip_address,
    });
    this.log.info(
      { event: "ot.safety.ack.hydrated", tenantId },
      "OT safety gate: loaded acknowledgment from store",
    );
  }

  /**
   * Upsert the single current acknowledgment row for a tenant, keyed on tenant_id.
   * Built durably so the compliance audit trail (who/IP/version/when) is retained.
   */
  private async upsertAckRow(ack: SafetyAcknowledgment): Promise<void> {
    await this.db!.execute(
      sql`INSERT INTO ot_safety_acknowledgments
            (tenant_id, acknowledged_by, ip_address, disclaimer_version, acknowledged_at, updated_at)
          VALUES (${ack.tenantId}, ${ack.acknowledgedBy}, ${ack.ipAddress},
                  ${ack.disclaimerVersion}, ${ack.acknowledgedAt}, now())
          ON CONFLICT (tenant_id) DO UPDATE SET
            acknowledged_by = EXCLUDED.acknowledged_by,
            ip_address = EXCLUDED.ip_address,
            disclaimer_version = EXCLUDED.disclaimer_version,
            acknowledged_at = EXCLUDED.acknowledged_at,
            updated_at = now()`,
    );
  }
}
