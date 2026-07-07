import { auditLogs } from "../db/schema.js";
import type { Db } from "../db/connection.js";

export class AuditLogger {
  constructor(private db: Db) {}

  async log(params: {
    tenantId: string;
    userId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.db.insert(auditLogs).values(params);
    } catch (err) {
      // Audit logging should never break the request
      console.error("[AuditLogger] Failed to write audit log:", err);
    }
  }
}
