import { afterAll, beforeAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import postgres from "postgres";
import { buildApp } from "../../src/app.js";
import { hashPassword } from "../../src/utils/password.js";
import type { Config } from "../../src/config.js";

// Defaults match platform/docker-compose.yml so `docker compose up -d postgres redis`
// followed by `npm test` works with no manual overrides. Both honor the env vars.
const TEST_DB_URL = process.env.DATABASE_URL || "postgres://blackfyre:blackfyre_dev@localhost:5432/blackfyre";
const TEST_REDIS_URL = process.env.REDIS_URL || "redis://:blackfyre_redis_dev@localhost:6379";

const testConfig: Config = {
  DATABASE_URL: TEST_DB_URL,
  REDIS_URL: TEST_REDIS_URL,
  JWT_SECRET: "test-secret-that-is-at-least-32-characters-long-for-testing",
  JWT_EXPIRES_IN: "15m",
  JWT_REFRESH_EXPIRES_IN: "7d",
  PORT: 0,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
};

let app: FastifyInstance;

export function getApp(): FastifyInstance {
  return app;
}

beforeAll(async () => {
  app = await buildApp(testConfig);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// Clean tenant-scoped tables between tests (order matters for FK constraints)
const TABLES_TO_CLEAN = [
  "drift_events", "reports", "alert_rules", "remediations",
  "evidence", "control_mappings", "findings", "scans",
  "integrations", "api_keys",
  "integration_credentials", "tenant_contacts", "cloud_accounts",
  "users", "tenants",
];

beforeEach(async () => {
  const sql = postgres(TEST_DB_URL);
  for (const table of TABLES_TO_CLEAN) {
    await sql.unsafe(`DELETE FROM ${table}`);
  }
  await sql.end();
});

// Helper: create a tenant + admin user and return auth token
export async function createTestTenantAndUser(
  overrides?: { role?: string; email?: string },
) {
  const app = getApp();
  const sql = postgres(TEST_DB_URL);

  // Insert tenant directly (bypasses RLS since we're superuser in tests)
  const [tenant] = await sql`
    INSERT INTO tenants (name, slug, plan, industry_profile)
    VALUES ('Test Corp', 'test-corp-' || gen_random_uuid()::text, 'retainer', 'saas')
    RETURNING *
  `;

  const email = overrides?.email || `test-${Date.now()}@blackfyre.com`;
  const passwordHash = await hashPassword("TestPass123!");
  const role = overrides?.role || "admin";

  const [user] = await sql`
    INSERT INTO users (tenant_id, email, name, password_hash, role)
    VALUES (${tenant.id}, ${email}, 'Test User', ${passwordHash}, ${role})
    RETURNING *
  `;

  await sql.end();

  // Get JWT
  const token = app.jwt.sign(
    { sub: user.id, tenantId: tenant.id, role, type: "access" },
    { expiresIn: "15m" },
  );

  return { tenant, user, token, email, password: "TestPass123!" };
}
