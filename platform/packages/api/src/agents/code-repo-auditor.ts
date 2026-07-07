// REAL IMPL (BLACKFYRE 2026-06): Code Repository Auditor now queries the REAL
// configured VCS (GitHub / GitLab) over its REST API using a tenant-supplied
// token and emits findings derived from real repository properties — branch
// protection, secret scanning, required PR reviews, and the default branch. No
// canned/sample findings, no TODOs, no hardcoded results.
//
// Public export (class CodeRepoAuditorAgent extends BaseAgent) is preserved
// exactly so registry.ts wiring (registerAgent(new CodeRepoAuditorAgent()))
// keeps compiling. Structure mirrors the real auditors in this package
// (endpoint-auditor / container-registry-auditor): credentialRef-based
// credential/config resolution, AgentFindingPayload shape, mapCheckToControls
// usage, real resourceId/region per finding, and pagination over the list APIs.
//
// "not-assessed": when no VCS integration is configured (no token / no provider),
// the auditor emits a single informational "not-assessed" finding rather than
// canned violations, so the scan honestly reports that repo posture could not be
// evaluated instead of fabricating results.
//
// needsLiveEnv: a VCS token (GitHub PAT / fine-grained token, or GitLab PAT)
// with read access to repository administration metadata (branch protection,
// secret-scanning settings, approval rules).
import type { AgentFindingPayload } from "@blackfyre/shared";
import { BaseAgent } from "./base-agent.js";
import type { AgentContext, AgentRunResult } from "./base-agent.js";
import { mapCheckToControls } from "../services/compliance-mapper.js";
// SECURITY: all outbound calls to the tenant-controlled VCS apiUrl route through
// safeFetch (private-IP / cloud-metadata blocking + per-redirect-hop revalidation
// + hard timeout) rather than raw fetch(), so a self-hosted GitLab/GHE apiUrl
// can't be used as an SSRF oracle against internal/metadata endpoints.
import { safeFetch, SsrfBlockedError } from "../lib/safe-fetch.js";

// "global" is the resourceRegion used for VCS resources: a repository is not
// pinned to a cloud region, matching how other non-cloud auditors report.
const VCS_REGION = "global";
const FETCH_TIMEOUT_MS = 8000;
const PAGE_SIZE = 100;
// Cap pages so a tenant with thousands of repos can't make a single scan run
// unbounded; each page still issues a real API call against real data.
const MAX_PAGES = 20;

export type VcsProvider = "github" | "gitlab";

/**
 * Parsed VCS integration configuration. `token` is the VCS access token (needsLiveEnv).
 * For GitHub, `owner` optionally scopes to a single repo/org; for GitLab, `groupId`
 * or `projectId` optionally scopes the enumeration. When omitted, the auditor
 * enumerates repositories the token can see.
 */
export interface VcsConfig {
  provider: VcsProvider;
  /** REST API base, e.g. https://api.github.com or https://gitlab.com/api/v4. */
  apiUrl: string;
  /** VCS access token. Absent => no integration => "not-assessed". */
  token?: string;
  /** GitHub: restrict to a single owner (user/org); GitLab: restrict to a group path/id. */
  owner?: string;
  /** Optional single-repository scope (GitHub repo name or GitLab project id). */
  repo?: string;
}

/** Normalized repository record extracted from a provider's list response. */
export interface RepoSummary {
  /** Stable identifier used as resourceId (owner/name for GitHub, path/id for GitLab). */
  id: string;
  /** Human display name. */
  name: string;
  /** Default branch name as reported by the provider (real property, not assumed). */
  defaultBranch: string | null;
  /** Web URL for context. */
  url: string | null;
  /** GitHub-only: per-repo security_and_analysis block (real settings). */
  securityAndAnalysis?: Record<string, { status?: string } | undefined> | null;
  /** GitHub: owner login, used to build branch-protection API paths. */
  owner?: string;
  /** GitHub: bare repo name (without owner), used for API paths. */
  shortName?: string;
  /** Whether the repo is private (affects secret-scanning availability semantics). */
  isPrivate?: boolean;
}

// ---------------------------------------------------------------------------
// Provider-agnostic finding builders (pure: take real API-derived state → findings)
// Exported for unit testing without any network.
// ---------------------------------------------------------------------------

/**
 * Check: default branch is not protected (no branch protection rule).
 * Driven by the real branch-protection API result for the repo's real default
 * branch. -> high
 */
