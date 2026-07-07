/**
 * Staging smoke tests — hit the deployed staging API directly to catch
 * regressions in shipped routes. Runs in vitest's node environment, no
 * browser needed.
 *
 * Skipped by default. To run against your own deployed staging stage:
 *   STAGING_SMOKE=1 STAGING_SMOKE_API_URL=https://<your-staging-api> \
 *     npx vitest run tests/smoke/staging-smoke.test.ts
 * (or wire up the `test:smoke` script in package.json).
 *
 * Why opt-in: this hits a real network endpoint and a real Lambda. Don't
 * want to run it on every unit-test invocation, and definitely not in the
 * fast CI gate.
 */
import { describe, it, expect, beforeAll } from "vitest";

const STAGING_API = process.env.STAGING_SMOKE_API_URL ?? "https://api.example.com";
const PLATFORM_ADMIN = {
  email: "admin@blackfyre.tech",
  password: "admin@blackfyre",
};

const runSmoke = process.env.STAGING_SMOKE === "1";
const d = runSmoke ? describe : describe.skip;

d("staging smoke — public endpoints", () => {
  it("POST /api/v1/contact accepts a valid submission (202)", async () => {
    const res = await fetch(`${STAGING_API}/api/v1/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Test",
        email: `smoke+${Date.now()}@example.com`,
        company: "Vitest Smoke Suite",
        topic: "Free Discovery Call",
        source: "vitest-smoke",
      }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("POST /api/v1/contact with honeypot filled returns 202 but stores as spam", async () => {
    // Endpoint always returns 202 to deny bots signal. We can't verify the
    // 'spam' status here without admin auth — see admin path below.
    const res = await fetch(`${STAGING_API}/api/v1/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bot",
        email: "bot@example.com",
        website: "https://gotcha.example.com", // honeypot
        source: "vitest-honeypot",
      }),
    });
    expect(res.status).toBe(202);
  });

  it("GET /api/ai/capabilities requires auth", async () => {
    const res = await fetch(`${STAGING_API}/api/ai/capabilities`);
    expect(res.status).toBe(401);
  });
});

d("staging smoke — auth + admin", () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await fetch(`${STAGING_API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(PLATFORM_ADMIN),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken: string };
    expect(body.accessToken).toBeTruthy();
    accessToken = body.accessToken;
  });

  it("GET /api/ai/capabilities reports active LLM provider", async () => {
    const res = await fetch(`${STAGING_API}/api/ai/capabilities`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mode: string; provider: string; model: string };
    expect(body.mode).toBe("llm");
    expect(["anthropic", "bedrock"]).toContain(body.provider);
    expect(body.model).toMatch(/anthropic|claude/i);
  });

  it("GET /api/admin/contact-submissions returns the recent test submissions", async () => {
    const res = await fetch(`${STAGING_API}/api/admin/contact-submissions?limit=10`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { items: Array<{ id: string; email: string }>; total: number };
    };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
    // At least one row exists — we just POSTed two above + the original
    // smoketest from the deploy session.
    expect(body.data.total).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/admin/lead-notification-recipients includes the seeded founder", async () => {
    const res = await fetch(`${STAGING_API}/api/admin/lead-notification-recipients`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: Array<{ email: string; isActive: boolean }>;
    };
    expect(body.success).toBe(true);
    const founder = body.data.find((r) => r.email === "founder@blackfyre.tech");
    expect(founder).toBeDefined();
  });
});
