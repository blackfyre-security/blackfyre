/**
 * Migration Lambda handler — runs DB migrations against the in-VPC RDS instance.
 * Invoked manually after `sst deploy`:
 *
 *   aws lambda invoke \
 *     --function-name <MigrateLambdaFunctionName> \
 *     --region ap-south-1 \
 *     /tmp/migrate-output.json
 *
 * The handler reads DATABASE_URL from env, applies any pending SQL files in
 * the bundled migrations directory, and returns a summary.
 *
 * SQL files are bundled into the Lambda zip via SST `copyFiles` (see infra/migrations.ts).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

export async function handler(): Promise<{
  ok: boolean;
  applied: string[];
  skipped: string[];
  error?: string;
}> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return { ok: false, applied: [], skipped: [], error: "DATABASE_URL env var missing" };
  }

  const sql = postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 30 });
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    // Seed migrations (003_seed_data.sql, 018_seed_blackfyre_admin.sql) check
    // current_setting('app.env', true) and only run when it equals 'development'.
    // Staging acts as a dev-equivalent test env so seeds run there; prod MUST
    // NOT seed the weak `password123` users or the `admin@blackfyre.tech`
    // platform admin.
    //
    // The signal is SST_STAGE (passed via infra/migrations.ts). NODE_ENV
    // tells us nothing — every Lambda runs with NODE_ENV=production. Fail
    // safe: anything not explicitly 'staging' or 'demo' treats itself as
    // prod.
    const sstStage = process.env.SST_STAGE ?? "";
    const isDevStage = sstStage === "staging" || sstStage === "demo" || sstStage.startsWith("dev");
    const appEnv = isDevStage ? "development" : "production";
    await sql.unsafe(`SET app.env = '${appEnv}'`);

    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // SST copyFiles places migrations under /var/task/migrations
    const migrationsDir = join("/var/task", "migrations");
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const alreadyApplied = await sql<{ name: string }[]>`SELECT name FROM _migrations`;
    const appliedSet = new Set(alreadyApplied.map((r) => r.name));

    for (const file of files) {
      if (appliedSet.has(file)) {
        skipped.push(file);
        continue;
      }
      const sqlText = readFileSync(join(migrationsDir, file), "utf8");
      await sql.unsafe(sqlText);
      await sql`INSERT INTO _migrations (name) VALUES (${file})`;
      applied.push(file);
    }

    return { ok: true, applied, skipped };
  } catch (err) {
    return { ok: false, applied, skipped, error: (err as Error).message };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
