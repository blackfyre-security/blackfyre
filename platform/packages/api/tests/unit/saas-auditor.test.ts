// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real SaaS auditor. The provider
// admin REST APIs ARE this auditor's SDK, and every outbound call routes through safeFetch (the
// SSRF chokepoint), so we vi.mock ../../src/lib/safe-fetch.js and drive it per-URL. We assert
// findings are derived from the ACTUAL returned policy state — a pass-case (compliant Okta org =>
// no findings) and a fail-case (insecure Okta org => MFA-not-enforced + weak-password + SSO
// findings) for the MFA / password-policy / SSO checks, plus the not-assessed (no credential) path.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentFindingPayload } from "@blackfyre/shared";

// The mock fn is created via vi.hoisted so it exists before the hoisted vi.mock factory runs.
const { mockSafeFetch } = vi.hoisted(() => ({ mockSafeFetch: vi.fn() }));
vi.mock("../../src/lib/safe-fetch.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/safe-fetch.js")>(
    "../../src/lib/safe-fetch.js",
  );
  return { ...actual, safeFetch: mockSafeFetch };
});

// Return a non-empty control mapping so we can assert findings carry mappings.
vi.mock("../../src/services/compliance-mapper.js", () => ({
  mapCheckToControls: vi.fn().mockImplementation((_checkType: string) => [
    { framework: "soc2", controlId: "CC6.1", controlName: "Test Control", status: "fail", weight: 3 },
  ]),
}));

import { SaasAuditorAgent } from "../../src/agents/saas-auditor.js";

/** Builds a minimal Response-like object for safeFetch with JSON body + status. */
function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

/** Routes a mocked safeFetch call to a body by matching the request URL. */
function routeByUrl(routes: Array<{ match: string; body: unknown; ok?: boolean; status?: number }>) {
  mockSafeFetch.mockImplementation(async (url: string) => {
    const hit = routes.find((r) => url.includes(r.match));
    if (!hit) return jsonResponse(null, false, 404);
    return jsonResponse(hit.body, hit.ok ?? true, hit.status ?? 200);
  });
}

const OKTA_REF = JSON.stringify({
  provider: "okta",
  apiUrl: "https://acme.okta.com",
  apiKey: "ssws-token",
});

async function runAgent(credentialRef: string) {
  const agent = new SaasAuditorAgent();
  const emitted: AgentFindingPayload[] = [];
  const result = await agent.run({
    scanId: "scan-1",
    tenantId: "tenant-1",
    integrationId: "int-1",
    credentialRef,
    frameworks: ["soc2"],
    onProgress: () => {},
    onFinding: async (f) => {
      emitted.push(f);
    },
  });
  return { result, emitted };
}

describe("SaasAuditorAgent (real Okta org policy)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fail-case: insecure Okta org emits MFA, weak-password and SSO findings from real policy", async () => {
    routeByUrl([
      // MFA enrollment NOT required.
      {
        match: "policies?type=MFA_ENROLL",
        body: [{ status: "ACTIVE", settings: { factors: { enroll: { self: "OPTIONAL" } } } }],
      },
      // Weak password policy: 8 chars, no complexity.
      {
        match: "policies?type=PASSWORD",
        body: [
          {
            status: "ACTIVE",
            settings: {
              password: { complexity: { minLength: 8, minLowerCase: 0, minUpperCase: 0, minNumber: 0 } },
            },
          },
        ],
      },
      // No active SSO IdP configured.
      { match: "/api/v1/idps", body: [] },
    ]);

    const { result, emitted } = await runAgent(OKTA_REF);

    expect(result.error).toBeNull();

    const mfa = emitted.find((f) => f.title.includes("MFA not enforced for all users"));
    const pwd = emitted.find((f) => f.title.includes("Weak password policy"));
    const sso = emitted.find((f) => f.title.includes("Single Sign-On not configured"));

    expect(mfa).toBeDefined();
    expect(mfa!.severity).toBe("critical");
    expect(mfa!.category).toBe("identity");
    expect(mfa!.resourceId).toBe("okta/mfa-enforcement");
    expect(mfa!.source).toBe("saas-auditor");
    expect(mfa!.controlMappings!.length).toBeGreaterThan(0);

    expect(pwd).toBeDefined();
    expect(pwd!.severity).toBe("high");
    // Real reported minimum length surfaces in the evidence.
    expect(pwd!.description).toContain("8 characters");

    expect(sso).toBeDefined();
    expect(sso!.severity).toBe("medium");

    // No fabricated "not-assessed" finding when the policy was actually readable.
    expect(emitted.some((f) => f.title.includes("not assessed"))).toBe(false);
  });

  it("pass-case: compliant Okta org produces no findings", async () => {
    routeByUrl([
      {
        match: "policies?type=MFA_ENROLL",
        body: [{ status: "ACTIVE", settings: { factors: { enroll: { self: "REQUIRED" } } } }],
      },
      {
        match: "policies?type=PASSWORD",
        body: [
          {
            status: "ACTIVE",
            settings: {
              password: { complexity: { minLength: 14, minLowerCase: 1, minUpperCase: 1, minNumber: 1 } },
            },
          },
        ],
      },
      { match: "/api/v1/idps", body: [{ status: "ACTIVE", type: "SAML2" }] },
    ]);

    const { result, emitted } = await runAgent(OKTA_REF);

    expect(result.error).toBeNull();
    expect(result.findingsCount).toBe(0);
    expect(emitted).toHaveLength(0);
  });

  it("not-assessed: no credential emits a single info finding, never canned posture", async () => {
    // No apiKey => not-assessed path; safeFetch must never be called.
    const { result, emitted } = await runAgent(
      JSON.stringify({ provider: "okta", apiUrl: "https://acme.okta.com" }),
    );

    expect(result.error).toBeNull();
    expect(result.findingsCount).toBe(1);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].severity).toBe("info");
    expect(emitted[0].title).toContain("not assessed");
    expect(emitted[0].resourceId).toBe("okta/not-assessed");
    expect(mockSafeFetch).not.toHaveBeenCalled();
  });

  it("not-assessed: unreadable admin API (all 404) emits a single info finding", async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse(null, false, 403));

    const { result, emitted } = await runAgent(OKTA_REF);

    expect(result.error).toBeNull();
    expect(result.findingsCount).toBe(1);
    expect(emitted[0].severity).toBe("info");
    expect(emitted[0].title).toContain("not assessed");
  });
});
