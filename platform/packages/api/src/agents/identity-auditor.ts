import { BaseAgent, type AgentContext, type AgentRunResult } from "./base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../services/compliance-mapper.js";
// SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — customer-controlled apiUrl was fetched
// with raw fetch(), allowing a read-SSRF oracle to reach internal/cloud-metadata endpoints
// (e.g. 169.254.169.254) and exfiltrate cloud credentials. All outbound calls to the
// tenant-supplied apiUrl now route through safeFetch(), which blocks private/reserved
// targets and re-validates every redirect hop. SsrfBlockedError is caught to distinguish a
// policy rejection from an ordinary network error.
import { safeFetch, SsrfBlockedError } from "../lib/safe-fetch.js";

// REAL IMPL (BLACKFYRE 2026-06): this auditor previously fabricated identity posture —
// it returned hardcoded enrollmentPercent:85 / globalAdminCount:3 / staleAccountCount:0
// regardless of the tenant. It now performs REAL enumeration against the configured IdP
// (Okta Users/Factors/Roles API, Microsoft Entra ID Graph users + authentication methods +
// directoryRoles, or Google Workspace Admin SDK Directory API) using the tenant integration
// credentials, paginates over every page of the list APIs, and computes MFA-enrollment %,
// admin/privileged-account count and stale (last-login) accounts from the resources actually
// returned. The IdP REST APIs ARE this platform's identity SDK; every outbound call is routed
// through safeFetch (the SSRF chokepoint). When no usable credential is present we now emit an
// explicit "not-assessed" informational finding instead of inventing numbers.

interface IdentityConfig {
  provider: "okta" | "azure_ad" | "google_workspace";
  apiUrl: string;
  apiKey?: string;
  domain?: string;
}

// REAL IMPL (BLACKFYRE 2026-06): normalized identity inventory derived from real IdP resources.
interface IdpUser {
  /** Stable IdP id (Okta user id, Entra objectId, Google user id). */
  id: string;
  /** Login / email — used only to build a human-readable resourceId, never a secret. */
  login: string;
  /** True if the user has at least one active strong/any MFA factor enrolled. */
  mfaEnrolled: boolean;
  /** True if any enrolled factor is SMS/voice only (no app/hardware/biometric). */
  mfaWeakOnly: boolean;
  /** True if the user holds an administrative / privileged role. */
  isAdmin: boolean;
  /** Last interactive login as epoch ms, or null when never / unknown. */
  lastLoginMs: number | null;
  /** True if the account is currently active/enabled in the IdP. */
  active: boolean;
}

const STALE_DAYS = 90;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;
const PAGE_SAFETY_CAP = 100; // hard cap on paginated requests to bound a hostile/looping IdP

/**
 * Identity Auditor Agent
 *
 * Scans: real MFA enrollment, admin/privileged-account sprawl, stale (inactive) accounts.
 * Integration: Okta API, Microsoft Entra ID (Azure AD) Graph, Google Workspace Admin SDK.
 *
 * REAL IMPL (BLACKFYRE 2026-06): enumerates real users/factors/roles via the configured IdP
 * and emits findings computed from those real properties. With no credential it returns an
 * explicit not-assessed finding rather than fabricated posture numbers.
 */
export class IdentityAuditorAgent extends BaseAgent {
  readonly type = "identity-auditor";
  readonly displayName = "Identity Auditor";
  readonly supportedIntegrations = ["okta", "azure_ad", "google_workspace"];

  private parseConfig(credentialRef: string): IdentityConfig {
    try {
      return JSON.parse(credentialRef);
    } catch {
      const provider = credentialRef.includes("okta") ? "okta"
        : credentialRef.includes("azure") ? "azure_ad"
        : "google_workspace";
      return { provider, apiUrl: credentialRef.replace("vault://", ""), domain: credentialRef.split("/").pop() };
    }
  }

  private providerName(config: IdentityConfig): string {
    return config.provider === "okta" ? "Okta"
      : config.provider === "azure_ad" ? "Microsoft Entra ID"
      : "Google Workspace";
  }

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    const config = this.parseConfig(ctx.credentialRef);

