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

    console.log(`  applying: ${file}`);
    const content = readFileSync(join(migrationsDir, file), "utf-8");
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