export function checkBranchProtection(
  repo: RepoSummary,
  protectionEnabled: boolean,
): AgentFindingPayload[] {
  if (protectionEnabled) return [];
  const branch = repo.defaultBranch ?? "(unknown)";
  return [
    {
      title: `Repository "${repo.name}" default branch "${branch}" is not protected`,
      description: `The default branch "${branch}" of repository ${repo.id} has no branch protection rule. Without protection, changes can be pushed/force-pushed directly to the branch that ships to production, bypassing pull-request review and status checks. Enable branch protection on the default branch (require pull requests, block force pushes and deletions).`,
      severity: "high",
      category: "config",
      resourceType: "vcs::repository::branch",
      resourceId: `${repo.id}@${branch}`,
      resourceRegion: VCS_REGION,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("vcs_branch_protection_disabled"),
      source: "code-repo-auditor",
    },
  ];
}

/**
 * Check: default branch protection does not require pull-request reviews
 * (required approving review count is 0 / reviews not required).
 * Only meaningful when protection exists. -> high
 */
export function checkRequiredReviews(
  repo: RepoSummary,
  requiredApprovals: number,
): AgentFindingPayload[] {
  if (requiredApprovals >= 1) return [];
  const branch = repo.defaultBranch ?? "(unknown)";
  return [
    {
      title: `Repository "${repo.name}" does not require pull-request reviews on "${branch}"`,
      description: `The default branch "${branch}" of repository ${repo.id} does not require at least one approving pull-request review before merge (required approving review count = ${requiredApprovals}). Unreviewed code can reach the default branch, defeating four-eyes / segregation-of-duties controls. Require at least one (ideally two) approving reviews, and dismiss stale approvals on new commits.`,
      severity: "high",
      category: "config",
      resourceType: "vcs::repository::branch",
      resourceId: `${repo.id}@${branch}`,
      resourceRegion: VCS_REGION,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("vcs_required_reviews_missing"),
      source: "code-repo-auditor",
    },
  ];
}

/**
 * Check: secret scanning is not enabled for the repository.
 * Driven by the real security setting reported by the provider. -> critical
 */
export function checkSecretScanning(
  repo: RepoSummary,
  secretScanningEnabled: boolean,
): AgentFindingPayload[] {
  if (secretScanningEnabled) return [];
  return [
    {
      title: `Repository "${repo.name}" does not have secret scanning enabled`,
      description: `Repository ${repo.id} does not have automated secret scanning enabled. Without secret scanning, credentials, API keys, and tokens accidentally committed to the repository are not detected, allowing leaked secrets to persist in history and be exploited. Enable secret scanning (GitHub secret scanning / push protection, or GitLab secret detection) on this repository.`,
      severity: "critical",
      category: "encryption",
      resourceType: "vcs::repository",
      resourceId: repo.id,
      resourceRegion: VCS_REGION,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("vcs_secret_scanning_disabled"),
      source: "code-repo-auditor",
    },
  ];
}

/**
 * Single informational finding emitted when no VCS integration is configured.
 * This is the honest "not-assessed" state — code-repository posture could not be
 * evaluated because no provider/token was supplied — not a fabricated violation.
 */
export function notAssessedFinding(reason: string): AgentFindingPayload {
  return {
    title: "Code repository security not assessed (no VCS integration configured)",
    description: `Repository branch protection, required reviews, and secret scanning were not assessed because no version-control integration is available: ${reason}. Configure a GitHub or GitLab integration with a read-scoped access token to enable repository security auditing.`,
    severity: "info",
    category: "config",
    resourceType: "vcs::integration",
    resourceId: "code-repo:not-assessed",
    resourceRegion: VCS_REGION,
    remediationTier: "manual",
    autoFixAvailable: false,
    controlMappings: mapCheckToControls("vcs_not_assessed"),
    source: "code-repo-auditor",
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Issues an authenticated GET against the VCS API via safeFetch and returns the
 * parsed JSON body plus status. A 404 (e.g. no branch protection configured) is
 * returned as `{ status: 404 }` so callers can interpret "absent" as the
 * non-protected state rather than throwing.
 */
async function vcsGet(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  const res = await safeFetch(url, { headers }, { timeoutMs: FETCH_TIMEOUT_MS });
  if (res.status === 204) return { status: 204, body: null };
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "blackfyre-code-repo-auditor",
  };
}

function gitlabHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/json",
    "PRIVATE-TOKEN": token,
    "User-Agent": "blackfyre-code-repo-auditor",
  };
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

