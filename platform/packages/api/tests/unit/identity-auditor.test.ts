// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real Identity auditor.
// The IdP REST APIs (Okta Users/Factors/Roles, Microsoft Entra Graph users +
// authentication/methods + directoryRoles, Google Workspace Admin SDK Directory) ARE
// this auditor's "SDK", and every outbound call is routed through the SSRF chokepoint
// safeFetch(). We therefore vi.mock the safe-fetch module and program per-URL JSON
// responses so the test runs hermetically (no live IdP, no real network). The real
// SsrfBlockedError is re-exported so the auditor's `instanceof` checks still work.
//
// Coverage: pass + fail cases for a couple of checks —
//   - Okta: FAIL (admin without MFA + unenrolled users) and PASS (everyone enrolled, no admin sprawl).
//   - Google: FAIL (stale account) computed from real lastLoginTime.
//   - needsLiveEnv: no credential -> explicit "not-assessed" finding (no fabricated numbers).
//   - reachable-but-unauthorized directory -> "not-assessed" (no fabricated numbers).
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentFindingPayload } from "@blackfyre/shared";
import type { AgentContext } from "../../src/agents/base-agent.js";

// The mock fn is created via vi.hoisted so it is initialised BEFORE the hoisted
// vi.mock factory runs (vitest hoists vi.mock above all top-level declarations).
const { mockSafeFetch } = vi.hoisted(() => ({ mockSafeFetch: vi.fn() }));
vi.mock("../../src/lib/safe-fetch.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/safe-fetch.js")>(
    "../../src/lib/safe-fetch.js",
  );
  return { ...actual, safeFetch: mockSafeFetch };
});

// Mock compliance-mapper so findings carry non-empty control mappings deterministically.
vi.mock("../../src/services/compliance-mapper.js", () => ({
  mapCheckToControls: vi.fn().mockImplementation((checkType: string) => [
    {
      framework: "soc2",
      controlId: "CC6.1",
      controlName: `Test Control for ${checkType}`,
      status: "fail",
      weight: 3,
    },
  ]),
}));

// Import after mocks so the auditor picks up the mocked safeFetch.
import { IdentityAuditorAgent } from "../../src/agents/identity-auditor.js";

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

/**
 * Minimal Response stand-in that safeFetch's callers use: ok / status / json() /
 * headers.get(). Lets us program Okta's RFC5988 Link header for cursor pagination.
 */
function makeResponse(
  body: unknown,
  opts: { ok?: boolean; status?: number; link?: string } = {},
): any {
  const ok = opts.ok ?? true;
  const status = opts.status ?? (ok ? 200 : 401);
  const headers = new Map<string, string>();
  if (opts.link) headers.set("link", opts.link);
  return {
    ok,
    status,
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    json: async () => body,
  };
}

/**
 * Routes mocked safeFetch by URL substring. `routes` maps a substring of the request
 * URL to the Response to return; first match wins (longest-first for specificity).
 */
function wireRoutes(routes: Array<[match: string, response: any]>): void {
  const ordered = [...routes].sort((a, b) => b[0].length - a[0].length);
  mockSafeFetch.mockImplementation(async (url: string) => {
    for (const [match, response] of ordered) {
      if (url.includes(match)) return response;
    }
    throw new Error(`no mock route for ${url}`);
  });
}

/** Drives the BaseAgent and collects every emitted finding. */
async function runAgent(credentialRef: string): Promise<AgentFindingPayload[]> {
  const agent = new IdentityAuditorAgent();
  const findings: AgentFindingPayload[] = [];
  const ctx: AgentContext = {
    scanId: "scan-1",
    tenantId: "tenant-1",
    integrationId: "integ-1",
    credentialRef,
    frameworks: ["soc2"],
    onProgress: () => {},
    onFinding: async (f) => {
      findings.push(f);
    },
  };
  const result = await agent.run(ctx);
  expect(result.error).toBeNull();
  expect(result.findingsCount).toBe(findings.length);
  return findings;
}

