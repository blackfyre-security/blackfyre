import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { createDb } from "../../src/db/connection.js";
import { loadConfig } from "../../src/config.js";
import { tenants, users, scans, findings, integrations } from "../../src/db/schema.js";

/**
 * FOUND-04: Cross-tenant RLS isolation test.
 * Creates two real tenants, attempts to read tenant A data with tenant B context.
 * Every tenant-scoped table must return zero rows. CI gate — build fails on leak.
 */

const config = loadConfig();
const { db, superDb, sql: rawSql } = createDb(config);

let tenantAId: string;
let tenantBId: string;
let userAId: string;

beforeAll(async () => {
  const [tenantA] = await superDb.insert(tenants).values({
    name: "Tenant Alpha RLS Test",
    slug: `rls-test-alpha-${Date.now()}`,
    plan: "comply",
  }).returning();

  const [tenantB] = await superDb.insert(tenants).values({
    name: "Tenant Beta RLS Test",
    slug: `rls-test-beta-${Date.now()}`,
    plan: "comply",
  }).returning();

  tenantAId = tenantA.id;
  tenantBId = tenantB.id;

  // Create a test user for tenant A (required as FK for scans.triggered_by)
  const [userA] = await superDb.insert(users).values({
    tenantId: tenantAId,
    email: `rls-test-${Date.now()}@blackfyre.test`,
    name: "RLS Test User",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$placeholder",
    role: "admin",
  }).returning();

  userAId = userA.id;

  await superDb.insert(scans).values({
    tenantId: tenantAId,
    triggeredBy: userAId,
    frameworks: ["soc2"],
    targets: ["aws"],
    status: "completed",
    progress: 100,
  });
});

afterAll(async () => {
  // Clean up in reverse FK order
  await superDb.delete(scans).where(sql`${scans.tenantId} IN (${tenantAId}, ${tenantBId})`);
  await superDb.delete(users).where(sql`${users.id} = ${userAId}`);
  await superDb.delete(tenants).where(
    sql`${tenants.id} IN (${tenantAId}, ${tenantBId})`
  );
  if (typeof (rawSql as any).end === "function") {
    await (rawSql as any).end();
  }
});

async function setTenantContext(tenantId: string) {
  await db.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`);
}

describe("RLS cross-tenant isolation (FOUND-04)", () => {
  it("tenant B context cannot see tenant A scans", async () => {
    await setTenantContext(tenantBId);
    const result = await db.select().from(scans);
    expect(result.filter((s) => s.tenantId === tenantAId)).toHaveLength(0);
  });

  it("tenant B context cannot see tenant A findings", async () => {
    await setTenantContext(tenantBId);
    const result = await db.select().from(findings);
    expect(result.filter((f) => f.tenantId === tenantAId)).toHaveLength(0);
  });

  it("tenant B context cannot see tenant A integrations", async () => {
    await setTenantContext(tenantBId);
    const result = await db.select().from(integrations);
    expect(result.filter((i) => i.tenantId === tenantAId)).toHaveLength(0);
  });

  it("tenant A context can see its own scans", async () => {
    await setTenantContext(tenantAId);
    const result = await db.select().from(scans);
    expect(result.filter((s) => s.tenantId === tenantAId).length).toBeGreaterThan(0);
  });
});
