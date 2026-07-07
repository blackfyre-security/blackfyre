#!/usr/bin/env node
// Sandbox migration runner — uses `postgres` lib with max:1 connection to
// allow multi-statement migrations. Mirrors src/migrations/run.ts but lives
// in the sandbox so we don't touch the real runner.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "../node_modules/postgres/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "packages", "api", "src", "migrations");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

await sql`CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)`;

const applied = await sql`SELECT name FROM _migrations`;
const appliedNames = new Set(applied.map((r) => r.name));

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let count = 0;
for (const file of files) {
  if (appliedNames.has(file)) {
    console.log(`[sandbox-migrate] skip ${file}`);
    continue;
  }
  // Skip seed-data migration in sandbox — uses argon2 hashes specific to demo
  // tenants and trips the production guard. We seed our own E2E tenant directly.
  if (file === "003_seed_data.sql") {
    console.log(`[sandbox-migrate] skip ${file} (seed bypassed; sandbox seeds inline)`);
    await sql`INSERT INTO _migrations (name) VALUES (${file})`;
    continue;
  }
  console.log(`[sandbox-migrate] applying ${file}`);
  const content = readFileSync(join(migrationsDir, file), "utf-8");
  try {
    await sql.unsafe(content);
    await sql`INSERT INTO _migrations (name) VALUES (${file})`;
    console.log(`[sandbox-migrate] done ${file}`);
    count++;
  } catch (e) {
    console.error(`[sandbox-migrate] FAILED ${file}:`, e.message);
    if (e.detail) console.error("  detail:", e.detail);
    if (e.hint) console.error("  hint:", e.hint);
    process.exit(1);
  }
}

console.log(`[sandbox-migrate] applied ${count} new migration(s)`);
await sql.end();