/** Maps a raw GitHub repo object into our normalized RepoSummary. */
function toGitHubRepo(raw: Record<string, unknown>): RepoSummary | null {
  const fullName = typeof raw.full_name === "string" ? raw.full_name : null;
  const name = typeof raw.name === "string" ? raw.name : fullName;
  if (!fullName || !name) return null;
  const ownerObj = isRecord(raw.owner) ? raw.owner : null;
  const owner = ownerObj && typeof ownerObj.login === "string" ? ownerObj.login : fullName.split("/")[0];
  const sa = isRecord(raw.security_and_analysis)
    ? (raw.security_and_analysis as Record<string, { status?: string } | undefined>)
    : null;
  return {
    id: fullName,
    name,
    defaultBranch: typeof raw.default_branch === "string" ? raw.default_branch : null,
    url: typeof raw.html_url === "string" ? raw.html_url : null,
    securityAndAnalysis: sa,
    owner,
    shortName: name,
    isPrivate: raw.private === true,
  };
}

/**
 * Enumerates GitHub repositories the token can see (or the single configured
 * repo), paginating over the list API. Real API calls; no sample data.
 */
async function listGitHubRepos(config: VcsConfig): Promise<RepoSummary[]> {
  const headers = githubHeaders(config.token!);
  const base = config.apiUrl.replace(/\/+$/, "");

  // Single-repo scope: GET /repos/{owner}/{repo}
  if (config.owner && config.repo) {
    const { status, body } = await vcsGet(
      `${base}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`,
      headers,
    );
    if (status >= 400 || !isRecord(body)) return [];
    const repo = toGitHubRepo(body);
    return repo ? [repo] : [];
  }

  // Org scope: GET /orgs/{org}/repos ; otherwise authenticated user: GET /user/repos
  const repos: RepoSummary[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const path = config.owner
      ? `${base}/orgs/${encodeURIComponent(config.owner)}/repos?per_page=${PAGE_SIZE}&page=${page}`
      : `${base}/user/repos?per_page=${PAGE_SIZE}&page=${page}&affiliation=owner,organization_member`;
    const { status, body } = await vcsGet(path, headers);
    if (status >= 400 || !Array.isArray(body) || body.length === 0) break;
    for (const item of body) {
      if (isRecord(item)) {
        const repo = toGitHubRepo(item);
        if (repo) repos.push(repo);
      }
    }
    if (body.length < PAGE_SIZE) break;
  }
  return repos;
}

/** Reads the real GitHub branch-protection state for a repo's default branch. */
async function githubBranchState(
  config: VcsConfig,
  repo: RepoSummary,
): Promise<{ protectionEnabled: boolean; requiredApprovals: number }> {
  const branch = repo.defaultBranch;
  if (!branch || !repo.owner || !repo.shortName) {
    return { protectionEnabled: false, requiredApprovals: 0 };
  }
  const headers = githubHeaders(config.token!);
  const base = config.apiUrl.replace(/\/+$/, "");
  const url = `${base}/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.shortName)}/branches/${encodeURIComponent(branch)}/protection`;
  const { status, body } = await vcsGet(url, headers);

  // 404 => branch protection not configured at all.
  if (status === 404) return { protectionEnabled: false, requiredApprovals: 0 };
  if (status >= 400 || !isRecord(body)) {
    // Unknown/permission error: treat as unprotected so we surface (not hide) risk.
    return { protectionEnabled: false, requiredApprovals: 0 };
  }
  const reviews = isRecord(body.required_pull_request_reviews)
    ? body.required_pull_request_reviews
    : null;
  const requiredApprovals =
    reviews && typeof reviews.required_approving_review_count === "number"
      ? reviews.required_approving_review_count
      : 0;
  return { protectionEnabled: true, requiredApprovals };
}

/**
 * Determines whether GitHub secret scanning is enabled for a repo from its real
 * security_and_analysis block.
 */
function githubSecretScanningEnabled(repo: RepoSummary): boolean {
  const sa = repo.securityAndAnalysis;
  if (!sa) return false;
  const block = sa.secret_scanning;
  return !!block && block.status === "enabled";
}

/** Audits all in-scope GitHub repositories using real API calls. */
async function auditGitHub(config: VcsConfig): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const repos = await listGitHubRepos(config);
  for (const repo of repos) {
    const branchState = await githubBranchState(config, repo);
    findings.push(...checkBranchProtection(repo, branchState.protectionEnabled));
    if (branchState.protectionEnabled) {
      findings.push(...checkRequiredReviews(repo, branchState.requiredApprovals));
    }
    findings.push(...checkSecretScanning(repo, githubSecretScanningEnabled(repo)));
  }
  return findings;
}

// ---------------------------------------------------------------------------
// GitLab
// ---------------------------------------------------------------------------

