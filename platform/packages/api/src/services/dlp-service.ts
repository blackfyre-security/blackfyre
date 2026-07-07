import { createHash } from "crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../db/connection.js";

// REAL IMPL (BLACKFYRE 2026-06): minimal structured-logger surface so the
// service can emit pino security/audit events when a Fastify logger is passed,
// falling back to console. Mirrors the SecurityLogger pattern in
// ai-analysis-service.ts. Never log rule patterns or matched content as those
// can themselves carry the sensitive data DLP exists to protect.
interface SecurityLogger {
  warn(obj: Record<string, unknown>, msg?: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

export interface DlpRule {
  id: string;
  name: string;
  pattern: RegExp;
  severity: "critical" | "high" | "medium";
  action: "block" | "redact" | "alert";
  category: string;
}

export interface DlpViolation {
  ruleId: string;
  ruleName: string;
  severity: string;
  action: string;
  matchCount: number;
  redacted: boolean;
}

export interface DlpScanResult {
  clean: boolean;
  violations: DlpViolation[];
  redactedContent?: string;
}

// REAL IMPL (BLACKFYRE 2026-06): in-process write-through cache for tenant
// custom rules. Durability now lives in the `dlp_rules` Postgres table (migration
// 027); this Map is a per-process cache populated from the DB via hydrateTenantRules
// / getTenantRulesPersistent so the hot scan path stays synchronous. The cache is
// shared across DlpService instances so a rule registered through one request
// handler is visible to others in the same process without a DB round-trip.
const tenantRules = new Map<string, DlpRule[]>();

const DEFAULT_RULES: DlpRule[] = [
  // GPS coordinates
  {
    id: "dlp-gps",
    name: "GPS Coordinates",
    pattern: /[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)\s*,\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)/g,
    severity: "critical",
    action: "block",
    category: "geolocation",
  },
  // Satellite IDs (NORAD, COSPAR, SAT formats)
  {
    id: "dlp-sat-id",
    name: "Satellite Identifier",
    pattern: /\b(NORAD|COSPAR|SAT)[- ]?\d{4,7}[A-Z]?\b/gi,
    severity: "critical",
    action: "block",
    category: "satellite",
  },
  // AWS Access Keys
  {
    id: "dlp-aws-key",
    name: "AWS Access Key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: "critical",
    action: "block",
    category: "credentials",
  },
  // Private keys
  {
    id: "dlp-privkey",
    name: "Private Key",
    pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g,
    severity: "critical",
    action: "block",
    category: "credentials",
  },
  // SSN patterns
  {
    id: "dlp-ssn",
    name: "Social Security Number",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    severity: "high",
    action: "redact",
    category: "pii",
  },
  // Credit card numbers (Visa, MasterCard, Amex)
  {
    id: "dlp-cc",
    name: "Credit Card Number",
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
    severity: "critical",
    action: "redact",
    category: "financial",
  },
  // Internal IP addresses (RFC 1918)
  {
    id: "dlp-internal-ip",
    name: "Internal IP Address",
    pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
    severity: "medium",
    action: "alert",
    category: "network",
  },
  // Bearer tokens
  {
    id: "dlp-bearer",
    name: "Bearer Token",
    pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/g,
    severity: "high",
    action: "redact",
    category: "credentials",
  },
  // Aadhaar numbers (India) — 12-digit starting with 2-9
  {
    id: "dlp-aadhaar",
    name: "Aadhaar Number",
    pattern: /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g,
    severity: "high",
    action: "redact",
    category: "pii",
  },
  // TLE orbital elements (satellite-specific)
  {
    id: "dlp-tle",
    name: "Two-Line Element Set",
    pattern: /^[12]\s+\d{5}[A-Z]?\s/gm,
    severity: "critical",
    action: "block",
    category: "satellite",
  },
];

/**
 * Reset a RegExp's lastIndex so it can be reused safely across multiple scans.
 * All rules use the global flag, which means lastIndex persists across exec() calls.
 */
function resetRules(rules: DlpRule[]): void {
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
  }
}

/**
 * Redact all matches for a rule with a safe placeholder.
 */
function applyRedaction(content: string, rule: DlpRule): string {
  rule.pattern.lastIndex = 0;
  return content.replace(rule.pattern, `[REDACTED:${rule.category.toUpperCase()}]`);
}

/**
 * Count occurrences of a pattern in content without consuming the string.
 */
function countMatches(content: string, rule: DlpRule): number {
  rule.pattern.lastIndex = 0;
  const matches = content.match(rule.pattern);
  rule.pattern.lastIndex = 0;
  return matches ? matches.length : 0;
}

export class DlpService {
  private rules: DlpRule[];
  // REAL IMPL (BLACKFYRE 2026-06): optional durable backing store + logger.
  // Both are OPTIONAL and defaulted so existing callers (`new DlpService()`,
  // e.g. plugins/dlp.ts) keep compiling and running with no DB wired. When a Db
  // handle IS supplied, custom tenant rules survive process restarts.
  private readonly db?: Db;
  private readonly log: SecurityLogger;

