#!/usr/bin/env node
// Tiny pglite-backed postgres compatible socket on :5432.
// Useful for sandbox runs where Docker / native postgres isn't available.
//
// Boot:  node platform/sandbox/pglite-server.mjs
// Stop:  Ctrl+C  (or SIGTERM)
// Conn:  postgres://blackfyre:blackfyre_dev@localhost:5432/blackfyre
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, ".pglite-data");
mkdirSync(dataDir, { recursive: true });

const port = Number(process.env.PGLITE_PORT ?? 5432);
const db = await PGlite.create({ dataDir });

// Mirror what docker-compose would have set up.
await db.exec(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'blackfyre') THEN
      CREATE ROLE blackfyre LOGIN SUPERUSER PASSWORD 'blackfyre_dev';
    END IF;
  END $$;
`);

const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 32 });
await server.start();
console.log(`[pglite] listening on 127.0.0.1:${port} (data: ${dataDir})`);

const shutdown = async () => {
  console.log("[pglite] stopping...");
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
