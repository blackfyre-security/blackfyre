// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real code-repo
// (VCS) auditor. The "SDK" here is the SSRF-hardened fetch wrapper (safeFetch),
// which is mocked so the GitHub/GitLab REST calls return crafted API responses;
// the auditor must then derive findings (and non-findings) from the REAL
// response properties: default_branch protection, required_approving_review_count,
// security_and_analysis.secret_scanning.status (GitHub), and
// protected_branches / approvals / security_settings (GitLab). Also covers the
// honest "not-assessed" path when no integration is configured.
import { describe, it, expect, vi, beforeEach } from "vitest";

// safeFetch is mocked via vi.hoisted so the fn exists before the hoisted vi.mock
// factory runs (vitest lifts vi.mock above top-level declarations). We re-export
// the real SsrfBlockedError so the auditor's `instanceof` check still works.
const { mockSafeFetch } = vi.hoisted(() => ({ mockSafeFetch: vi.fn() }));
vi.mock("../../src/lib/safe-fetch.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/safe-fetch.js")>(
    "../../src/lib/safe-fetch.js",
  );
  return { ...actual, safeFetch: mockSafeFetch };
});

// Return a non-empty mapping for any check so controlMappings is exercised.
vi.mock("../../src/services/compliance-mapper.js", () => ({
  mapCheckToControls: vi.fn().mockImplementation(() => [
    { framework: "soc2", controlId: "CC8.1", controlName: "Change Management", status: "fail", weight: 3 },
  ]),
}));

import {
  auditVcs,
  parseVcsConfig,
  checkBranchProtection,
  checkRequiredReviews,
  checkSecretScanning,
  type VcsConfig,
  type RepoSummary,
} from "../../src/agents/code-repo-auditor.js";

/** Builds a mock Response-like object with a JSON body and status. */
function jsonResponse(status: number, body: unknown): { status: number; json: () => Promise<unknown> } {
  return { status, json: async () => body };
}

/**
 * Routes mocked safeFetch calls by URL substring so each endpoint returns its
 * crafted response. The MOST SPECIFIC (longest) matching substring wins, so
 * e.g. "/repos/acme/app/branches/main/protection" is not swallowed by a
 * "/repos/acme/app" route. Anything unmatched returns a 404 (the "absent" state).
 */
function routeByUrl(routes: Array<{ match: string; status: number; body: unknown }>): void {
  const ordered = [...routes].sort((a, b) => b.match.length - a.match.length);
  mockSafeFetch.mockImplementation(async (url: string) => {
    for (const r of ordered) {
      if (url.includes(r.match)) return jsonResponse(r.status, r.body);
    }
    return jsonResponse(404, { message: "not found" });
  });
}

const REPO: RepoSummary = {
  id: "acme/app",
  name: "app",
  defaultBranch: "main",
  url: "https://github.com/acme/app",
  owner: "acme",
  shortName: "app",
};

describe("code-repo-auditor finding builders (real property -> finding)", () => {
  it("PASS-case: protected branch + 2 required reviews + secret scanning => no findings", () => {
    expect(checkBranchProtection(REPO, true)).toHaveLength(0);
    expect(checkRequiredReviews(REPO, 2)).toHaveLength(0);
    expect(checkSecretScanning(REPO, true)).toHaveLength(0);
  });

  it("FAIL-case: unprotected branch + 0 reviews + no secret scanning => real findings", () => {
    const bp = checkBranchProtection(REPO, false);
    expect(bp).toHaveLength(1);
    expect(bp[0].severity).toBe("high");
    expect(bp[0].resourceId).toBe("acme/app@main");
    expect(bp[0].resourceRegion).toBe("global");
    expect(bp[0].controlMappings!.length).toBeGreaterThan(0);

    const rev = checkRequiredReviews(REPO, 0);
    expect(rev).toHaveLength(1);
    expect(rev[0].severity).toBe("high");
    expect(rev[0].resourceId).toBe("acme/app@main");

    const ss = checkSecretScanning(REPO, false);
    expect(ss).toHaveLength(1);
    expect(ss[0].severity).toBe("critical");
    expect(ss[0].category).toBe("encryption");
    expect(ss[0].resourceId).toBe("acme/app");
  });
});

