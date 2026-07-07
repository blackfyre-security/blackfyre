import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

const requestLoggerPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onResponse", async (request, reply) => {
    const duration = reply.elapsedTime;
    const log = {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${Math.round(duration)}ms`,
      tenantId: (request as any).tenantId || "anonymous",
      requestId: (request as any).requestId,
    };

    if (reply.statusCode >= 500) {
      request.log.error(log, "Request failed");
    } else if (reply.statusCode >= 400) {
      request.log.warn(log, "Request error");
    } else if (duration > 1000) {
      request.log.warn(log, "Slow request");
    }
  });
};

export default fp(requestLoggerPlugin, { name: "request-logger" });