describe("IdentityAuditorAgent (real IdP enumeration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // needsLiveEnv: no credential -> explicit not-assessed, NOT fabricated numbers.
  // ---------------------------------------------------------------------------
  it("not-assessed: no API credential yields an explicit informational finding, no fabricated posture", async () => {
    const findings = await runAgent(
      JSON.stringify({ provider: "okta", apiUrl: "https://acme.okta.com" }), // no apiKey
    );

    expect(mockSafeFetch).not.toHaveBeenCalled();
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("info");
    expect(findings[0].title).toContain("not assessed");
    expect(findings[0].resourceId).toBe("okta/not-assessed");
    // The old stub returned enrollmentPercent:85 / 3 admins / 0 stale. Assert those
    // fabricated numbers are NOT present anywhere in the not-assessed output.
    expect(findings[0].description).not.toContain("85");
    expect(findings.some((f) => f.title.includes("enrollment"))).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Okta FAIL case: admin without MFA + unenrolled users computed from real factors.
  // ---------------------------------------------------------------------------
  it("Okta FAIL: flags an admin without MFA and incomplete enrollment from real factors/roles", async () => {
    const base = "https://acme.okta.com";
    const users = [
      { id: "u-admin", status: "ACTIVE", profile: { login: "root@acme.com" }, lastLogin: new Date(NOW).toISOString() },
      { id: "u-noMfa", status: "ACTIVE", profile: { login: "bob@acme.com" }, lastLogin: new Date(NOW).toISOString() },
    ];
    wireRoutes([
      // Users list (single page; no Link:next header -> pagination stops).
      [`${base}/api/v1/users?limit=200`, makeResponse(users)],
      // Admin has NO active factors; is an admin via roles.
      [`/api/v1/users/u-admin/factors`, makeResponse([])],
      [`/api/v1/users/u-admin/roles`, makeResponse([{ type: "SUPER_ADMIN", label: "Super Administrator" }])],
      // Regular user: no factors, no roles.
      [`/api/v1/users/u-noMfa/factors`, makeResponse([])],
      [`/api/v1/users/u-noMfa/roles`, makeResponse([])],
    ]);

    const findings = await runAgent(JSON.stringify({ provider: "okta", apiUrl: base, apiKey: "SSWS_test" }));

    // Per-account critical: admin holds a privileged role but has no MFA factor.
    const adminNoMfa = findings.find((f) => f.title.startsWith("Admin account without MFA"));
    expect(adminNoMfa).toBeDefined();
    expect(adminNoMfa!.severity).toBe("critical");
    expect(adminNoMfa!.resourceId).toBe("okta/user/u-admin");
    expect(adminNoMfa!.description).toContain("root@acme.com");
    expect(adminNoMfa!.controlMappings!.length).toBeGreaterThan(0);

    // Incomplete MFA enrollment: 2 of 2 active users unenrolled -> 100% missing -> critical.
    const enroll = findings.find((f) => f.title.includes("Incomplete MFA enrollment"));
    expect(enroll).toBeDefined();
    expect(enroll!.severity).toBe("critical");
    expect(enroll!.resourceId).toBe("okta/mfa-enrollment");

    // Real authorization header was sent on the Okta request (SSWS scheme).
    const firstCall = mockSafeFetch.mock.calls[0];
    expect((firstCall[1] as any).headers.Authorization).toBe("SSWS SSWS_test");
  });

  // ---------------------------------------------------------------------------
  // Okta PASS case: everyone has a strong factor, single non-admin -> no posture findings.
  // ---------------------------------------------------------------------------
  it("Okta PASS: all active users enrolled with strong MFA and no admin sprawl yields no findings", async () => {
    const base = "https://clean.okta.com";
    const users = [
      { id: "u-ok", status: "ACTIVE", profile: { login: "alice@clean.com" }, lastLogin: new Date(NOW - DAY).toISOString() },
    ];
    wireRoutes([
      [`${base}/api/v1/users?limit=200`, makeResponse(users)],
      // Strong (TOTP) active factor -> enrolled and not weak-only.
      [`/api/v1/users/u-ok/factors`, makeResponse([{ status: "ACTIVE", factorType: "token:software:totp" }])],
      [`/api/v1/users/u-ok/roles`, makeResponse([])],
    ]);

    const findings = await runAgent(JSON.stringify({ provider: "okta", apiUrl: base, apiKey: "SSWS_test" }));

    expect(findings).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Google FAIL case: a stale account (no login in 90+ days) computed from lastLoginTime.
  // ---------------------------------------------------------------------------
  it("Google FAIL: flags a stale account from real lastLoginTime", async () => {
    const base = "https://admin.googleapis.com";
    const usersBody = {
      users: [
        // Enrolled in 2SV, but last login 200 days ago -> stale.
        { id: "g-stale", primaryEmail: "old@corp.com", isEnrolledIn2Sv: true, lastLoginTime: new Date(NOW - 200 * DAY).toISOString() },
        // Active recent user, enrolled -> healthy.
        { id: "g-ok", primaryEmail: "new@corp.com", isEnrolledIn2Sv: true, lastLoginTime: new Date(NOW - DAY).toISOString() },
      ],
    };
    wireRoutes([[`${base}/admin/directory/v1/users`, makeResponse(usersBody)]]);

    const findings = await runAgent(
      JSON.stringify({ provider: "google_workspace", apiUrl: base, apiKey: "ya29_test", domain: "corp.com" }),
    );

    const stale = findings.find((f) => f.title.includes("Stale accounts"));
    expect(stale).toBeDefined();
    expect(stale!.severity).toBe("medium");
    expect(stale!.resourceId).toBe("google_workspace/stale-accounts");
    expect(stale!.description).toContain("old@corp.com");
    // The recent user must NOT appear in the stale evidence sample.
    expect(stale!.description).not.toContain("new@corp.com");
    // Everyone is enrolled, so no incomplete-enrollment finding.
    expect(findings.some((f) => f.title.includes("Incomplete MFA enrollment"))).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Reachable-but-unauthorized directory -> not-assessed (no fabricated numbers).
  // ---------------------------------------------------------------------------
  it("not-assessed: an unauthorized directory API (401 on first page) yields not-assessed, not fabricated posture", async () => {
    const base = "https://acme.okta.com";
    wireRoutes([[`${base}/api/v1/users?limit=200`, makeResponse({ error: "unauthorized" }, { ok: false, status: 401 })]]);

    const findings = await runAgent(JSON.stringify({ provider: "okta", apiUrl: base, apiKey: "bad_token" }));

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("info");
    expect(findings[0].resourceId).toBe("okta/not-assessed");
    expect(findings.some((f) => f.title.includes("enrollment"))).toBe(false);
  });
});
