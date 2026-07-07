import type { FastifyPluginAsync } from "fastify";
import { McpServerService } from "../services/mcp-server-service.js";
import { XaiReasoningService } from "../services/xai-reasoning-service.js";

export const mcpRoutes: FastifyPluginAsync = async (app) => {
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");

  const mcpService = new McpServerService();
  const xaiService = new XaiReasoningService();

  // GET /api/mcp/manifest — MCP server manifest (capabilities declaration)
  app.get("/api/mcp/manifest", {
    preHandler: [adminOrEngineer],
  }, async () => {
    return mcpService.getManifest();
  });

  // GET /api/mcp/tools — List all available MCP tools
  app.get("/api/mcp/tools", {
    preHandler: [adminOrEngineer],
  }, async () => {
    const tools = mcpService.getTools();
    return { tools, count: tools.length };
  });

  // POST /api/mcp/tools/execute — Execute an MCP tool call
  app.post<{ Body: { toolName: string; args: Record<string, any> } }>("/api/mcp/tools/execute", {
    preHandler: [adminOrEngineer],
  }, async (request, reply) => {
    const { toolName, args } = (request.body ?? {}) as { toolName?: string; args?: Record<string, any> };

    if (!toolName) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "toolName is required" } });
    }

    const result = await mcpService.executeTool(toolName, args ?? {});

    if (result.isError) {
      return reply.status(400).send({ error: { code: "TOOL_ERROR", message: result.content.error ?? "Tool execution failed", content: result.content } });
    }

    return { toolName, result: result.content };
  });

  // GET /api/mcp/resources — List all available MCP resources
  app.get("/api/mcp/resources", {
    preHandler: [adminOrEngineer],
  }, async () => {
    const resources = mcpService.getResources();
    return { resources, count: resources.length };
  });

  // GET /api/mcp/resources/read — Read a specific MCP resource by URI
  app.get<{ Querystring: { uri: string } }>("/api/mcp/resources/read", {
    preHandler: [adminOrEngineer],
  }, async (request, reply) => {
    const { uri } = request.query;

    if (!uri) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "uri query parameter is required" } });
    }

    const resource = await mcpService.readResource(uri);
    return { uri, content: resource.content, mimeType: resource.mimeType };
  });

  // POST /api/xai/reasoning — Generate reasoning manifest for a finding
  app.post<{ Body: { findingId: string; remediation: { title?: string; description?: string; steps?: string[]; severity?: string } } }>("/api/xai/reasoning", {
    preHandler: [adminOrEngineer],
  }, async (request, reply) => {
    const { findingId, remediation } = (request.body ?? {}) as {
      findingId?: string;
      remediation?: { title?: string; description?: string; steps?: string[]; severity?: string };
    };

    if (!findingId) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "findingId is required" } });
    }

    const manifest = xaiService.generateManifest(findingId, remediation ?? {});
    return reply.status(201).send({ manifest });
  });

  // GET /api/xai/reasoning/:findingId — Get all reasoning manifests for a finding
  app.get<{ Params: { findingId: string } }>("/api/xai/reasoning/:findingId", {
    preHandler: [adminOrEngineer],
  }, async (request) => {
    const { findingId } = request.params;
    const manifests = xaiService.getManifestHistory(findingId);
    return { findingId, manifests, count: manifests.length };
  });
};