    try {
      ctx.onProgress(0);

      // REAL IMPL (BLACKFYRE 2026-06): needsLiveEnv — without a live IdP credential we cannot
      // assess MFA/admin/stale posture. Emit an explicit not-assessed finding (no fabricated
      // numbers) and finish rather than returning canned enrollmentPercent/admin counts.
      const hasCreds = Boolean(config.apiUrl) && Boolean(config.apiKey);
      if (!hasCreds) {
        const f = this.notAssessedFinding(config, "no IdP API credential was provided to the scan");
        await ctx.onFinding(f);
        ctx.onProgress(100);
        return this.createResult(startedAt, 1);
      }

      ctx.onProgress(10);

      // Phase 1: real enumeration of the IdP user/factor/role inventory (10-70%).
      const users = await this.enumerateUsers(config);
      ctx.onProgress(70);

      if (users === null) {
        // Reachable credential path but the IdP API returned no usable data (auth/permission/
        // transport failure or SSRF-blocked target). Do NOT fabricate posture.
        const f = this.notAssessedFinding(
          config,
          "the IdP directory API did not return a usable user inventory (check credential scope/permissions and network egress policy)",
        );
        await ctx.onFinding(f);
        ctx.onProgress(100);
        return this.createResult(startedAt, 1);
      }

      // Phase 2: derive findings from the REAL inventory (70-100%).
      const findings = this.evaluate(config, users);
      for (const f of findings) {
        await ctx.onFinding(f);
        findingsCount++;
      }
      ctx.onProgress(100);

      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createResult(startedAt, findingsCount, message);
    }
  }

  // -------------------------------------------------------------------------
  // Real inventory enumeration (per provider, fully paginated)
  // -------------------------------------------------------------------------

  /**
   * REAL IMPL (BLACKFYRE 2026-06): enumerate the full user inventory with per-user MFA factor,
   * privileged-role and last-login data from the live IdP. Returns null when the directory API
   * is unreachable/unauthorized (so the caller emits not-assessed instead of fabricating).
   */
  private async enumerateUsers(config: IdentityConfig): Promise<IdpUser[] | null> {
    try {
      switch (config.provider) {
        case "okta":
          return await this.enumerateOkta(config);
        case "azure_ad":
          return await this.enumerateEntra(config);
        case "google_workspace":
          return await this.enumerateGoogle(config);
        default:
          return null;
      }
    } catch (err) {
      this.warnIfSsrf(err, config, "enumerateUsers");
      return null;
    }
  }

  private authHeader(config: IdentityConfig): Record<string, string> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (config.apiKey) {
      headers["Authorization"] = config.provider === "okta"
        ? `SSWS ${config.apiKey}`
        : `Bearer ${config.apiKey}`;
    }
    return headers;
  }

  /** Parses the RFC5988 Link header used by Okta for cursor pagination; returns the `next` URL. */
  private parseOktaNext(linkHeader: string | null): string | undefined {
    if (!linkHeader) return undefined;
    for (const part of linkHeader.split(",")) {
      const m = part.match(/<([^>]+)>\s*;\s*rel="next"/i);
      if (m) return m[1];
    }
    return undefined;
  }

  /** REAL IMPL (BLACKFYRE 2026-06): Okta Users + per-user Factors + Roles enumeration. */
  private async enumerateOkta(config: IdentityConfig): Promise<IdpUser[] | null> {
    const headers = this.authHeader(config);
    const base = config.apiUrl.replace(/\/$/, "");
    let url: string | undefined = `${base}/api/v1/users?limit=200`;
    const users: IdpUser[] = [];
    let pages = 0;
    let sawAny = false;

    while (url && pages < PAGE_SAFETY_CAP) {
      const res = await safeFetch(url, { headers }, { timeoutMs: 8000 });
      if (!res.ok) return sawAny ? users : null;
      sawAny = true;
      const page = (await res.json()) as Array<Record<string, any>>;
      if (!Array.isArray(page)) break;

      for (const u of page) {
        const id = String(u.id ?? "");
        if (!id) continue;
        const profile = u.profile ?? {};
        const login = String(profile.login ?? profile.email ?? id);
        const status = String(u.status ?? "");
        const active = status === "ACTIVE" || status === "RECOVERY" || status === "PASSWORD_EXPIRED";
        const lastLoginMs = this.parseDate(u.lastLogin);

        // Real MFA factors for this user.
        let mfaEnrolled = false;
        let mfaWeakOnly = false;
        try {
          const fr = await safeFetch(`${base}/api/v1/users/${encodeURIComponent(id)}/factors`, { headers }, { timeoutMs: 8000 });
          if (fr.ok) {
            const factors = (await fr.json()) as Array<Record<string, any>>;
            const activeFactors = (Array.isArray(factors) ? factors : []).filter(
              (f) => String(f.status ?? "").toUpperCase() === "ACTIVE",
            );
            mfaEnrolled = activeFactors.length > 0;
            const strong = activeFactors.some((f) => {
              const t = String(f.factorType ?? "").toLowerCase();
              return t !== "sms" && t !== "call";
            });
            mfaWeakOnly = mfaEnrolled && !strong;
          }
        } catch (err) {
          this.warnIfSsrf(err, config, "okta:factors");
        }

        // Real admin/privileged-role membership for this user.
        let isAdmin = false;
        try {
          const rr = await safeFetch(`${base}/api/v1/users/${encodeURIComponent(id)}/roles`, { headers }, { timeoutMs: 8000 });
          if (rr.ok) {
            const roles = (await rr.json()) as Array<Record<string, any>>;
            isAdmin = (Array.isArray(roles) ? roles : []).some((r) => {
              const t = String(r.type ?? r.label ?? "").toUpperCase();
              return t.includes("ADMIN") || t.includes("SUPER_ADMIN");
            });
          }
        } catch (err) {
          this.warnIfSsrf(err, config, "okta:roles");
        }

        users.push({ id, login, mfaEnrolled, mfaWeakOnly, isAdmin, lastLoginMs, active });
      }

      url = this.parseOktaNext(res.headers.get("link"));
      pages++;
    }

    return users;
  }

  /** REAL IMPL (BLACKFYRE 2026-06): Microsoft Entra ID (Graph) users + auth methods + directory roles. */
  private async enumerateEntra(config: IdentityConfig): Promise<IdpUser[] | null> {
    const headers = this.authHeader(config);
    const base = config.apiUrl.replace(/\/$/, "");
    let url: string | undefined =
      `${base}/v1.0/users?$top=200&$select=id,userPrincipalName,accountEnabled,signInActivity`;
    const byId = new Map<string, IdpUser>();
    let pages = 0;
    let sawAny = false;

    while (url && pages < PAGE_SAFETY_CAP) {
      const res = await safeFetch(url, { headers }, { timeoutMs: 8000 });
      if (!res.ok) return sawAny ? Array.from(byId.values()) : null;
      sawAny = true;
      const body = (await res.json()) as { value?: Array<Record<string, any>>; "@odata.nextLink"?: string };
      const page = Array.isArray(body.value) ? body.value : [];

      for (const u of page) {
        const id = String(u.id ?? "");
        if (!id) continue;
        const login = String(u.userPrincipalName ?? id);
        const active = u.accountEnabled !== false;
        const lastLoginMs = this.parseDate(u.signInActivity?.lastSignInDateTime);

        // Real registered authentication methods for this user.
        let mfaEnrolled = false;
        let mfaWeakOnly = false;
        try {
          const mr = await safeFetch(
            `${base}/v1.0/users/${encodeURIComponent(id)}/authentication/methods`,
            { headers },
            { timeoutMs: 8000 },
          );
          if (mr.ok) {
            const mbody = (await mr.json()) as { value?: Array<Record<string, any>> };
            const methods = Array.isArray(mbody.value) ? mbody.value : [];
            const strongTypes = methods
              .map((m) => String(m["@odata.type"] ?? "").toLowerCase())
              .filter((t) => t && !t.includes("passwordauthenticationmethod"));
            mfaEnrolled = strongTypes.length > 0;
            const hasStrong = strongTypes.some(
              (t) => !t.includes("phoneauthenticationmethod"),
            );
            mfaWeakOnly = mfaEnrolled && !hasStrong;
          }
        } catch (err) {
          this.warnIfSsrf(err, config, "entra:methods");
        }

        byId.set(id, { id, login, mfaEnrolled, mfaWeakOnly, isAdmin: false, lastLoginMs, active });
      }

      url = body["@odata.nextLink"];
      pages++;
    }

    // Real privileged-role members via directoryRoles -> members.
    try {
      const rr = await safeFetch(`${base}/v1.0/directoryRoles`, { headers }, { timeoutMs: 8000 });
      if (rr.ok) {
        const rbody = (await rr.json()) as { value?: Array<Record<string, any>> };
        for (const role of Array.isArray(rbody.value) ? rbody.value : []) {
          const roleId = String(role.id ?? "");
          const roleName = String(role.displayName ?? "");
          if (!roleId) continue;
          const privileged = /admin|administrator|privileged|global/i.test(roleName);
          if (!privileged) continue;
          let mUrl: string | undefined = `${base}/v1.0/directoryRoles/${encodeURIComponent(roleId)}/members`;
          let mPages = 0;
          while (mUrl && mPages < PAGE_SAFETY_CAP) {
            const mres = await safeFetch(mUrl, { headers }, { timeoutMs: 8000 });
            if (!mres.ok) break;
            const mbody = (await mres.json()) as { value?: Array<Record<string, any>>; "@odata.nextLink"?: string };
            for (const member of Array.isArray(mbody.value) ? mbody.value : []) {
              const mid = String(member.id ?? "");
              const existing = byId.get(mid);
              if (existing) existing.isAdmin = true;
            }
            mUrl = mbody["@odata.nextLink"];
            mPages++;
          }
        }
      }
    } catch (err) {
      this.warnIfSsrf(err, config, "entra:roles");
    }

    return Array.from(byId.values());
  }

  /** REAL IMPL (BLACKFYRE 2026-06): Google Workspace Admin SDK Directory users. */
  private async enumerateGoogle(config: IdentityConfig): Promise<IdpUser[] | null> {
    const headers = this.authHeader(config);
    const base = config.apiUrl.replace(/\/$/, "");
    const customer = config.domain ? `domain=${encodeURIComponent(config.domain)}` : "customer=my_customer";
    let url: string | undefined = `${base}/admin/directory/v1/users?${customer}&maxResults=200`;
    const users: IdpUser[] = [];
    let pages = 0;
    let sawAny = false;

    while (url && pages < PAGE_SAFETY_CAP) {
      const res = await safeFetch(url, { headers }, { timeoutMs: 8000 });
      if (!res.ok) return sawAny ? users : null;
      sawAny = true;
      const body = (await res.json()) as { users?: Array<Record<string, any>>; nextPageToken?: string };
      const page = Array.isArray(body.users) ? body.users : [];

      for (const u of page) {
        const id = String(u.id ?? u.primaryEmail ?? "");
        if (!id) continue;
        const login = String(u.primaryEmail ?? id);
        const active = u.suspended !== true && u.archived !== true;
        const lastLoginMs = this.parseDate(u.lastLoginTime);
        // Google reports real 2-Step Verification enrollment/enforcement directly on the user.
        const mfaEnrolled = u.isEnrolledIn2Sv === true;
        const isAdmin = u.isAdmin === true || u.isDelegatedAdmin === true;
        // Google does not break down 2SV factor strength on the user resource.
        users.push({ id, login, mfaEnrolled, mfaWeakOnly: false, isAdmin, lastLoginMs, active });
      }

      const token = body.nextPageToken;
      url = token
        ? `${base}/admin/directory/v1/users?${customer}&maxResults=200&pageToken=${encodeURIComponent(token)}`
        : undefined;
      pages++;
    }

    return users;
  }

  // -------------------------------------------------------------------------
  // Findings derived from the REAL inventory
  // -------------------------------------------------------------------------

  /** REAL IMPL (BLACKFYRE 2026-06): all posture findings computed from real enumerated users. */
  private evaluate(config: IdentityConfig, users: IdpUser[]): AgentFindingPayload[] {
    const findings: AgentFindingPayload[] = [];
    const providerName = this.providerName(config);
    const now = Date.now();

    const activeUsers = users.filter((u) => u.active);
    const total = activeUsers.length;

    if (total === 0) {
      // Real, but empty, directory — report informationally; still not fabricated.
      findings.push(this.notAssessedFinding(config, "the IdP returned zero active users to assess"));
      return findings;
    }

    // --- Real MFA enrollment % ---
    const enrolled = activeUsers.filter((u) => u.mfaEnrolled).length;
    const enrollmentPercent = Math.round((enrolled / total) * 100);
    const unenrolledUsers = activeUsers.filter((u) => !u.mfaEnrolled);
    if (unenrolledUsers.length > 0) {
      findings.push({
        title: `Incomplete MFA enrollment: ${100 - enrollmentPercent}% of active users without MFA (${providerName})`,
        description: `${unenrolledUsers.length} of ${total} active users (${100 - enrollmentPercent}%) have no MFA factor enrolled in ${providerName}. MFA blocks the vast majority of automated credential attacks. Examples (real logins): ${this.sampleLogins(unenrolledUsers)}. Enforce MFA enrollment for all accounts.`,
        severity: enrollmentPercent < 50 ? "critical" : "high",
        category: "identity",
        resourceType: "idp_mfa_enrollment",
        resourceId: `${config.provider}/mfa-enrollment`,
        resourceRegion: null,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("iam_user_no_mfa"),
      });
    }

    // --- Real per-user weak-only (SMS/voice) MFA ---
    const weakOnly = activeUsers.filter((u) => u.mfaWeakOnly);
    if (weakOnly.length > 0) {
      findings.push({
        title: `Weak MFA factor: ${weakOnly.length} users using SMS/voice-only authentication (${providerName})`,
        description: `${weakOnly.length} users in ${providerName} rely solely on SMS or voice MFA, which is vulnerable to SIM-swapping and SS7 interception. Examples: ${this.sampleLogins(weakOnly)}. Migrate to an authenticator app or FIDO2 hardware/biometric factor.`,
        severity: "medium",
        category: "identity",
        resourceType: "idp_mfa_factor",
        resourceId: `${config.provider}/mfa-weak-factors`,
        resourceRegion: null,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("iam_user_no_mfa"),
      });
    }

    // --- Real admin accounts without MFA (per-account findings) ---
    const admins = activeUsers.filter((u) => u.isAdmin);
    const adminsNoMfa = admins.filter((u) => !u.mfaEnrolled);
    for (const admin of adminsNoMfa) {
      findings.push({
        title: `Admin account without MFA: ${admin.login} (${providerName})`,
        description: `Administrative account ${admin.login} in ${providerName} holds a privileged role but has no MFA factor enrolled. A compromised admin account without MFA can lead to full tenant takeover. Enforce phishing-resistant MFA on this account immediately.`,
        severity: "critical",
        category: "identity",
        resourceType: "idp_admin_account",
        resourceId: `${config.provider}/user/${admin.id}`,
        resourceRegion: null,
        remediationTier: "approval",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("iam_root_access_keys"),
      });
    }

    // --- Real admin-role sprawl (count) ---
    if (admins.length > 5) {
      findings.push({
        title: `Admin role sprawl: ${admins.length} privileged accounts (${providerName})`,
        description: `${admins.length} active accounts hold administrative/privileged roles in ${providerName}; best practice is no more than 5. Examples: ${this.sampleLogins(admins)}. Each additional admin expands the attack surface and weakens privileged-action auditing. Review and demote unnecessary admins to scoped, least-privilege roles.`,
        severity: "high",
        category: "identity",
        resourceType: "idp_privileged_role",
        resourceId: `${config.provider}/admin-count`,
        resourceRegion: null,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("iam_console_and_access_keys"),
      });
    }

    // --- Real stale accounts (no login in 90+ days) ---
    const staleUsers = activeUsers.filter(
      (u) => u.lastLoginMs !== null && now - u.lastLoginMs > STALE_MS,
    );
    if (staleUsers.length > 0) {
      findings.push({
        title: `Stale accounts: ${staleUsers.length} accounts inactive for ${STALE_DAYS}+ days (${providerName})`,
        description: `${staleUsers.length} active accounts in ${providerName} have not logged in for more than ${STALE_DAYS} days. Stale accounts are prime account-takeover targets because their compromise is unlikely to be noticed. Examples: ${this.sampleLogins(staleUsers)}. Disable or deprovision them per your offboarding policy.`,
        severity: "medium",
        category: "identity",
        resourceType: "idp_stale_account",
        resourceId: `${config.provider}/stale-accounts`,
        resourceRegion: null,
        remediationTier: "approval",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("iam_console_and_access_keys"),
      });
    }

    return findings;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Up to 5 real logins for evidence; never includes secrets. */
  private sampleLogins(users: IdpUser[]): string {
    const sample = users.slice(0, 5).map((u) => u.login);
    const suffix = users.length > 5 ? `, +${users.length - 5} more` : "";
    return sample.join(", ") + suffix;
  }

  /** Parses an ISO-8601 / epoch timestamp to ms, or null when absent/unparseable. */
  private parseDate(value: unknown): number | null {
    if (!value) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const ms = Date.parse(String(value));
    return Number.isNaN(ms) ? null : ms;
  }

  private warnIfSsrf(err: unknown, config: IdentityConfig, phase: string): void {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — record blocked targets at warn so the
    // SSRF oracle attempt is auditable; no Fastify logger is reachable in agent context.
    if (err instanceof SsrfBlockedError) {
      console.warn(JSON.stringify({ level: "warn", event: "ssrf.blocked", agent: this.type, provider: config.provider, phase, reason: err.message }));
    }
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): explicit, honest "not-assessed" finding emitted when the IdP
   * cannot be enumerated. Carries NO fabricated posture numbers — it tells the operator exactly
   * why the check could not run so the gap is visible rather than silently passing.
   */
  private notAssessedFinding(config: IdentityConfig, reason: string): AgentFindingPayload {
    const providerName = this.providerName(config);
    return {
      title: `Identity posture not assessed: ${providerName}`,
      description: `The identity auditor could not assess MFA enrollment, privileged-account count, or stale accounts for ${providerName} because ${reason}. No posture is reported (these values were intentionally NOT fabricated). Connect a credential with directory read scope (Okta read-only API token, Microsoft Graph User.Read.All + AuditLog.Read.All + RoleManagement.Read.Directory, or Google Workspace Admin SDK read-only) and re-run the scan.`,
      severity: "info",
      category: "identity",
      resourceType: "idp_assessment",
      resourceId: `${config.provider}/not-assessed`,
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("iam_user_no_mfa"),
    };
  }

  async testConnection(credentialRef: string): Promise<boolean> {
    const config = this.parseConfig(credentialRef);
    if (!config.apiUrl || (!config.apiKey && !config.apiUrl.startsWith("vault://"))) return false;
    try {
      const headers = this.authHeader(config);
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — connectivity probe against the
      // tenant-controlled apiUrl routed through safeFetch so a HEAD request can't be used to
      // probe internal/metadata services. vault:// refs still fall through to the catch below.
      const res = await safeFetch(config.apiUrl, { headers, method: "HEAD" }, { timeoutMs: 5000 });
      return res.status < 500;
    } catch (err) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — log blocked probe targets at warn.
      if (err instanceof SsrfBlockedError && !config.apiUrl.startsWith("vault://")) {
        console.warn(JSON.stringify({ level: "warn", event: "ssrf.blocked", agent: this.type, provider: config.provider, phase: "testConnection", reason: err.message }));
      }
      return config.apiUrl.startsWith("vault://");
    }
  }
}