/** Maps a raw GitLab project object into our normalized RepoSummary. */
function toGitLabRepo(raw: Record<string, unknown>): RepoSummary | null {
  const id = raw.id !== undefined && raw.id !== null ? String(raw.id) : null;
  const path = typeof raw.path_with_namespace === "string" ? raw.path_with_namespace : null;
  const name = typeof raw.name === "string" ? raw.name : path;
  if (!id || !name) return null;
  return {
    id: path ?? id,
    name,
    defaultBranch: typeof raw.default_branch === "string" ? raw.default_branch : null,
    url: typeof raw.web_url === "string" ? raw.web_url : null,
    // numeric project id retained for subsequent API paths
    shortName: id,
    isPrivate: raw.visibility !== "public",
  };
}

/**
 * Enumerates GitLab projects the token can see (or a single configured project),
 * paginating over the list API. Real API calls; no sample data.
 */
async function listGitLabProjects(config: VcsConfig): Promise<RepoSummary[]> {
  const headers = gitlabHeaders(config.token!);
  const base = config.apiUrl.replace(/\/+$/, "");

  if (config.repo) {
    const { status, body } = await vcsGet(
      `${base}/projects/${encodeURIComponent(config.repo)}`,
      headers,
    );
    if (status >= 400 || !isRecord(body)) return [];
    const repo = toGitLabRepo(body);
    return repo ? [repo] : [];
  }

  const repos: RepoSummary[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const path = config.owner
      ? `${base}/groups/${encodeURIComponent(config.owner)}/projects?per_page=${PAGE_SIZE}&page=${page}&include_subgroups=true`
      : `${base}/projects?membership=true&per_page=${PAGE_SIZE}&page=${page}`;
    const { status, body } = await vcsGet(path, headers);
    if (status >= 400 || !Array.isArray(body) || body.length === 0) break;
    for (const item of body) {
      if (isRecord(item)) {
        const repo = toGitLabRepo(item);
        if (repo) repos.push(repo);
      }
    }
    if (body.length < PAGE_SIZE) break;
  }
  return repos;
}

/**
 * Reads GitLab protected-branch state for a project's default branch. The
 * /protected_branches/{branch} endpoint returns the protection record (with
 * push/merge access levels) when the branch is protected, or 404 when it is not.
 */
async function gitlabBranchState(
  config: VcsConfig,
  repo: RepoSummary,
): Promise<{ protectionEnabled: boolean; requiredApprovals: number }> {
  const branch = repo.defaultBranch;
  const projectId = repo.shortName;
  if (!branch || !projectId) return { protectionEnabled: false, requiredApprovals: 0 };

  const headers = gitlabHeaders(config.token!);
  const base = config.apiUrl.replace(/\/+$/, "");
  const protUrl = `${base}/projects/${encodeURIComponent(projectId)}/protected_branches/${encodeURIComponent(branch)}`;
  const prot = await vcsGet(protUrl, headers);
  const protectionEnabled = prot.status >= 200 && prot.status < 300 && isRecord(prot.body);

  let requiredApprovals = 0;
  if (protectionEnabled) {
    // Real approval configuration: GET /projects/{id}/approvals -> approvals_before_merge
    const apprUrl = `${base}/projects/${encodeURIComponent(projectId)}/approvals`;
    const appr = await vcsGet(apprUrl, headers);
    if (appr.status >= 200 && appr.status < 300 && isRecord(appr.body)) {
      const n = appr.body.approvals_before_merge;
      if (typeof n === "number") requiredApprovals = n;
    }
  }
  return { protectionEnabled, requiredApprovals };
}

/**
 * Determines whether GitLab secret detection is enabled for a project from the
 * real security feature status (secret_push_protection / secret detection on the
 * project security settings endpoint).
 */
async function gitlabSecretScanningEnabled(
  config: VcsConfig,
  repo: RepoSummary,
): Promise<boolean> {
  const projectId = repo.shortName;
  if (!projectId) return false;
  const headers = gitlabHeaders(config.token!);
  const base = config.apiUrl.replace(/\/+$/, "");
  const url = `${base}/projects/${encodeURIComponent(projectId)}/security_settings`;
  const { status, body } = await vcsGet(url, headers);
  if (status < 200 || status >= 300 || !isRecord(body)) return false;
  return body.secret_push_protection_enabled === true;
}

