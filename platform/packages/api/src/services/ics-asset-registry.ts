/**
 * ICS Asset Registry Service
 *
 * Tracks discovered ICS/OT assets from passive traffic analysis.
 * All data is derived from observed network traffic — no active probing.
 *
 * Purdue Model levels:
 *   0 — Field devices (sensors, actuators)
 *   1 — Basic control (PLCs, RTUs, DCS)
 *   2 — Supervisory control (HMIs, SCADA servers)
 *   3 — Site operations (historian, engineering workstations)
 *   4 — Site business planning (DMZ, patch servers)
 *   5 — Enterprise network
 */

// REAL IMPL (BLACKFYRE 2026-06): durable backing store + structured audit logger.
// The asset register previously lived only in the in-process `assets` Map and was
// lost on every restart (P2 durability gap — also wiped the rogue-device baseline).
// It now write-throughs to the tenant-scoped, RLS-enforced `ics_assets` table
// (migration 028) via parameterized SQL. The Map remains a per-instance cache so
// the synchronous hot frame-feed path (observe/listAssets/getSummary) is unchanged.
import { sql } from "drizzle-orm";
import type { Db } from "../db/connection.js";

// REAL IMPL (BLACKFYRE 2026-06): minimal structured-logger surface so the service
// can emit pino security/audit events when a Fastify logger is passed, falling back
// to console. Mirrors the SecurityLogger pattern in dlp-service.ts. Asset metadata
// (IP/MAC/vendor) is operational inventory, not a secret; we still never log full
// connection strings or credentials.
interface SecurityLogger {
  warn(obj: Record<string, unknown>, msg?: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

export type PurdueLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type IcsDeviceType =
  | "plc"
  | "rtu"
  | "hmi"
  | "engineering_workstation"
  | "scada_server"
  | "historian"
  | "ied"
  | "unknown";

export interface IcsAsset {
  id: string; // deterministic: "{ip}:{mac ?? 'unknown'}"
  ipAddress: string;
  macAddress: string | null;
  deviceType: IcsDeviceType;
  vendor: string | null;
  firmwareVersion: string | null;
  protocols: string[];
  purdueLevel: PurdueLevel | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  unitIds: number[]; // Modbus unit IDs observed
  isBaseline: boolean; // present in initial baseline
  isRogue: boolean; // appeared after baseline was set
  notes: string | null;
}

export interface AssetObservation {
  ipAddress: string;
  macAddress?: string;
  protocol: string;
  unitId?: number;
  vendor?: string;
  firmwareVersion?: string;
  deviceType?: IcsDeviceType;
  purdueLevel?: PurdueLevel;
}

export class IcsAssetRegistry {
  private assets = new Map<string, IcsAsset>();
  private baselineSet = false;

  // REAL IMPL (BLACKFYRE 2026-06): optional durable backing store, audit logger,
  // and tenant scope. ALL are OPTIONAL and defaulted so existing callers
  // (`new IcsAssetRegistry()`, e.g. agents/ot-scada-collector.ts) keep compiling
  // and running with no DB wired — the Map alone behaves exactly as before. When a
  // Db handle AND a tenantId are supplied, the asset register survives restarts.
  // tenantId is held on the instance (rather than threaded through each method) so
  // every public method signature — observe/setBaseline/listAssets/getSummary —
  // stays byte-for-byte identical.
  private readonly db?: Db;
  private readonly tenantId?: string;
  private readonly log: SecurityLogger;

  constructor(db?: Db, tenantId?: string, logger?: SecurityLogger) {
    this.db = db;
    this.tenantId = tenantId;
    this.log = logger ?? {
      warn: (obj, msg) => console.warn(msg ?? "", obj),
      info: (obj, msg) => console.info(msg ?? "", obj),
      error: (obj, msg) => console.error(msg ?? "", obj),
    };
  }

  /** True when this instance is wired for durable persistence. */
  private get persistent(): boolean {
    return Boolean(this.db && this.tenantId);
  }

  /**
   * Observe traffic from an IP/MAC. Creates asset if new, updates if known.
   * Returns the asset record and whether it is a newly discovered device.
   *
   * REAL IMPL (BLACKFYRE 2026-06): write-through. The synchronous in-memory update
   * is unchanged (preserving the hot frame-feed contract); when a Db handle +
   * tenant are configured the resulting asset row is durably upserted as a
   * fire-and-forget write, so failures are logged as an audit event but never block
   * or throw on the capture path. Callers needing a confirmed durable write should
   * use observePersistent() and await it.
   */
  observe(obs: AssetObservation): { asset: IcsAsset; isNew: boolean } {
    const assetId = `${obs.ipAddress}:${obs.macAddress ?? "unknown"}`;
    const existing = this.assets.get(assetId);
    const isNew = !existing;

    if (existing) {
      existing.lastSeenAt = new Date();
      if (obs.protocol && !existing.protocols.includes(obs.protocol)) {
        existing.protocols.push(obs.protocol);
      }
      if (obs.unitId !== undefined && !existing.unitIds.includes(obs.unitId)) {
        existing.unitIds.push(obs.unitId);
      }
      if (obs.firmwareVersion && obs.firmwareVersion !== existing.firmwareVersion) {
        existing.firmwareVersion = obs.firmwareVersion;
        existing.notes = `Firmware changed to ${obs.firmwareVersion} at ${new Date().toISOString()}`;
      }
      if (obs.vendor && !existing.vendor) existing.vendor = obs.vendor;
      if (obs.deviceType && existing.deviceType === "unknown") existing.deviceType = obs.deviceType;
      if (obs.purdueLevel !== undefined && existing.purdueLevel === null) {
        existing.purdueLevel = obs.purdueLevel;
      }
      this.persistAsync(existing);
      return { asset: existing, isNew: false };
    }

    const asset: IcsAsset = {
      id: assetId,
      ipAddress: obs.ipAddress,
      macAddress: obs.macAddress ?? null,
      deviceType: obs.deviceType ?? "unknown",
      vendor: obs.vendor ?? null,
      firmwareVersion: obs.firmwareVersion ?? null,
      protocols: obs.protocol ? [obs.protocol] : [],
      purdueLevel: obs.purdueLevel ?? null,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      unitIds: obs.unitId !== undefined ? [obs.unitId] : [],
      isBaseline: !this.baselineSet,
      isRogue: this.baselineSet,
      notes: null,
    };

    this.assets.set(assetId, asset);
    if (this.persistent) {
      this.log.info(
        {
          event: "ics.asset.discovered",
          tenantId: this.tenantId,
          assetId,
          deviceType: asset.deviceType,
          purdueLevel: asset.purdueLevel,
          isRogue: asset.isRogue,
        },
        asset.isRogue
          ? "ICS: rogue device discovered after baseline"
          : "ICS: new asset discovered",
      );
    }
    this.persistAsync(asset);
    return { asset, isNew: true };
  }

  /**
   * Freeze the current asset list as the baseline.
   * Any devices observed after this call are flagged as rogue.
   *
   * REAL IMPL (BLACKFYRE 2026-06): the in-memory flip is unchanged; when persistent
   * the baseline mutation is durably written fire-and-forget so a restart preserves
   * the rogue/baseline distinction. setBaselinePersistent() is the awaitable variant.
   */
  setBaseline(): void {
    for (const asset of this.assets.values()) {
      asset.isBaseline = true;
      asset.isRogue = false;
    }
    this.baselineSet = true;
    if (this.persistent) {
      this.log.info(
        { event: "ics.baseline.set", tenantId: this.tenantId, assetCount: this.assets.size },
        "ICS: asset baseline frozen",
      );
      void this.persistBaselineRow().catch((err) => {
        this.log.error(
          {
            event: "ics.baseline.persist.failure",
            tenantId: this.tenantId,
            error: err instanceof Error ? err.message : String(err),
          },
          "ICS: failed to persist baseline durably; applied in-memory only",
        );
      });
    }
  }

  /**
   * Returns all known assets, optionally filtered.
   */
  listAssets(filter?: {
    isRogue?: boolean;
    deviceType?: IcsDeviceType;
    purdueLevel?: PurdueLevel;
  }): IcsAsset[] {
    let results = Array.from(this.assets.values());

    if (filter?.isRogue !== undefined) {
      results = results.filter((a) => a.isRogue === filter.isRogue);
    }
    if (filter?.deviceType) {
      results = results.filter((a) => a.deviceType === filter.deviceType);
    }
    if (filter?.purdueLevel !== undefined) {
      results = results.filter((a) => a.purdueLevel === filter.purdueLevel);
    }

    return results.sort((a, b) => a.ipAddress.localeCompare(b.ipAddress));
  }

  /**
   * Returns a summary suitable for API responses.
   */
  getSummary(): {
    total: number;
    rogue: number;
    byType: Record<IcsDeviceType, number>;
    byPurdueLevel: Record<string, number>;
    baselineSet: boolean;
  } {
    const all = Array.from(this.assets.values());
    const byType = {} as Record<IcsDeviceType, number>;
    const byPurdueLevel: Record<string, number> = {};

    for (const asset of all) {
      byType[asset.deviceType] = (byType[asset.deviceType] ?? 0) + 1;
      const level = asset.purdueLevel !== null ? `level_${asset.purdueLevel}` : "unknown";
      byPurdueLevel[level] = (byPurdueLevel[level] ?? 0) + 1;
    }

    return {
      total: all.length,
      rogue: all.filter((a) => a.isRogue).length,
      byType,
      byPurdueLevel,
      baselineSet: this.baselineSet,
    };
  }

  // --------------------------------------------------------------------------
  // REAL IMPL (BLACKFYRE 2026-06): durable persistence for the ICS/OT asset
  // register. All of the following are ADDITIVE methods; none change an existing
  // public signature. They run parameterized SQL through a Db (Drizzle/postgres-js)
  // handle and rely on RLS (tenant_isolation policy + bound app.current_tenant on
  // request.db) plus an explicit tenant_id predicate for defense in depth. They are
  // no-ops when the instance was constructed without a Db handle + tenantId.
  // --------------------------------------------------------------------------

  /**
   * Observe traffic AND await a confirmed durable write. Awaitable counterpart of
   * observe() for callers (e.g. an API mutation) that need persistence guaranteed
   * before responding. Identical in-memory effect to observe().
   */
  async observePersistent(
    obs: AssetObservation,
  ): Promise<{ asset: IcsAsset; isNew: boolean }> {
    const result = this.observe(obs);
    if (this.persistent) {
      await this.upsertAssetRow(result.asset);
    }
    return result;
  }

  /**
   * Freeze the baseline AND await a confirmed durable write. Awaitable counterpart
   * of setBaseline().
   */
  async setBaselinePersistent(): Promise<void> {
    // Apply the in-memory flip without its fire-and-forget DB write, then write
    // synchronously here so the caller can rely on durability.
    for (const asset of this.assets.values()) {
      asset.isBaseline = true;
      asset.isRogue = false;
    }
    this.baselineSet = true;
    if (!this.persistent) return;
    await this.persistBaselineRow();
    this.log.info(
      { event: "ics.baseline.set", tenantId: this.tenantId, assetCount: this.assets.size },
      "ICS: asset baseline frozen (durable)",
    );
  }

  /**
   * Load this tenant's asset register from Postgres into the in-process cache, then
   * return the (optionally filtered) assets. Use on startup or on a cache miss so
   * subsequent synchronous observe()/listAssets()/getSummary() calls see durable
   * data. Falls back to the in-process cache when no Db handle is wired.
   */
  async listAssetsPersistent(filter?: {
    isRogue?: boolean;
    deviceType?: IcsDeviceType;
    purdueLevel?: PurdueLevel;
  }): Promise<IcsAsset[]> {
    await this.hydrate();
    return this.listAssets(filter);
  }

  /**
   * Populate the in-process cache for this tenant from the `ics_assets` table.
   * Restores the baselineSet flag (true if any stored asset is flagged baseline) so
   * the rogue-device logic survives a restart. No-op when not persistent.
   */
  async hydrate(): Promise<void> {
    if (!this.persistent) return;
    const rows = (await this.db!.execute(
      sql`SELECT asset_id, ip_address, mac_address, device_type, vendor,
                 firmware_version, protocols, purdue_level, unit_ids,
                 is_baseline, is_rogue, notes, first_seen_at, last_seen_at
          FROM ics_assets
          WHERE tenant_id = ${this.tenantId!}`,
    )) as unknown as IcsAssetRow[];

    this.assets.clear();
    let anyBaseline = false;
    for (const row of rows) {
      const asset = this.rowToAsset(row);
      this.assets.set(asset.id, asset);
      if (asset.isBaseline) anyBaseline = true;
    }
    // If any asset was frozen into the baseline, the baseline was set previously.
    this.baselineSet = anyBaseline;
    this.log.info(
      { event: "ics.assets.hydrated", tenantId: this.tenantId, count: this.assets.size, baselineSet: this.baselineSet },
      "ICS: loaded asset register from store",
    );
  }

  /**
   * Fire-and-forget durable upsert used by the synchronous observe() path. Errors
   * are logged as an audit event and swallowed so the passive capture path never
   * throws. No-op when not persistent.
   */
  private persistAsync(asset: IcsAsset): void {
    if (!this.persistent) return;
    void this.upsertAssetRow(asset).catch((err) => {
      this.log.error(
        {
          event: "ics.asset.persist.failure",
          tenantId: this.tenantId,
          assetId: asset.id,
          error: err instanceof Error ? err.message : String(err),
        },
        "ICS: failed to persist asset durably; cached in-memory only",
      );
    });
  }

  /**
   * Upsert a single asset row, keyed on (tenant_id, asset_id).
   *
   * REAL IMPL (BLACKFYRE 2026-06): array columns (protocols text[], unit_ids
   * integer[]) are bound as JSON-string parameters and converted to Postgres arrays
   * in SQL. Drizzle's `sql` template expands a JS array bind value into a
   * comma-separated parameter LIST (not a single array literal), so binding the
   * arrays directly would corrupt the statement; the JSON-string + cast approach
   * keeps every value fully parameterized (no string interpolation of asset data).
   */
  private async upsertAssetRow(asset: IcsAsset): Promise<void> {
    const protocolsJson = JSON.stringify(asset.protocols ?? []);
    const unitIdsJson = JSON.stringify(asset.unitIds ?? []);
    await this.db!.execute(
      sql`INSERT INTO ics_assets (
            tenant_id, asset_id, ip_address, mac_address, device_type, vendor,
            firmware_version, protocols, purdue_level, unit_ids, is_baseline,
            is_rogue, notes, first_seen_at, last_seen_at
          ) VALUES (
            ${this.tenantId!}, ${asset.id}, ${asset.ipAddress}, ${asset.macAddress},
            ${asset.deviceType}, ${asset.vendor}, ${asset.firmwareVersion},
            ARRAY(SELECT jsonb_array_elements_text(${protocolsJson}::jsonb))::text[],
            ${asset.purdueLevel},
            ARRAY(SELECT (jsonb_array_elements_text(${unitIdsJson}::jsonb))::int)::integer[],
            ${asset.isBaseline}, ${asset.isRogue}, ${asset.notes},
            ${asset.firstSeenAt}, ${asset.lastSeenAt}
          )
          ON CONFLICT (tenant_id, asset_id) DO UPDATE SET
            ip_address = EXCLUDED.ip_address,
            mac_address = EXCLUDED.mac_address,
            device_type = EXCLUDED.device_type,
            vendor = EXCLUDED.vendor,
            firmware_version = EXCLUDED.firmware_version,
            protocols = EXCLUDED.protocols,
            purdue_level = EXCLUDED.purdue_level,
            unit_ids = EXCLUDED.unit_ids,
            is_baseline = EXCLUDED.is_baseline,
            is_rogue = EXCLUDED.is_rogue,
            notes = EXCLUDED.notes,
            last_seen_at = EXCLUDED.last_seen_at`,
    );
  }

  /**
   * Durably apply the baseline flip across this tenant's stored assets in one
   * statement (every known device becomes baseline, none rogue).
   */
  private async persistBaselineRow(): Promise<void> {
    await this.db!.execute(
      sql`UPDATE ics_assets
          SET is_baseline = true, is_rogue = false
          WHERE tenant_id = ${this.tenantId!}`,
    );
  }

  /** Rehydrate an IcsAsset from a stored row. */
  private rowToAsset(row: IcsAssetRow): IcsAsset {
    return {
      id: row.asset_id,
      ipAddress: row.ip_address,
      macAddress: row.mac_address ?? null,
      deviceType: row.device_type as IcsDeviceType,
      vendor: row.vendor ?? null,
      firmwareVersion: row.firmware_version ?? null,
      protocols: row.protocols ?? [],
      purdueLevel: (row.purdue_level ?? null) as PurdueLevel | null,
      firstSeenAt: new Date(row.first_seen_at),
      lastSeenAt: new Date(row.last_seen_at),
      unitIds: row.unit_ids ?? [],
      isBaseline: row.is_baseline,
      isRogue: row.is_rogue,
      notes: row.notes ?? null,
    };
  }
}

// REAL IMPL (BLACKFYRE 2026-06): shape of a row read back from `ics_assets`.
interface IcsAssetRow {
  asset_id: string;
  ip_address: string;
  mac_address: string | null;
  device_type: string;
  vendor: string | null;
  firmware_version: string | null;
  protocols: string[] | null;
  purdue_level: number | null;
  unit_ids: number[] | null;
  is_baseline: boolean;
  is_rogue: boolean;
  notes: string | null;
  first_seen_at: string | Date;
  last_seen_at: string | Date;
}
