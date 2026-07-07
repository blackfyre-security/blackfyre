import type { FastifyPluginAsync } from "fastify";
import { AuditChainService } from "../services/audit-chain-service.js";
import { eq } from "drizzle-orm";
import { auditLogs } from "../db/schema.js";

export const auditChainRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole(
    "owner",
    "admin",
    "engineer",
    "viewer"
  );
  const adminOnly = (app as any).requireRole("owner", "admin");

  // GET /api/sovereignty/audit-chain/verify
  // Verify the integrity of the immutable audit chain for the authenticated tenant
  app.get("/api/sovereignty/audit-chain/verify", {
    preHandler: [adminOnly],
  }, async (request) => {
    const query = request.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    const service = new AuditChainService(app.db);
    const result = await service.verifyChain(request.tenantId, limit);
    return { verification: result };
  });

  // GET /api/sovereignty/audit-chain/state
  // Get the current chain state: last hash, last sequence number
  app.get("/api/sovereignty/audit-chain/state", {
    preHandler: [adminOnly],
  }, async (request) => {
    const service = new AuditChainService(app.db);
    const state = await service.getChainState(request.tenantId);
    return { chainState: state };
  });

  // GET /api/sovereignty/audit-chain/entry/:id
  // Get a single audit log entry with its chain proof fields
  app.get<{ Params: { id: string } }>(
    "/api/sovereignty/audit-chain/entry/:id",
    { preHandler: [authenticated] },
    async (request, reply) => {
      const { id } = request.params;
      const [entry] = await app.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.id, id))
        .limit(1);

      if (!entry) {
        return reply
          .status(404)
          .send({ error: { code: "NOT_FOUND", message: "Audit entry not found" } });
      }

      // Enforce tenant isolation
      if (entry.tenantId !== request.tenantId) {
        return reply
          .status(403)
          .send({ error: { code: "FORBIDDEN", message: "Access denied" } });
      }

      const chain = (entry.details as any)?._chain;
      return {
        entry: {
          id: entry.id,
          tenantId: entry.tenantId,
          userId: entry.userId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          createdAt: entry.createdAt,
          chainProof: chain || null,
        },
      };
    }
  );

  // POST /api/sovereignty/audit-chain/export
  // Export the full audit chain for external verification
  app.post("/api/sovereignty/audit-chain/export", {
    preHandler: [adminOnly],
  }, async (request) => {
    const body = (request.body ?? {}) as { limit?: number };
    const limit = body.limit && body.limit > 0 ? body.limit : 1000;

    const entries = await app.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, request.tenantId))
      .limit(limit);

    const service = new AuditChainService(app.db);
    const verification = await service.verifyChain(request.tenantId, limit);

    return {
      export: {
        tenantId: request.tenantId,
        exportedAt: new Date().toISOString(),
        totalEntries: entries.length,
        chainIntegrity: verification,
        entries: entries.map((e) => ({
          id: e.id,
          userId: e.userId,
          action: e.action,
          resourceType: e.resourceType,
          resourceId: e.resourceId,
          ipAddress: e.ipAddress,
          createdAt: e.createdAt,
          chainProof: (e.details as any)?._chain || null,
        })),
      },
    };
  });
};
