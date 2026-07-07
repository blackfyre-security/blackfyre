import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { setupGracefulShutdown } from "./utils/shutdown.js";
import { closeRedisConnection } from "./queue/connection.js";

async function start() {
  const config = loadConfig();
  const app = await buildApp(config);

  setupGracefulShutdown(app, async () => {
    await closeRedisConnection();
  });

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`Server listening on http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