describe("auditVcs — GitHub (mocked safeFetch)", () => {
  beforeEach(() => vi.clearAllMocks());

  const baseConfig: VcsConfig = {
    provider: "github",
    apiUrl: "https://api.github.com",
    token: "ghp_test",
    owner: "acme",
    repo: "app",
  };

  it("PASS-case: protected default branch, reviews required, secret scanning on => no security findings", async () => {
    routeByUrl([
      {
        match: "/repos/acme/app",
        status: 200,
        body: {
          full_name: "acme/app",
          name: "app",
          default_branch: "main",
          html_url: "https://github.com/acme/app",
          owner: { login: "acme" },
          private: true,
          security_and_analysis: { secret_scanning: { status: "enabled" } },
        },
      },
      {
        match: "/branches/main/protection",
        status: 200,
        body: { required_pull_request_reviews: { required_approving_review_count: 2 } },
      },
    ]);

    const findings = await auditVcs(baseConfig);
    expect(findings).toHaveLength(0);
  });

  it("FAIL-case: unprotected default branch + secret scanning disabled => real findings from real properties", async () => {
    routeByUrl([
      {
        match: "/repos/acme/app",
        status: 200,
        body: {
          full_name: "acme/app",
          name: "app",
          default_branch: "main",
          owner: { login: "acme" },
          private: true,
          security_and_analysis: { secret_scanning: { status: "disabled" } },
        },
      },
      // Explicit 404 on the protection endpoint => branch is NOT protected.
      { match: "/branches/main/protection", status: 404, body: { message: "Branch not protected" } },
    ]);

    const findings = await auditVcs(baseConfig);

    const bp = findings.find((f) => f.title.includes("is not protected"));
    expect(bp).toBeDefined();
    expect(bp!.severity).toBe("high");
    expect(bp!.resourceId).toBe("acme/app@main");

    const ss = findings.find((f) => f.title.includes("secret scanning"));
    expect(ss).toBeDefined();
    expect(ss!.severity).toBe("critical");
    expect(ss!.resourceId).toBe("acme/app");

    // Branch is unprotected, so required-reviews check is not separately emitted.
    expect(findings.find((f) => f.title.includes("pull-request reviews"))).toBeUndefined();
    expect(findings).toHaveLength(2);
  });

  it("emits a required-reviews finding when protection exists but 0 approvals are required", async () => {
    routeByUrl([
      {
        match: "/repos/acme/app",
        status: 200,
        body: {
          full_name: "acme/app",
          name: "app",
          default_branch: "main",
          owner: { login: "acme" },
          security_and_analysis: { secret_scanning: { status: "enabled" } },
        },
      },
      {
        match: "/branches/main/protection",
        status: 200,
        body: { required_pull_request_reviews: { required_approving_review_count: 0 } },
      },
    ]);

    const findings = await auditVcs(baseConfig);
    const rev = findings.find((f) => f.title.includes("pull-request reviews"));
    expect(rev).toBeDefined();
    expect(rev!.severity).toBe("high");
    // Protected branch => no branch-protection finding.
    expect(findings.find((f) => f.title.includes("is not protected"))).toBeUndefined();
  });
});

describe("auditVcs — GitLab (mocked safeFetch)", () => {
  beforeEach(() => vi.clearAllMocks());

  const baseConfig: VcsConfig = {
    provider: "gitlab",
    apiUrl: "https://gitlab.com/api/v4",
    token: "glpat_test",
    repo: "42",
  };

  it("PASS-case: protected branch + approvals required + secret push protection => no findings", async () => {
    routeByUrl([
      {
        match: "/projects/42/protected_branches/main",
        status: 200,
        body: { name: "main", push_access_levels: [{ access_level: 40 }] },
      },
      { match: "/projects/42/approvals", status: 200, body: { approvals_before_merge: 2 } },
      { match: "/projects/42/security_settings", status: 200, body: { secret_push_protection_enabled: true } },
      // Project lookup is matched last (broadest substring) — keep it after the more specific routes.
      {
        match: "/projects/42",
        status: 200,
        body: { id: 42, name: "app", path_with_namespace: "acme/app", default_branch: "main", web_url: "https://gitlab.com/acme/app" },
      },
    ]);

    const findings = await auditVcs(baseConfig);
    expect(findings).toHaveLength(0);
  });

  it("FAIL-case: unprotected branch + secret push protection off => real findings", async () => {
    routeByUrl([
      { match: "/projects/42/security_settings", status: 200, body: { secret_push_protection_enabled: false } },
      // Explicit 404 on the protected-branches endpoint => branch is NOT protected.
      { match: "/projects/42/protected_branches/main", status: 404, body: { message: "404 Not found" } },
      {
        match: "/projects/42",
        status: 200,
        body: { id: 42, name: "app", path_with_namespace: "acme/app", default_branch: "main" },
      },
    ]);

    const findings = await auditVcs(baseConfig);

    const bp = findings.find((f) => f.title.includes("is not protected"));
    expect(bp).toBeDefined();
    expect(bp!.severity).toBe("high");
    expect(bp!.resourceId).toBe("acme/app@main");

    const ss = findings.find((f) => f.title.includes("secret scanning"));
    expect(ss).toBeDefined();
    expect(ss!.severity).toBe("critical");
    expect(ss!.resourceId).toBe("acme/app");
    expect(findings).toHaveLength(2);
  });
});

describe("not-assessed / config parsing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for non-JSON / non-VCS credentialRef", () => {
    expect(parseVcsConfig("arn:aws:iam::123:role/x")).toBeNull();
    expect(parseVcsConfig(JSON.stringify({ provider: "bitbucket" }))).toBeNull();
  });

  it("emits a single informational not-assessed finding when no token is configured", async () => {
    const cfg = parseVcsConfig(JSON.stringify({ provider: "github" }));
    expect(cfg).not.toBeNull();
    const findings = await auditVcs(cfg!);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("info");
    expect(findings[0].title).toContain("not assessed");
    // No network call should have been made.
    expect(mockSafeFetch).not.toHaveBeenCalled();
  });
});
