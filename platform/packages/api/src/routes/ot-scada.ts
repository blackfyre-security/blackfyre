/**
 * OT/SCADA Routes
 *
 * ALL routes in this file require a safety gate acknowledgment.
 * Any request without acknowledgment returns 403 with the disclaimer text.
 *
 * PASSIVE ONLY — no routes initiate connections to industrial devices.
 */

import type { FastifyPluginAsync } from "fastify";
import { OtSafetyGateService } from "../services/ot-safety-gate.js";
import { getCollector } from "../agents/ot-scada-collector.js";
import { badRequest } from "../utils/errors.js";

const safetyGate = new OtSafetyGateService();

export const otScadaRoutes: FastifyPluginAsync = async (app) => {
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");
  const adminOnly = (app as any).requireRole("owner", "admin");

  /* ---------------------------------------------------------------- */
  /*  Safety Gate middleware                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Enforces safety acknowledgment on all OT endpoints except the
   * safety-gate endpoints themselves. Returns 403 with disclaimer text
   * if acknowledgment has not been recorded for this tenant.
   */
  async function requireSafetyAck(request: any, reply: any) {
    const tenantId: string = request.tenantId;
    if (!safetyGate.checkAcknowledgment(tenantId)) {
      const { version, text } = safetyGate.getDisclaimer();
      return reply.status(403).send({
        success: false,
        error: {
          code: "OT_SAFETY_ACK_REQUIRED",
          message: "Safety disclaimer must be acknowledged before accessing OT/SCADA features.",
          disclaimer: { version, text },
        },
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Safety Gate endpoints (no safety-ack required)                  */
  /* ---------------------------------------------------------------- */

  // GET /api/ot-scada/safety-gate — check acknowledgment status and return disclaimer
  app.get("/api/ot-scada/safety-gate", {
    preHandler: [adminOrEngineer],
  }, async (request: any) => {
    const acknowledged = safetyGate.checkAcknowledgment(request.tenantId);
    const ack = safetyGate.getAcknowledgment(request.tenantId);
    const { version, text } = safetyGate.getDisclaimer();

    return {
      acknowledged,
      disclaimerVersion: version,
      disclaimer: text,
      acknowledgment: acknowledged && ack
        ? {
            acknowledgedBy: ack.acknowledgedBy,
            acknowledgedAt: ack.acknowledgedAt,
            ipAddress: ack.ipAddress,
          }
        : null,
    };
  });

  // POST /api/ot-scada/safety-gate/acknowledge — record safety acknowledgment
  app.post<{ Body: { confirm: boolean } }>("/api/ot-scada/safety-gate/acknowledge", {
    preHandler: [adminOnly],
  }, async (request: any, reply) => {
    const body = request.body as { confirm?: boolean };

    if (body?.confirm !== true) {
      throw badRequest(
        "OT_ACK_CONFIRM_REQUIRED",
        'Request body must include { "confirm": true } to acknowledge the safety disclaimer.',
      );
    }

    const ipAddress =
      request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
      request.ip ??
      "unknown";

    const ack = safetyGate.acknowledge(request.tenantId, request.userId, ipAddress);

    return reply.status(200).send({
      acknowledged: true,
      message: "Safety disclaimer acknowledged. OT/SCADA features are now enabled for this session.",
      acknowledgment: {
        acknowledgedBy: ack.acknowledgedBy,
        acknowledgedAt: ack.acknowledgedAt,
        disclaimerVersion: ack.disclaimerVersion,
        ipAddress: ack.ipAddress,
      },
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Asset Registry                                                   */
  /* ---------------------------------------------------------------- */

  // GET /api/ot-scada/assets — list discovered ICS assets
  app.get<{
    Querystring: { rogue?: string; deviceType?: string; purdueLevel?: string };
  }>("/api/ot-scada/assets", {
    preHandler: [adminOrEngineer, requireSafetyAck],
  }, async (request: any) => {
    const collector = getCollector(request.tenantId);
    const { rogue, deviceType, purdueLevel } = request.query as any;

    const filter: Record<string, unknown> = {};
    if (rogue !== undefined) filter.isRogue = rogue === "true";
    if (deviceType) filter.deviceType = deviceType;
    if (purdueLevel !== undefined) {
      const level = parseInt(purdueLevel, 10);
      if (!isNaN(level) && level >= 0 && level <= 5) filter.purdueLevel = level;
    }

    const assets = collector.getAssets();
    const summary = collector.getAssetSummary();

    return { assets, summary, count: assets.length };
  });

  /* ---------------------------------------------------------------- */
  /*  Findings                                                         */
  /* ---------------------------------------------------------------- */

  // GET /api/ot-scada/findings — list OT findings
  app.get<{
    Querystring: { protocol?: string; severity?: string; type?: string };
  }>("/api/ot-scada/findings", {
    preHandler: [adminOrEngineer, requireSafetyAck],
  }, async (request: any) => {
    const collector = getCollector(request.tenantId);
    const { protocol, severity, type } = request.query as any;

    let findings = collector.getFindings();

    if (protocol) findings = findings.filter((f) => f.protocol === protocol);
    if (severity) findings = findings.filter((f) => f.severity === severity);
    if (type) findings = findings.filter((f) => f.type === type);

    // Most recent first
    findings = findings.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return { findings, count: findings.length };
  });

  /* ---------------------------------------------------------------- */
  /*  Collector Control                                                */
  /* ---------------------------------------------------------------- */

  // POST /api/ot-scada/collector/start — start passive collection
  app.post("/api/ot-scada/collector/start", {
    preHandler: [adminOnly, requireSafetyAck],
  }, async (request: any, reply) => {
    const collector = getCollector(request.tenantId);

    if (collector.isRunning()) {
      return reply.status(200).send({
        message: "Passive collector is already running.",
        status: collector.getStatus(),
      });
    }

    collector.start({ tenantId: request.tenantId });

    return reply.status(200).send({
      message:
        "Passive OT/SCADA collector started. Connect your SPAN/TAP feed to begin receiving mirrored traffic.",
      status: collector.getStatus(),
    });
  });

  // POST /api/ot-scada/collector/stop — stop passive collection
  app.post("/api/ot-scada/collector/stop", {
    preHandler: [adminOnly, requireSafetyAck],
  }, async (request: any, reply) => {
    const collector = getCollector(request.tenantId);

    if (!collector.isRunning()) {
      return reply.status(200).send({
        message: "Passive collector is not running.",
        status: collector.getStatus(),
      });
    }

    collector.stop();

    return reply.status(200).send({
      message: "Passive OT/SCADA collector stopped.",
      status: collector.getStatus(),
    });
  });

  // GET /api/ot-scada/collector/status — collector status
  app.get("/api/ot-scada/collector/status", {
    preHandler: [adminOrEngineer, requireSafetyAck],
  }, async (request: any) => {
    const collector = getCollector(request.tenantId);
    return { status: collector.getStatus() };
  });
};