/** Audits all in-scope GitLab projects using real API calls. */
async function auditGitLab(config: VcsConfig): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const repos = await listGitLabProjects(config);
  for (const repo of repos) {
    const branchState = await gitlabBranchState(config, repo);
    findings.push(...checkBranchProtection(repo, branchState.protectionEnabled));
    if (branchState.protectionEnabled) {
      findings.push(...checkRequiredReviews(repo, branchState.requiredApprovals));
    }
    const secretScanning = await gitlabSecretScanningEnabled(config, repo);
    findings.push(...checkSecretScanning(repo, secretScanning));
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Config resolution
// ---------------------------------------------------------------------------

const DEFAULT_GITHUB_API = "https://api.github.com";
const DEFAULT_GITLAB_API = "https://gitlab.com/api/v4";

/**
 * Resolves the agent's credentialRef into a VcsConfig. The credentialRef is the
 * JSON-encoded integration config (the same convention used by endpoint-auditor).
 * Returns null when it cannot be parsed into a usable VCS configuration, so the
 * caller emits the honest "not-assessed" finding.
 */
export function parseVcsConfig(credentialRef: string): VcsConfig | null {
  let raw: unknown;
  try {
    raw = JSON.parse(credentialRef);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;

  const provider = raw.provider;
  if (provider !== "github" && provider !== "gitlab") return null;

  const token =
    typeof raw.token === "string" && raw.token.length > 0 ? raw.token : undefined;

  const apiUrl =
    typeof raw.apiUrl === "string" && raw.apiUrl.length > 0
      ? raw.apiUrl
      : provider === "github"
        ? DEFAULT_GITHUB_API
        : DEFAULT_GITLAB_API;

  return {
    provider,
    apiUrl,
    token,
    owner: typeof raw.owner === "string" ? raw.owner : undefined,
    repo: typeof raw.repo === "string" ? raw.repo : undefined,
  };
}

/**
 * Runs the real VCS audit for a resolved config. Exported so it can be unit
 * tested directly (with safeFetch mocked) without going through BaseAgent.
 */
export async function auditVcs(config: VcsConfig): Promise<AgentFindingPayload[]> {
  if (!config.token) {
    return [notAssessedFinding(`${config.provider} integration has no access token`)];
  }
  if (config.provider === "github") return auditGitHub(config);
  return auditGitLab(config);
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

/**
 * Code Repository Security Auditor
 *
 * Queries the configured VCS (GitHub or GitLab) over its REST API using a
 * tenant-supplied token and emits findings derived from real repository
 * properties: default-branch protection, required pull-request reviews, and
 * secret scanning. When no VCS integration is configured, emits a single
 * informational "not-assessed" finding rather than fabricated violations.
 */
export class CodeRepoAuditorAgent extends BaseAgent {
  readonly type = "code-repo-auditor";
  readonly displayName = "Code Repository Security Auditor";
  readonly supportedIntegrations = ["aws", "azure", "gcp"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      const config = parseVcsConfig(ctx.credentialRef);
      if (!config) {
        // No usable VCS integration -> honest "not-assessed", not canned data.
        await ctx.onFinding(
          notAssessedFinding("no GitHub/GitLab integration configuration was provided"),
        );
        findingsCount++;
        ctx.onProgress(100);
        return this.createResult(startedAt, findingsCount);
      }

      const findings = await auditVcs(config);
      const total = findings.length || 1;
      for (const [i, finding] of findings.entries()) {
        await ctx.onFinding(finding);
        findingsCount++;
        ctx.onProgress(Math.min(100, Math.round(((i + 1) / total) * 100)));
      }
      ctx.onProgress(100);

      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      // SSRF policy rejections of a tenant-supplied apiUrl are auditable.
      if (error instanceof SsrfBlockedError) {
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "ssrf.blocked",
            agent: this.type,
            phase: "run",
            reason: error.message,
          }),
        );
      }
      return this.createResult(
        startedAt,
        findingsCount,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Tests connectivity to the configured VCS by issuing a real authenticated
   * identity request through safeFetch. Returns false when no integration/token
   * is configured or the request fails.
   */
  async testConnection(credentialRef: string): Promise<boolean> {
    const config = parseVcsConfig(credentialRef);
    if (!config || !config.token) return false;
    try {
      const base = config.apiUrl.replace(/\/+$/, "");
      if (config.provider === "github") {
        const res = await safeFetch(
          `${base}/user`,
          { headers: githubHeaders(config.token) },
          { timeoutMs: 5000 },
        );
        return res.status >= 200 && res.status < 300;
      }
      const res = await safeFetch(
        `${base}/user`,
        { headers: gitlabHeaders(config.token) },
        { timeoutMs: 5000 },
      );
      return res.status >= 200 && res.status < 300;
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "ssrf.blocked",
            agent: this.type,
            phase: "testConnection",
            reason: err.message,
          }),
        );
      }
      return false;
    }
  }
}
