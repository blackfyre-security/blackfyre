import type { FastifyPluginAsync } from "fastify";
import { ConfidentialComputeService } from "../services/confidential-compute-service.js";
import type { ConfidentialEnvelope } from "../services/confidential-compute-service.js";

export const confidentialComputeRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");

  // POST /api/sovereignty/attestation — Generate attestation report (client sends nonce)
  app.post<{ Body: { nonce: string } }>("/api/sovereignty/attestation", {
    preHandler: [authenticated],
  }, async (request, reply) => {
    const { nonce } = (request.body ?? {}) as { nonce?: string };
    if (!nonce) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "nonce is required" } });
    }
    const service = new ConfidentialComputeService();
    const report = await service.generateAttestation(nonce);
    return { attestation: report };
  });

  // POST /api/sovereignty/verify — Verify an attestation report
  app.post<{ Body: { report: any; expectedNonce: string } }>("/api/sovereignty/verify", {
    preHandler: [adminOrEngineer],
  }, async (request, reply) => {
    const { report, expectedNonce } = (request.body ?? {}) as { report?: any; expectedNonce?: string };
    if (!report || !expectedNonce) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "report and expectedNonce are required" } });
    }
    const service = new ConfidentialComputeService();
    const result = service.verifyAttestation(report, expectedNonce);
    return { verification: result };
  });

  // GET /api/sovereignty/integrity — Get current integrity manifest
  app.get("/api/sovereignty/integrity", {
    preHandler: [authenticated],
  }, async () => {
    const service = new ConfidentialComputeService();
    const manifest = service.generateIntegrityManifest();
    return { manifest };
  });

  // POST /api/sovereignty/encrypt — Encrypt data for TEE processing
  app.post<{ Body: { plaintext: string; kek?: string } }>("/api/sovereignty/encrypt", {
    preHandler: [adminOrEngineer],
  }, async (request, reply) => {
    const { plaintext, kek } = (request.body ?? {}) as { plaintext?: string; kek?: string };
    if (!plaintext) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "plaintext is required" } });
    }
    const service = new ConfidentialComputeService();
    const envelope = service.encryptForTee(plaintext, kek);
    return { envelope };
  });

  // GET /api/sovereignty/transparency/:decisionId — Get transparency manifest for AI decision
  app.get<{
    Params: { decisionId: string };
    Querystring: { modelVersion?: string; input?: string; output?: string };
  }>("/api/sovereignty/transparency/:decisionId", {
    preHandler: [authenticated],
  }, async (request) => {
    const { decisionId } = request.params;
    const { modelVersion, input, output } = request.query;
    const service = new ConfidentialComputeService();
    const manifest = service.generateTransparencyManifest({
      decisionId,
      modelVersion: modelVersion || "unknown",
      input: input ? (() => { try { return JSON.parse(input); } catch { return {}; } })() : {},
      output: output ? (() => { try { return JSON.parse(output); } catch { return {}; } })() : {},
    });
    return { manifest };
  });
};