  constructor(db?: Db, logger?: SecurityLogger) {
    // Deep-clone rules so each instance owns its RegExp state
    this.rules = DEFAULT_RULES.map((r) => ({
      ...r,
      pattern: new RegExp(r.pattern.source, r.pattern.flags),
    }));
    this.db = db;
    this.log = logger ?? {
      warn: (obj, msg) => console.warn(msg ?? "", obj),
      info: (obj, msg) => console.info(msg ?? "", obj),
      error: (obj, msg) => console.error(msg ?? "", obj),
    };
  }

  /**
   * Scan a plain string for DLP violations.
   * Returns a result describing all violations and, if any were redacted, the cleaned content.
   */
  scanContent(content: string): DlpScanResult {
    const violations: DlpViolation[] = [];
    let working = content;
    let anyRedacted = false;

    const allRules = [...this.rules];
    resetRules(allRules);

    for (const rule of allRules) {
      const matchCount = countMatches(content, rule);
      if (matchCount === 0) continue;

      let redacted = false;
      if (rule.action === "redact") {
        working = applyRedaction(working, rule);
        redacted = true;
        anyRedacted = true;
      }

      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        action: rule.action,
        matchCount,
        redacted,
      });
    }

    return {
      clean: violations.length === 0,
      violations,
      redactedContent: anyRedacted ? working : undefined,
    };
  }

  /**
   * Recursively scan all string values in an object for DLP violations.
   * Collects violations from all leaves; does not produce a single redactedContent string
   * because the caller must reassemble the object.
   */
  scanObject(obj: unknown): DlpScanResult {
    const allViolations: DlpViolation[] = [];
    this._walkObject(obj, allViolations);
    return {
      clean: allViolations.length === 0,
      violations: allViolations,
    };
  }

  private _walkObject(value: unknown, acc: DlpViolation[]): void {
    if (typeof value === "string") {
      const result = this.scanContent(value);
      acc.push(...result.violations);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        this._walkObject(item, acc);
      }
    } else if (value !== null && typeof value === "object") {
      for (const v of Object.values(value as Record<string, unknown>)) {
        this._walkObject(v, acc);
      }
    }
  }

  /**
   * Apply all redact-action rules to the content and return the cleaned string.
   */
  redactContent(content: string): string {
    let working = content;
    for (const rule of this.rules) {
      if (rule.action === "redact") {
        working = applyRedaction(working, rule);
      }
    }
    return working;
  }

  addRule(rule: DlpRule): void {
    // Replace if the same id exists
    const idx = this.rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      this.rules[idx] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  getRules(): DlpRule[] {
    return [...this.rules];
  }

  /**
   * Returns the base rules plus any custom rules the tenant has registered.
   *
   * Synchronous and reads from the in-process cache only, so it stays safe on the
   * hot scan path. Custom rules are durable in Postgres (see migration 027); call
   * hydrateTenantRules() or getTenantRulesPersistent() once after startup (or on a
   * cache miss) to populate the cache from the database. The public signature is
   * unchanged.
   */
  getTenantRules(tenantId: string): DlpRule[] {
    const custom = tenantRules.get(tenantId) ?? [];
    return [...this.rules, ...custom];
  }

  /**
   * Register a custom DLP rule scoped to a specific tenant.
   *
   * REAL IMPL (BLACKFYRE 2026-06): write-through. Updates the in-process cache
   * synchronously (preserving this method's `void` signature and the prior
   * behaviour for callers that never wired a DB) AND, when a Db handle is present,
   * durably upserts the rule into the `dlp_rules` table so it survives restarts.
   * The durable write is fire-and-forget here to keep the signature synchronous;
   * failures are logged as a security/audit event. Callers that require a
   * confirmed durable write should use persistTenantRule() and await it.
   */
  addTenantRule(tenantId: string, rule: DlpRule): void {
    this.cacheTenantRule(tenantId, rule);
    if (this.db) {
      // Fire-and-forget durable upsert; errors are logged, never thrown, so the
      // synchronous in-memory contract is preserved.
      void this.upsertRuleRow(tenantId, rule).catch((err) => {
        this.log.error(
          {
            event: "dlp.rule.persist.failure",
            tenantId,
            ruleId: rule.id,
            error: err instanceof Error ? err.message : String(err),
          },
          "DLP: failed to persist custom rule durably; cached in-memory only",
        );
      });
    }
  }

  // ----------------------------------------------------------------------------
  // REAL IMPL (BLACKFYRE 2026-06): durable persistence for custom tenant rules.
  // All of the following are ADDITIVE async methods; none change an existing
  // public signature. They run parameterized SQL through a Db (Drizzle/postgres-js)
  // handle and rely on RLS (tenant_isolation policy + bound app.current_tenant on
  // request.db) plus an explicit tenant_id predicate for defense in depth.
  // ----------------------------------------------------------------------------

  /**
   * Durably register/update a custom DLP rule for a tenant AND refresh the cache.
   * Awaitable variant of addTenantRule for callers that need a confirmed write.
   */
  async persistTenantRule(tenantId: string, rule: DlpRule): Promise<void> {
    this.cacheTenantRule(tenantId, rule);
    if (!this.db) return;
    await this.upsertRuleRow(tenantId, rule);
    this.log.info(
      { event: "dlp.rule.persisted", tenantId, ruleId: rule.id, action: rule.action, severity: rule.severity },
      "DLP: custom rule persisted",
    );
  }

  /**
   * Durably remove a custom DLP rule for a tenant AND evict it from the cache.
   * Built-in default rules are never stored here, so they are unaffected.
   */
  async removeTenantRule(tenantId: string, ruleId: string): Promise<void> {
    const existing = tenantRules.get(tenantId);
    if (existing) {
      tenantRules.set(tenantId, existing.filter((r) => r.id !== ruleId));
    }
    if (!this.db) return;
    await this.db.execute(
      sql`DELETE FROM dlp_rules WHERE tenant_id = ${tenantId} AND rule_id = ${ruleId}`,
    );
    this.log.info(
      { event: "dlp.rule.removed", tenantId, ruleId },
      "DLP: custom rule removed",
    );
  }

  /**
   * Load a tenant's custom rules from Postgres into the in-process cache (and
   * return base + custom). Use this on startup or on a cache miss so subsequent
   * synchronous getTenantRules() calls see durable rules. If no Db is wired this
   * falls back to whatever is cached in-process.
   */
  async getTenantRulesPersistent(tenantId: string): Promise<DlpRule[]> {
    await this.hydrateTenantRules(tenantId);
    return this.getTenantRules(tenantId);
  }

  /**
   * Populate the in-process cache for a tenant from the `dlp_rules` table.
   * No-op when no Db handle is configured.
   */
  async hydrateTenantRules(tenantId: string): Promise<void> {
    if (!this.db) return;
    const rows = (await this.db.execute(
      sql`SELECT rule_id, name, pattern, flags, severity, action, category
          FROM dlp_rules
          WHERE tenant_id = ${tenantId}`,
    )) as unknown as Array<{
      rule_id: string;
      name: string;
      pattern: string;
      flags: string;
      severity: string;
      action: string;
      category: string;
    }>;

    const loaded: DlpRule[] = [];
    for (const row of rows) {
      const rule = this.rowToRule(row);
      if (rule) loaded.push(rule);
    }
    tenantRules.set(tenantId, loaded);
    this.log.info(
      { event: "dlp.rules.hydrated", tenantId, count: loaded.length },
      "DLP: loaded custom rules from store",
    );
  }

  /** Upsert a single rule row, keyed on (tenant_id, rule_id). */
  private async upsertRuleRow(tenantId: string, rule: DlpRule): Promise<void> {
    await this.db!.execute(
      sql`INSERT INTO dlp_rules (tenant_id, rule_id, name, pattern, flags, severity, action, category, updated_at)
          VALUES (${tenantId}, ${rule.id}, ${rule.name}, ${rule.pattern.source}, ${rule.pattern.flags},
                  ${rule.severity}, ${rule.action}, ${rule.category}, now())
          ON CONFLICT (tenant_id, rule_id) DO UPDATE SET
            name = EXCLUDED.name,
            pattern = EXCLUDED.pattern,
            flags = EXCLUDED.flags,
            severity = EXCLUDED.severity,
            action = EXCLUDED.action,
            category = EXCLUDED.category,
            updated_at = now()`,
    );
  }

  /** Update or insert a rule in the shared in-process cache. */
  private cacheTenantRule(tenantId: string, rule: DlpRule): void {
    const existing = tenantRules.get(tenantId) ?? [];
    const idx = existing.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      existing[idx] = rule;
    } else {
      existing.push(rule);
    }
    tenantRules.set(tenantId, existing);
  }

  /**
   * Rehydrate a DlpRule from a stored row. Returns null (and logs) if the stored
   * pattern is not a compilable RegExp, so one bad row can't take down hydration.
   */
  private rowToRule(row: {
    rule_id: string;
    name: string;
    pattern: string;
    flags: string;
    severity: string;
    action: string;
    category: string;
  }): DlpRule | null {
    try {
      return {
        id: row.rule_id,
        name: row.name,
        pattern: new RegExp(row.pattern, row.flags || "g"),
        severity: row.severity as DlpRule["severity"],
        action: row.action as DlpRule["action"],
        category: row.category,
      };
    } catch (err) {
      this.log.warn(
        {
          event: "dlp.rule.invalid",
          ruleId: row.rule_id,
          error: err instanceof Error ? err.message : String(err),
        },
        "DLP: stored custom rule has an invalid pattern; skipping",
      );
      return null;
    }
  }

  /**
   * Derive a stable identifier hash for audit purposes.
   */
  static fingerprintContent(content: string): string {
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  }
}
