import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });

  // Create migrations tracking table
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Seed/demo migrations are marked `-- @dev-only` and must never touch a real
  // deployment. They carry their own in-file `app.env` guard that RAISEs, which
  // aborts the whole run — fine for us, fatal for a self-hoster whose database
  // has no app.env set (the run would stop at 003 and leave the schema
  // half-migrated). Detect the environment once and skip those files instead.
  const [{ env }] = await sql<{ env: string | null }[]>`
    SELECT current_setting('app.env', true) AS env
  `;
  const isDevEnv = env === "development";
  if (!isDevEnv) {
    console.log(`  app.env=${env ?? "(unset)"} — dev-only seed migrations will be skipped`);
  }

  const migrationsDir = join(__dirname, "../migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = await sql<{ name: string }[]>`SELECT name FROM _migrations`;
  const appliedSet = new Set(applied.map((r) => r.name));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip: ${file} (already applied)`);
      continue;
    }

    const content = readFileSync(join(migrationsDir, file), "utf-8");

    // Dev-only seed data: skip outside a development database, and do NOT record
    // it as applied, so the same file still seeds if this database is later
    // brought up as a dev environment.
    if (!isDevEnv && /^\s*--\s*@dev-only\b/m.test(content)) {
      console.log(`  skip: ${file} (@dev-only, app.env is not 'development')`);
      continue;
    }

    console.log(`  applying: ${file}`);
    // SQL files manage their own BEGIN/COMMIT; use unsafe with max:1 connection
    await sql.unsafe(content);
    await sql`INSERT INTO _migrations (name) VALUES (${file})`;
    console.log(`  done: ${file}`);
  }

  await sql.end();
  console.log("Migrations complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
