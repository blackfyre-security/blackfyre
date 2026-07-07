import type { FastifyInstance } from "fastify";

export function setupGracefulShutdown(
  app: FastifyInstance,
  cleanup?: () => Promise<void>,
): void {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`[shutdown] Received ${signal}, shutting down gracefully...`);
      try {
        await app.close();
        if (cleanup) await cleanup();
        console.log("[shutdown] Clean shutdown complete");
        process.exit(0);
      } catch (err) {
        console.error("[shutdown] Error during shutdown:", err);
        process.exit(1);
      }
    });
  }
}
