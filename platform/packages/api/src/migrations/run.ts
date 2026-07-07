// DEPRECATED: This file is a duplicate of src/db/migrate.ts.
// Use `npm run migrate` (which runs src/db/migrate.ts) instead.
// This file is kept only for the `migrate:sql` script and will be removed in a future cleanup.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Set it before running migrations."
    );
  }

  const sql = postgres(url);

  // Create migrations tracking table
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  const applied = await sql<{ name: string }[]>`SELECT name FROM _migrations`;
  const appliedNames = new Set(applied.map((r) => r.name));

  const files = readdirSync(__dirname)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let appliedCount = 0;

  for (const file of files) {
    if (appliedNames.has(file)) {
      console.log(`[migrate] Skip: ${file} (already applied)`);
      continue;
    }

    console.log(`[migrate] Applying: ${file}`);
    const content = readFileSync(join(__dirname, file), "utf-8");
    await sql.unsafe(content);
    await sql`INSERT INTO _migrations (name) VALUES (${file})`;
    console.log(`[migrate] Done: ${file}`);
    appliedCount++;
  }

  await sql.end();

  if (appliedCount === 0) {
    console.log("[migrate] All migrations already applied");
  } else {
    console.log(`[migrate] Applied ${appliedCount} migration(s)`);
  }

  console.log("[migrate] All migrations complete");
}

migrate().catch((err) => {
  console.error("[migrate] Migration failed:", err);
  process.exit(1);
});
