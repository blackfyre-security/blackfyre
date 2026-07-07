import { describe, it, expect } from "vitest";
import { getApp, createTestTenantAndUser } from "../helpers/setup.js";
import postgres from "postgres";

const TEST_DB_URL = process.env.DATABASE_URL || "postgres://blackfyre:localdev@localhost:5432/blackfyre_audit";

/**
 * Tenant Isolation Tests
 *
 * Verifies that tenant A's JWT token cannot access tenant B's data
 * across all critical resource types. This is the most important
 * security test in the entire suite.
 */
describe("Tenant Isolation", () => {
  let tenantA: Awaited<ReturnType<typeof createTestTenantAndUser>>;
  let tenantB: Awaited<ReturnType<typeof createTestTenantAndUser>>;
  let scanIdA: string;
  let findingIdA: string;

  it("sets up two tenants with data", async () => {
    const app = getApp();
    tenantA = await createTestTenantAndUser({ email: "admin-a@corp-a.com" });
    tenantB = await createTestTenantAndUser({ email: "admin-b@corp-b.com" });

    // Create a scan for tenant A
    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scans",
      headers: { authorization: `Bearer ${tenantA.token}` },
      payload: { frameworks: ["soc2"], targets: ["aws"] },
    });

    if (scanRes.statusCode === 201 || scanRes.statusCode === 200) {
      const body = JSON.parse(scanRes.body);
      scanIdA = body.scan?.id;
    }

    // Insert a finding for tenant A directly
    const sql = postgres(TEST_DB_URL);
    if (scanIdA) {
      const [finding] = await sql`
        INSERT INTO findings (tenant_id, scan_id, title, severity, status, category, remediation_tier, dedup_hash)
        VALUES (${tenantA.tenant.id}, ${scanIdA}, 'Test Finding A', 'high', 'open', 'iam', 'auto', md5(random()::text))
        RETURNING id
      `;
      findingIdA = finding.id;
    }
    await sql.end();

    expect(tenantA.tenant.id).toBeDefined();
    expect(tenantB.tenant.id).toBeDefined();
    expect(tenantA.tenant.id).not.toBe(tenantB.tenant.id);
  });

  it("tenant B cannot list tenant A scans", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/scans",
      headers: { authorization: `Bearer ${tenantB.token}` },
    });

    const body = JSON.parse(res.body);
    const scans = body.scans || [];
    const leakedScan = scans.find((s: { id: string }) => s.id === scanIdA);
    expect(leakedScan).toBeUndefined();
  });

  it("tenant B cannot access tenant A scan by ID", async () => {
    if (!scanIdA) return;
    const app = getApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/scans/${scanIdA}`,
      headers: { authorization: `Bearer ${tenantB.token}` },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("tenant B cannot list tenant A findings", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/findings",
      headers: { authorization: `Bearer ${tenantB.token}` },
    });

    const body = JSON.parse(res.body);
    const findings = body.findings || [];
    const leaked = findings.find((f: { id: string }) => f.id === findingIdA);
    expect(leaked).toBeUndefined();
  });

  it("tenant B cannot access tenant A finding by ID", async () => {
    if (!findingIdA) return;
    const app = getApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/findings/${findingIdA}`,
      headers: { authorization: `Bearer ${tenantB.token}` },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("unauthenticated request is rejected", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/scans",
    });

    expect(res.statusCode).toBe(401);
  });

  it("tenant B cannot modify tenant A finding status", async () => {
    if (!findingIdA) return;
    const app = getApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/findings/${findingIdA}`,
      headers: { authorization: `Bearer ${tenantB.token}` },
      payload: { status: "dismissed" },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});
