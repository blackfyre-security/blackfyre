/**
 * Standalone runner for the demo server.
 *
 * Reads scan-bundle.json from disk (SCAN_BUNDLE_PATH env var or repo-relative default)
 * and starts the Fastify app on DEMO_PORT.
 *
 * Used by `npm run demo` for local development. Lambda deploys use demo-lambda.ts instead.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDemoApp, DEMO_PORT, type DemoBundle } from "./demo-server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BUNDLE_PATH = path.resolve(__dirname, "../../../../sandbox/fake-org/scan-bundle.json");
const BUNDLE_PATH = process.env.SCAN_BUNDLE_PATH ?? DEFAULT_BUNDLE_PATH;

let bundle: DemoBundle | null = null;
try {
  bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, "utf8")) as DemoBundle;
  console.log(`[demo-server] loaded bundle: ${bundle?.findings?.length ?? 0} findings, ${bundle?.scans?.length ?? 0} scans`);
} catch (err) {
  console.warn(`[demo-server] WARNING: Could not load bundle from ${BUNDLE_PATH} — falling back to hardcoded data. Error: ${(err as Error).message}`);
}

const app = await buildDemoApp(bundle);
await app.listen({ port: DEMO_PORT, host: "0.0.0.0" });

console.log("");
console.log("  BLACKFYRE Demo Server");
console.log("  ─────────────────────────────────────");
console.log(`  API:     http://localhost:${DEMO_PORT}`);
console.log(`  Health:  http://localhost:${DEMO_PORT}/api/health`);
console.log(`  Login:   POST http://localhost:${DEMO_PORT}/api/auth/login`);
console.log("  ─────────────────────────────────────");
console.log("  Demo user: admin@acme.com (any password)");
console.log("  No database required — all data is in-memory");
console.log("");
